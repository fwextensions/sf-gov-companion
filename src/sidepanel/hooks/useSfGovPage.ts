/**
 * Custom React hook for fetching and managing SF.gov page data
 * Handles Chrome tab monitoring, data fetching, caching, and error states
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WagtailPage, ApiError, CacheEntry } from '../../types/wagtail';
import { findPageBySlug } from '../../api/wagtail-client';

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
}

/**
 * Return type for the useSfGovPage hook
 */
export interface UseSfGovPageReturn {
  pageData: WagtailPage | null;
  error: ApiError | null;
  isLoading: boolean;
  isOnSfGov: boolean;
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

  // Refs for persistent data across renders
  const pageCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceTimerRef = useRef<number | null>(null);
  const currentTabStateRef = useRef<TabState | null>(null);

  /**
   * Fetches page data from the Wagtail API with caching
   * @param slug - The page slug to fetch data for
   */
  const fetchPageData = useCallback(async (slug: string): Promise<void> => {
    // Check cache first
    const cachedEntry = pageCacheRef.current.get(slug);
    if (cachedEntry && isCacheValid(cachedEntry)) {
      console.log('Using cached data for slug:', slug);
      setPageData(cachedEntry.data);
      setError(cachedEntry.error || null);
      setIsLoading(false);
      return;
    }
    
    // Show loading state
    setIsLoading(true);
    setError(null);
    
    // Fetch from API
    try {
      console.log('Fetching page data for slug:', slug);
      const data = await findPageBySlug(slug);
      
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
   */
  const debouncedFetchPageData = useCallback((slug: string) => {
    // Clear existing timer if present
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      fetchPageData(slug);
    }, DEBOUNCE_DELAY);
  }, [fetchPageData]);

  /**
   * Handles tab update events by checking URL and fetching data if needed
   * @param url - The URL of the tab
   */
  const handleTabUpdate = useCallback((url: string) => {
    const onSfGov = isOnSfGov(url);
    const slug = onSfGov ? extractPageSlug(url) : '';
    
    // Check if state changed
    const stateChanged = !currentTabStateRef.current || 
                         currentTabStateRef.current.url !== url || 
                         currentTabStateRef.current.slug !== slug ||
                         currentTabStateRef.current.isOnSfGov !== onSfGov;
    
    if (!stateChanged) {
      console.log('Tab state unchanged, skipping update');
      return;
    }
    
    // Update current state
    currentTabStateRef.current = { url, slug, isOnSfGov: onSfGov };
    setCurrentUrl(url);
    setIsOnSfGovState(onSfGov);
    console.log('Tab state updated:', currentTabStateRef.current);
    
    if (onSfGov && slug) {
      // On SF.gov with valid slug - fetch data with debouncing
      console.log('On SF.gov page with slug:', slug);
      debouncedFetchPageData(slug);
    } else {
      // Not on SF.gov or no valid slug
      setIsLoading(false);
      setPageData(null);
      setError(null);
    }
  }, [debouncedFetchPageData]);

  /**
   * Retry function that clears cache and refetches data
   */
  const retry = useCallback(() => {
    if (!currentTabStateRef.current || !currentTabStateRef.current.slug) {
      console.error('No slug available for retry');
      return;
    }

    // Clear cache for this slug
    pageCacheRef.current.delete(currentTabStateRef.current.slug);
    
    // Fetch fresh data directly
    fetchPageData(currentTabStateRef.current.slug);
  }, [fetchPageData]);

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
    currentUrl,
    retry
  };
}
