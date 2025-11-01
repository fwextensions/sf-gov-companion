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
	previewUrl: string | null;
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
	isPreviewMode: boolean;
	previewUrl: string | null;
	previewTimestamp: number;
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
 * Extracts preview parameters from a preview URL
 * @param url - The preview URL to extract parameters from
 * @returns Object with preview and ts parameters, or null if not a preview URL
 */
function extractPreviewParams(url: string): { preview: string; ts: string } | null {
	try {
		const urlObj = new URL(url);
		const preview = urlObj.searchParams.get("preview");
		const ts = urlObj.searchParams.get("ts");
		
		if (preview && ts) {
			return { preview, ts };
		}
		
		return null;
	} catch (error) {
		return null;
	}
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
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
	const [previewTimestamp, setPreviewTimestamp] = useState<number>(0);

	// Refs for persistent data across renders
	const pageCacheRef = useRef<Map<string, CacheEntry>>(new Map());
	const debounceTimerRef = useRef<number | null>(null);
	const currentTabStateRef = useRef<TabState | null>(null);
	const lastValidStateRef = useRef<{ url: string; pageData: WagtailPage } | null>(null);

	/**
	 * Fetches page data from the Wagtail API by page ID with caching
	 * @param pageId - The page ID to fetch data for
	 * @param previewMode - Whether to use preview mode for cache key
	 * @param timestamp - Preview timestamp for cache key
	 */
	const fetchPageDataById = useCallback(async (pageId: number, previewMode: boolean = false, timestamp: number = 0): Promise<void> => {
		// Generate cache key based on preview mode
		const cacheKey = previewMode ? `id:${pageId}:preview:${timestamp}` : `id:${pageId}:live`;
		
		// Check cache first
		const cachedEntry = pageCacheRef.current.get(cacheKey);
		if (cachedEntry && isCacheValid(cachedEntry)) {
			console.log("Using cached data for page ID:", pageId, { hasData: !!cachedEntry.data, hasError: !!cachedEntry.error, previewMode });
			
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
		
		// Extract preview parameters if in preview mode
		let previewParams = null;
		if (previewMode && previewUrl) {
			previewParams = extractPreviewParams(previewUrl);
			console.log("Extracted preview params:", previewParams);
		}
		
		// Fetch from API
		try {
			console.log("Fetching page data for ID:", pageId, { previewMode, previewParams });
			// TODO: Pass previewParams to findPageById once task 5 is complete
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
			
			// Save last valid state for persistence
			if (currentTabStateRef.current && data) {
				lastValidStateRef.current = {
					url: currentTabStateRef.current.url,
					pageData: data
				};
			}
		} catch (err) {
			console.error("Error fetching page data by ID:", err);
			
			// Type check for ApiError
			const apiError = err as ApiError;
			if (apiError && apiError.type && apiError.message && typeof apiError.retryable === "boolean") {
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
					type: "network",
					message: "An unexpected error occurred",
					retryable: true
				};
				setError(unexpectedError);
				setPageData(null);
			}
			
			setIsLoading(false);
		}
	}, [previewUrl]);

	/**
	 * Fetches page data from the Wagtail API with caching
	 * @param slug - The page slug to fetch data for
	 * @param url - The current URL to help determine the correct locale
	 * @param previewMode - Whether to use preview mode for cache key
	 * @param timestamp - Preview timestamp for cache key
	 */
	const fetchPageData = useCallback(async (slug: string, url?: string, previewMode: boolean = false, timestamp: number = 0): Promise<void> => {
		// Generate cache key based on preview mode
		const cacheKey = previewMode ? `${slug}:preview:${timestamp}` : `${slug}:live`;
		
		// Check cache first
		const cachedEntry = pageCacheRef.current.get(cacheKey);
		if (cachedEntry && isCacheValid(cachedEntry)) {
			console.log("Using cached data for slug:", slug, { hasData: !!cachedEntry.data, hasError: !!cachedEntry.error, previewMode });
			
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
		
		// Extract preview parameters if in preview mode
		let previewParams = null;
		if (previewMode && previewUrl) {
			previewParams = extractPreviewParams(previewUrl);
			console.log("Extracted preview params:", previewParams);
		}
		
		// Fetch from API
		try {
			console.log("Fetching page data for slug:", slug, "url:", url, { previewMode, previewParams });
			// TODO: Pass previewParams to findPageBySlug once task 5 is complete
			const data = await findPageBySlug(slug, url);
			
			// Cache the result
			pageCacheRef.current.set(cacheKey, {
				data,
				timestamp: Date.now()
			});
			
			// Update state
			setPageData(data);
			setError(null);
			setIsLoading(false);
			
			// Save last valid state for persistence
			if (currentTabStateRef.current && data) {
				lastValidStateRef.current = {
					url: currentTabStateRef.current.url,
					pageData: data
				};
			}
		} catch (err) {
			console.error("Error fetching page data:", err);
			
			// Type check for ApiError
			const apiError = err as ApiError;
			if (apiError && apiError.type && apiError.message && typeof apiError.retryable === "boolean") {
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
					type: "network",
					message: "An unexpected error occurred",
					retryable: true
				};
				setError(unexpectedError);
				setPageData(null);
			}
			
			setIsLoading(false);
		}
	}, [previewUrl]);

	/**
	 * Debounced function to fetch page data
	 * @param slug - The page slug to fetch data for
	 * @param url - The current URL to help determine the correct locale
	 * @param previewMode - Whether to use preview mode
	 * @param timestamp - Preview timestamp
	 */
	const debouncedFetchPageData = useCallback((slug: string, url: string, previewMode: boolean = false, timestamp: number = 0) => {
		// Clear existing timer if present
		if (debounceTimerRef.current !== null) {
			clearTimeout(debounceTimerRef.current);
		}
		
		// Set new timer
		debounceTimerRef.current = window.setTimeout(() => {
			debounceTimerRef.current = null;
			fetchPageData(slug, url, previewMode, timestamp);
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
		
		console.log("handleTabUpdate called:", { url, onSfGov, isAdminPage, pageId, slug });
		
		// Check if URL actually changed (to handle window focus changes)
		if (currentTabStateRef.current && currentTabStateRef.current.url === url) {
			console.log("URL unchanged, preserving state");
			// Restore last valid page data if available
			if (lastValidStateRef.current && lastValidStateRef.current.url === url) {
				setPageData(lastValidStateRef.current.pageData);
				setError(null);
			}
			return;
		}
		
		// Check if state changed meaningfully
		const stateChanged = !currentTabStateRef.current || 
							currentTabStateRef.current.slug !== slug ||
							currentTabStateRef.current.isOnSfGov !== onSfGov ||
							currentTabStateRef.current.isAdminPage !== isAdminPage ||
							currentTabStateRef.current.pageId !== pageId;
		
		if (!stateChanged) {
			console.log("Tab state unchanged, skipping update");
			return;
		}
		
		// Clear previous page data immediately when navigating to a new page
		// This prevents stale data from showing while new data loads
		setPageData(null);
		setError(null);
		
		// Update current state
		currentTabStateRef.current = { url, slug, isOnSfGov: onSfGov, isAdminPage, pageId, previewUrl: null };
		setCurrentUrl(url);
		setIsOnSfGovState(onSfGov);
		setIsAdminPageState(isAdminPage);
		console.log("Tab state updated:", currentTabStateRef.current);
		
		// Clear preview mode if we're leaving an admin page
		if (currentTabStateRef.current && !isAdminPage && (previewUrl || isPreviewMode)) {
			console.log("Leaving admin page, clearing preview mode");
			setPreviewUrl(null);
			setIsPreviewMode(false);
			setPreviewTimestamp(0);
		}
		
		if (isAdminPage && pageId) {
			// On Wagtail admin edit page - fetch data by page ID
			console.log("On Wagtail admin edit page with ID:", pageId);
			fetchPageDataById(pageId);
		} else if (onSfGov && slug) {
			// On SF.gov with valid slug - fetch data with debouncing
			console.log("On SF.gov page with slug:", slug);
			debouncedFetchPageData(slug, url);
		} else if (!onSfGov) {
			// Only clear state if we've actually left SF.gov
			console.log("Left SF.gov domain, clearing state");
			setIsLoading(false);
			setPageData(null);
			setError(null);
			lastValidStateRef.current = null;
		} else {
			// On SF.gov but no valid slug (e.g., homepage)
			console.log("On SF.gov but no valid slug");
			setIsLoading(false);
			setPageData(null);
			setError(null);
		}
	}, [debouncedFetchPageData, fetchPageDataById, previewUrl, isPreviewMode]);

	/**
	 * Retry function that clears cache and refetches data
	 */
	const retry = useCallback(() => {
		if (!currentTabStateRef.current) {
			console.error("No tab state available for retry");
			return;
		}

		const { isAdminPage, pageId, slug, url } = currentTabStateRef.current;

		if (isAdminPage && pageId) {
			// Generate cache key based on preview mode
			const cacheKey = isPreviewMode ? `id:${pageId}:preview:${previewTimestamp}` : `id:${pageId}:live`;
			// Clear cache for this page ID
			pageCacheRef.current.delete(cacheKey);
			// Fetch fresh data by ID
			fetchPageDataById(pageId, isPreviewMode, previewTimestamp);
		} else if (slug) {
			// Generate cache key based on preview mode
			const cacheKey = isPreviewMode ? `${slug}:preview:${previewTimestamp}` : `${slug}:live`;
			// Clear cache for this slug
			pageCacheRef.current.delete(cacheKey);
			// Fetch fresh data by slug
			fetchPageData(slug, url, isPreviewMode, previewTimestamp);
		} else {
			console.error("No slug or page ID available for retry");
		}
	}, [fetchPageData, fetchPageDataById, isPreviewMode, previewTimestamp]);

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
        
        // If on admin page, request current preview state from content script
        if (url.includes('/admin/pages/') && url.includes('/edit/')) {
          console.log('Requesting current preview state from content script');
          try {
            await chrome.tabs.sendMessage(tab.id!, { type: 'REQUEST_PREVIEW_STATE' });
          } catch (err) {
            console.log('Could not request preview state (content script may not be ready):', err);
          }
        }
      } catch (err) {
        console.error('Error loading current page:', err);
        setIsOnSfGovState(false);
      }
    };

    loadCurrentPage();
  }, [handleTabUpdate]);

	/**
	 * Set up preview message listener
	 */
	useEffect(() => {
		/**
		 * Handler for preview messages from content script
		 */
		const onMessage = (
			message: any,
			_sender: chrome.runtime.MessageSender,
			_sendResponse: (response?: any) => void
		) => {
			// Handle PREVIEW_URL_UPDATE messages
			if (message.type === "PREVIEW_URL_UPDATE" && message.url && message.timestamp) {
				const messageAge = Date.now() - message.timestamp;
				
				// Ignore stale messages (older than 5 seconds)
				if (messageAge > 5000) {
					console.log("Ignoring stale preview message:", { messageAge, timestamp: message.timestamp });
					return;
				}
				
				console.log("Received preview URL update:", { url: message.url, timestamp: message.timestamp });
				setPreviewUrl(message.url);
				setIsPreviewMode(true);
				setPreviewTimestamp(message.timestamp);
				
				// Note: We don't need to fetch page data again here
				// The iframe src will update automatically when previewUrl changes
				// and App.tsx will use the new preview URL
			}
			
			// Handle PREVIEW_UNAVAILABLE messages
			if (message.type === "PREVIEW_UNAVAILABLE" && message.timestamp) {
				const messageAge = Date.now() - message.timestamp;
				
				// Ignore stale messages (older than 5 seconds)
				if (messageAge > 5000) {
					console.log("Ignoring stale preview unavailable message:", { messageAge, timestamp: message.timestamp });
					return;
				}
				
				console.log("Received preview unavailable message - keeping current preview URL:", { timestamp: message.timestamp, currentPreviewUrl: previewUrl });
				// Note: We intentionally do NOT clear previewUrl or isPreviewMode here
				// The user likely made a change that temporarily disabled the preview button
				// We want to keep showing the preview URL so they can continue viewing their draft
			}
		};
		
		// Register listener
		chrome.runtime.onMessage.addListener(onMessage);
		console.log("Preview message listener registered");
		
		// Cleanup function
		return () => {
			chrome.runtime.onMessage.removeListener(onMessage);
			console.log("Preview message listener removed");
		};
	}, [fetchPageData, fetchPageDataById]);

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
			if (changeInfo.status === "complete" && tab.url) {
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
				console.error("Error getting tab info:", err);
			}
		};

		// Register listeners
		chrome.tabs.onUpdated.addListener(onTabUpdated);
		chrome.tabs.onActivated.addListener(onTabActivated);
		console.log("Tab listeners registered");

		// Cleanup function
		return () => {
			chrome.tabs.onUpdated.removeListener(onTabUpdated);
			chrome.tabs.onActivated.removeListener(onTabActivated);
			console.log("Tab listeners removed");
			
			// Clear debounce timer if active
			if (debounceTimerRef.current !== null) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
				console.log("Debounce timer cleared");
			}
		};
	}, [handleTabUpdate]);

	/**
	 * Set up visibility change listener to handle window focus changes
	 */
	useEffect(() => {
		/**
		 * Handler for visibility change events
		 */
		const handleVisibilityChange = async () => {
			if (document.visibilityState === "visible") {
				console.log("Side panel became visible");
				
				// Get current tab URL
				try {
					const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
					if (tabs.length > 0 && tabs[0] && tabs[0].url) {
						const currentUrl = tabs[0].url;
						
						// Check if URL matches last valid state
						if (lastValidStateRef.current && lastValidStateRef.current.url === currentUrl) {
							console.log("URL unchanged, restoring last valid state");
							setPageData(lastValidStateRef.current.pageData);
							setError(null);
						} else {
							// URL changed while hidden, fetch new data
							console.log("URL changed while hidden, fetching new data");
							handleTabUpdate(currentUrl);
						}
					}
				} catch (err) {
					console.error("Error handling visibility change:", err);
				}
			}
		};
		
		// Register listener
		document.addEventListener("visibilitychange", handleVisibilityChange);
		console.log("Visibility change listener registered");
		
		// Cleanup function
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			console.log("Visibility change listener removed");
		};
	}, [handleTabUpdate]);

	return {
		pageData,
		error,
		isLoading,
		isOnSfGov: isOnSfGovState,
		isAdminPage: isAdminPageState,
		isPreviewMode,
		previewUrl,
		previewTimestamp,
		currentUrl,
		retry
	};
}
