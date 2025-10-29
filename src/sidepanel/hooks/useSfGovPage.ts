/**
 * Custom React hook for fetching and managing SF.gov page data
 * Handles Chrome tab monitoring, data fetching, caching, and error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WagtailPage, ApiError, CacheEntry } from '../../types/wagtail';
import { findPageBySlug, findPageById } from '../../api/wagtail-client';

/**
 * Cache time-to-live in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Debounce delay in milliseconds
 */
const DEBOUNCE_DELAY = 300;

/**
 * Interface for tracking the current tab state
 */
interface TabState {
  url: string;
  slug: string;
  isOnSfGov: boolean;
  isAdminPage: boolean;
  pageId: number | null;
}

/**
 * Return type for the useSfGovPage hook
 */
export interface UseSfGovPageReturn {
  pageData: WagtailPage | null;
  error: ApiError | null;
  isLoading: boolean;
  isOnSfGov: boolean;
  isAdminPage: boolean;
  currentUrl: string;
  retry: () => void;
}

/**
 * Checks if a URL is on the SF.gov domain
 * @param url - The URL to check
 * @returns True if the URL contains sf.gov domain
 */
function isOnSfGov(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('sf.gov');
  } catch (error) {
    return false;
  }
}

/**
 * Checks if a URL is a Wagtail admin edit page
 * @param url - The URL to check
 * @returns True if the URL is a Wagtail admin edit page
 */
function isWagtailAdminEditPage(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('sf.gov') && urlObj.pathname.includes('/admin/pages/') && urlObj.pathname.includes('/edit/');
  } catch (error) {
    return false;
  }
}

/**
 * Extracts the page ID from a Wagtail admin edit URL
 * @param url - The admin edit URL
 * @returns The page ID, or null if not found
 */
function extractPageIdFromAdminUrl(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/admin\/pages\/(\d+)\/edit\//);
    return match ? parseInt(match[1], 10) : null;
  } catch (error) {
    return null;
  }
}

/**
 * Extracts the page slug from an SF.gov URL
 * @param url - The URL to extract the slug from
 * @returns The page slug, or empty string if not found
 */
function extractPageSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    
    // Remove trailing slash
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    
    // Remove leading slash
    if (pathname.startsWith('/')) {
      pathname = pathname.slice(1);
    }
    
    // Return the pathname as the slug
    return pathname;
  } catch (error) {
    return '';
  }
}

/**
 * Checks if a cache entry is still valid based on TTL
 * @param entry - The cache entry to validate
 * @returns True if the entry is still valid, false otherwise
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * Custom hook for managing SF.gov page data fetching and state
 * @returns Object containing page data, loading state, error state, and retry function
 */
export function useSfGovPage(): UseSfGovPageReturn {
  // State management
  const [pageData, setPageData] = useState<WagtailPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isOnSfGovState, setIsOnSfGovState] = useState<boolean>(false);
  const [isAdminPageState, setIsAdminPageState] = useState<boolean>(false);

  // Refs for persistent data across renders
  const pageCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceTimerRef = useRef<number | null>(null);
  const currentTabStateRef = useRef<TabState | null>(null);

  /**
   * Fetches page data from the Wagtail API by page ID with caching
   * @param pageId - The page ID to fetch data for
   */
  const fetchPageDataById = useCallback(async (pageId: number): Promise<void> => {
    const cacheKey = `id:${pageId}`;
    
    // Check cache first
    const cachedEntry = pageCacheRef.current.get(cacheKey);
    if (cachedEntry && isCacheValid(cachedEntry)) {
      console.log('Using cached data for page ID:', pageId, { hasData: !!cachedEntry.data, hasError: !!cachedEntry.error });
      
      // Only update state if we have data or a cached error
      if (cachedEntry.data) {
        setPageData(cachedEntry.data);
        setError(null);
      } else if (cachedEntry.error) {
        setPageData(null);
        setError(cachedEntry.error);
      }
      setIsLoading(false);
      return;
    }
    
    // Show loading state
    setIsLoading(true);
    setError(null);
    
    // Fetch from API
    try {
      console.log('Fetching page data for ID:', pageId);
      const data = await findPageById(pageId);
      
      // Cache the result
      pageCacheRef.current.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      // Update state
      setPageData(data);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching page data by ID:', err);
      
      // Type check for ApiError
      const apiError = err as ApiError;
      if (apiError && apiError.type && apiError.message && typeof apiError.retryable === 'boolean') {
        // Cache non-retryable errors
        if (!apiError.retryable) {
          pageCacheRef.current.set(cacheKey, {
            data: null,
            error: apiError,
            timestamp: Date.now()
          });
        }
        
        setError(apiError);
        setPageData(null);
      } else {
        // Handle unexpected errors
        const unexpectedError: ApiError = {
          type: 'network',
          message: 'An unexpected error occurred',
          retryable: true
        };
        setError(unexpectedError);
        setPageData(null);
      }
      
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetches page data from the Wagtail API with caching
   * @param slug - The page slug to fetch data for
   * @param url - The current URL to help determine the correct locale
   */
  const fetchPageData = useCallback(async (slug: string, url?: string): Promise<void> => {
    // Check cache first
    const cachedEntry = pageCacheRef.current.get(slug);
    if (cachedEntry && isCacheValid(cachedEntry)) {
      console.log('Using cached data for slug:', slug, { hasData: !!cachedEntry.data, hasError: !!cachedEntry.error });
      
      // Only update state if we have data or a cached error
      if (cachedEntry.data) {
        setPageData(cachedEntry.data);
        setError(null);
      } else if (cachedEntry.error) {
        setPageData(null);
        setError(cachedEntry.error);
      }
      setIsLoading(false);
      return;
    }
    
    // Show loading state
    setIsLoading(true);
    setError(null);
    
    // Fetch from API
    try {
      console.log('Fetching page data for slug:', slug, 'url:', url);
      const data = await findPageBySlug(slug, url);
      
      // Cache the result
      pageCacheRef.current.set(slug, {
        data,
        timestamp: Date.now()
      });
      
      // Update state
      setPageData(data);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching page data:', err);
      
      // Type check for ApiError
      const apiError = err as ApiError;
      if (apiError && apiError.type && apiError.message && typeof apiError.retryable === 'boolean') {
        // Cache non-retryable errors
        if (!apiError.retryable) {
          pageCacheRef.current.set(slug, {
            data: null,
            error: apiError,
            timestamp: Date.now()
          });
        }
        
        setError(apiError);
        setPageData(null);
      } else {
        // Handle unexpected errors
        const unexpectedError: ApiError = {
          type: 'network',
          message: 'An unexpected error occurred',
          retryable: true
        };
        setError(unexpectedError);
        setPageData(null);
      }
      
      setIsLoading(false);
    }
  }, []);

  /**
   * Debounced function to fetch page data
   * @param slug - The page slug to fetch data for
   * @param url - The current URL to help determine the correct locale
   */
  const debouncedFetchPageData = useCallback((slug: string, url: string) => {
    // Clear existing timer if present
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      fetchPageData(slug, url);
    }, DEBOUNCE_DELAY);
  }, [fetchPageData]);

  /**
   * Handles tab update events by checking URL and fetching data if needed
   * @param url - The URL of the tab
   */
  const handleTabUpdate = useCallback((url: string) => {
    const onSfGov = isOnSfGov(url);
    const isAdminPage = isWagtailAdminEditPage(url);
    const pageId = isAdminPage ? extractPageIdFromAdminUrl(url) : null;
    const slug = onSfGov && !isAdminPage ? extractPageSlug(url) : '';
    
    console.log('handleTabUpdate called:', { url, onSfGov, isAdminPage, pageId, slug });
    
    // Check if state changed meaningfully
    const stateChanged = !currentTabStateRef.current || 
                         currentTabStateRef.current.slug !== slug ||
                         currentTabStateRef.current.isOnSfGov !== onSfGov ||
                         currentTabStateRef.current.isAdminPage !== isAdminPage ||
                         currentTabStateRef.current.pageId !== pageId;
    
    if (!stateChanged) {
      console.log('Tab state unchanged, skipping update');
      return;
    }
    
    // Update current state
    currentTabStateRef.current = { url, slug, isOnSfGov: onSfGov, isAdminPage, pageId };
    setCurrentUrl(url);
    setIsOnSfGovState(onSfGov);
    setIsAdminPageState(isAdminPage);
    console.log('Tab state updated:', currentTabStateRef.current);
    
    if (isAdminPage && pageId) {
      // On Wagtail admin edit page - fetch data by page ID
      console.log('On Wagtail admin edit page with ID:', pageId);
      fetchPageDataById(pageId);
    } else if (onSfGov && slug) {
      // On SF.gov with valid slug - fetch data with debouncing
      console.log('On SF.gov page with slug:', slug);
      debouncedFetchPageData(slug, url);
    } else if (!onSfGov) {
      // Only clear state if we've actually left SF.gov
      console.log('Left SF.gov domain, clearing state');
      setIsLoading(false);
      setPageData(null);
      setError(null);
    } else {
      // On SF.gov but no valid slug (e.g., homepage)
      console.log('On SF.gov but no valid slug');
      setIsLoading(false);
      setPageData(null);
      setError(null);
    }
  }, [debouncedFetchPageData, fetchPageDataById]);

  /**
   * Retry function that clears cache and refetches data
   */
  const retry = useCallback(() => {
    if (!currentTabStateRef.current) {
      console.error('No tab state available for retry');
      return;
    }

    const { isAdminPage, pageId, slug, url } = currentTabStateRef.current;

    if (isAdminPage && pageId) {
      // Clear cache for this page ID
      pageCacheRef.current.delete(`id:${pageId}`);
      // Fetch fresh data by ID
      fetchPageDataById(pageId);
    } else if (slug) {
      // Clear cache for this slug
      pageCacheRef.current.delete(slug);
      // Fetch fresh data by slug
      fetchPageData(slug, url);
    } else {
      console.error('No slug or page ID available for retry');
    }
  }, [fetchPageData, fetchPageDataById]);

  /**
   * Load data for the current active tab on mount
   */
  useEffect(() => {
    const loadCurrentPage = async () => {
      try {
        // Query current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tabs.length === 0 || !tabs[0] || !tabs[0].url) {
          console.warn('No active tab found or tab has no URL');
          setIsOnSfGovState(false);
          return;
        }
        
        const tab = tabs[0];
        const url = tab.url!;
        
        console.log('Loading current page:', url);
        handleTabUpdate(url);
      } catch (err) {
        console.error('Error loading current page:', err);
        setIsOnSfGovState(false);
      }
    };

    loadCurrentPage();
  }, [handleTabUpdate]);

  /**
   * Set up Chrome tab event listeners
   */
  useEffect(() => {
    /**
     * Handler for chrome.tabs.onUpdated events
     */
    const onTabUpdated = (
      _tabId: number,
      changeInfo: { status?: string; url?: string },
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.status === 'complete' && tab.url) {
        handleTabUpdate(tab.url);
      }
    };

    /**
     * Handler for chrome.tabs.onActivated events
     */
    const onTabActivated = async (activeInfo: { tabId: number; windowId: number }) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
          handleTabUpdate(tab.url);
        }
      } catch (err) {
        console.error('Error getting tab info:', err);
      }
    };

    // Register listeners
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.tabs.onActivated.addListener(onTabActivated);
    console.log('Tab listeners registered');

    // Cleanup function
    return () => {
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      chrome.tabs.onActivated.removeListener(onTabActivated);
      console.log('Tab listeners removed');
      
      // Clear debounce timer if active
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        console.log('Debounce timer cleared');
      }
    };
  }, [handleTabUpdate]);

  return {
    pageData,
    error,
    isLoading,
    isOnSfGov: isOnSfGovState,
    isAdminPage: isAdminPageState,
    currentUrl,
    retry
  };
}
