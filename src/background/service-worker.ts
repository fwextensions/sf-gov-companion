/**
 * Background Service Worker
 * Monitors tab navigation and manages side panel state for SF.gov pages
 */

import type { 
  PageDataMessage, 
  RetryMessage, 
  ExtensionMessage,
  WagtailPage,
  ApiError
} from '../types/wagtail';
import { findPageBySlug } from '../api/wagtail-client';

/**
 * Track current tab state to avoid redundant operations
 */
interface TabState {
  url: string;
  slug: string;
  isOnSfGov: boolean;
}

const tabStates = new Map<number, TabState>();

/**
 * Cache for page data with TTL
 */
interface CacheEntry {
  data: WagtailPage | null;
  error?: ApiError;
  timestamp: number;
}

const pageCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Debounce timers for each tab
 */
const debounceTimers = new Map<number, number>();
const DEBOUNCE_DELAY = 300; // 300ms

/**
 * Set up event listeners when the service worker is installed
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('SF.gov Wagtail Extension installed');
});

/**
 * Listen for toolbar button clicks to open the side panel
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log('Side panel opened via toolbar button');
    } catch (error) {
      console.error('Error opening side panel:', error);
    }
  }
});

/**
 * Listen for tab updates to detect navigation events
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when the page has finished loading
  if (changeInfo.status === 'complete' && tab.url) {
    handleTabUpdate(tabId, tab.url);
  }
});

/**
 * Listen for tab activation (switching between tabs)
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    handleTabUpdate(activeInfo.tabId, tab.url);
  }
});

/**
 * Listen for messages from the side panel
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  console.log('Service worker received message:', message);
  
  if (message.type === 'GET_CURRENT_PAGE') {
    handleGetCurrentPage(sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  if (message.type === 'RETRY_FETCH') {
    handleRetryFetch(message);
    return false;
  }
  
  return false;
});

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
    // For SF.gov, the slug is typically the full path
    return pathname;
  } catch (error) {
    return '';
  }
}

/**
 * Closes the side panel for a specific tab
 * @param tabId - The ID of the tab to close the side panel for
 */
async function closeSidePanel(tabId: number): Promise<void> {
  try {
    // Note: Chrome's sidePanel API doesn't have a direct close method
    // The panel closes automatically when navigating away from SF.gov
    // We just need to update our internal state
    console.log('Side panel state cleared for tab:', tabId);
  } catch (error) {
    console.error('Error closing side panel:', error);
  }
}

/**
 * Handles tab updates by checking if we're on SF.gov and managing side panel state
 */
async function handleTabUpdate(tabId: number, url: string): Promise<void> {
  const onSfGov = isOnSfGov(url);
  const slug = onSfGov ? extractPageSlug(url) : '';
  
  // Get previous state for this tab
  const previousState = tabStates.get(tabId);
  
  // Check if state has changed
  const stateChanged = !previousState || 
                       previousState.url !== url || 
                       previousState.slug !== slug ||
                       previousState.isOnSfGov !== onSfGov;
  
  if (!stateChanged) {
    // No change, skip processing
    return;
  }
  
  // Update tab state
  const newState: TabState = {
    url,
    slug,
    isOnSfGov: onSfGov
  };
  tabStates.set(tabId, newState);
  
  if (onSfGov) {
    // Fetch page data if we have a slug (side panel will be opened via toolbar button)
    if (slug) {
      await handlePageChange(slug, tabId);
    }
  } else {
    // Clear state when leaving SF.gov
    await closeSidePanel(tabId);
    tabStates.delete(tabId);
  }
}

/**
 * Checks if cached data is still valid
 * @param entry - The cache entry to check
 * @returns True if the cache is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * Sends page data message to the side panel
 * @param data - The page data to send (or null)
 * @param error - Optional error to send
 */
async function sendPageDataToSidePanel(data: WagtailPage | null, error?: ApiError): Promise<void> {
  const message: PageDataMessage = {
    type: 'PAGE_DATA',
    data,
    error
  };
  
  try {
    // Send to all extension contexts (including side panel)
    await chrome.runtime.sendMessage(message);
    console.log('Sent page data to side panel:', { hasData: !!data, hasError: !!error });
  } catch (err) {
    // This error is expected if no listeners are active
    console.log('No active listeners for page data message');
  }
}

/**
 * Handles page changes by fetching data from the Wagtail API
 * @param slug - The page slug to fetch
 * @param tabId - The tab ID for debouncing
 */
async function handlePageChange(slug: string, tabId: number): Promise<void> {
  // Clear any existing debounce timer for this tab
  const existingTimer = debounceTimers.get(tabId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Set up new debounce timer
  const timer = setTimeout(async () => {
    debounceTimers.delete(tabId);
    
    // Check cache first
    const cachedEntry = pageCache.get(slug);
    if (cachedEntry && isCacheValid(cachedEntry)) {
      console.log('Using cached data for slug:', slug);
      await sendPageDataToSidePanel(cachedEntry.data, cachedEntry.error);
      return;
    }
    
    // Fetch from API
    try {
      console.log('Fetching page data for slug:', slug);
      const pageData = await findPageBySlug(slug);
      
      // Cache the result
      pageCache.set(slug, {
        data: pageData,
        timestamp: Date.now()
      });
      
      // Send to side panel
      await sendPageDataToSidePanel(pageData);
    } catch (error) {
      console.error('Error fetching page data:', error);
      
      // Check if it's an ApiError
      const apiError = error as ApiError;
      if (apiError && apiError.type && apiError.message) {
        // Cache the error (except for retryable errors)
        if (!apiError.retryable) {
          pageCache.set(slug, {
            data: null,
            error: apiError,
            timestamp: Date.now()
          });
        }
        
        // Send error to side panel
        await sendPageDataToSidePanel(null, apiError);
      } else {
        // Unknown error
        const unknownError: ApiError = {
          type: 'network',
          message: 'An unexpected error occurred',
          retryable: true
        };
        await sendPageDataToSidePanel(null, unknownError);
      }
    }
  }, DEBOUNCE_DELAY);
  
  debounceTimers.set(tabId, timer);
}

/**
 * Handles requests from side panel to get current page data
 */
async function handleGetCurrentPage(sendResponse: (response: any) => void): Promise<void> {
  try {
    console.log('handleGetCurrentPage called');
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Active tab:', tab?.id, tab?.url);
    
    if (!tab || !tab.url) {
      console.log('No tab or URL, returning null');
      sendResponse({ type: 'PAGE_DATA', data: null });
      return;
    }
    
    let tabState = tabStates.get(tab.id!);
    console.log('Tab state:', tabState);
    
    // If no tab state exists, create it now
    if (!tabState) {
      const onSfGov = isOnSfGov(tab.url);
      const slug = onSfGov ? extractPageSlug(tab.url) : '';
      
      if (!onSfGov) {
        console.log('Not on SF.gov, returning null');
        sendResponse({ type: 'PAGE_DATA', data: null });
        return;
      }
      
      tabState = {
        url: tab.url,
        slug,
        isOnSfGov: true
      };
      tabStates.set(tab.id!, tabState);
      console.log('Created new tab state:', tabState);
    }
    
    if (!tabState.isOnSfGov) {
      console.log('Not on SF.gov, returning null');
      sendResponse({ type: 'PAGE_DATA', data: null });
      return;
    }
    
    // Check cache
    const cachedEntry = pageCache.get(tabState.slug);
    if (cachedEntry && isCacheValid(cachedEntry)) {
      sendResponse({ 
        type: 'PAGE_DATA', 
        data: cachedEntry.data,
        error: cachedEntry.error
      });
      return;
    }
    
    // If not in cache, fetch the data
    console.log('No cached data, fetching for slug:', tabState.slug);
    
    try {
      console.log('Fetching page data for slug:', tabState.slug);
      const pageData = await findPageBySlug(tabState.slug);
      console.log('Fetch successful, page data:', pageData);
      
      // Cache the result
      pageCache.set(tabState.slug, {
        data: pageData,
        timestamp: Date.now()
      });
      
      // Send response
      sendResponse({ 
        type: 'PAGE_DATA', 
        data: pageData
      });
    } catch (error) {
      console.error('Error fetching page data:', error);
      
      // Check if it's an ApiError
      const apiError = error as ApiError;
      if (apiError && apiError.type && apiError.message) {
        // Cache the error (except for retryable errors)
        if (!apiError.retryable) {
          pageCache.set(tabState.slug, {
            data: null,
            error: apiError,
            timestamp: Date.now()
          });
        }
        
        // Send error response
        sendResponse({ 
          type: 'PAGE_DATA', 
          data: null,
          error: apiError
        });
      } else {
        // Unknown error
        const unknownError: ApiError = {
          type: 'network',
          message: 'An unexpected error occurred',
          retryable: true
        };
        sendResponse({ 
          type: 'PAGE_DATA', 
          data: null,
          error: unknownError
        });
      }
    }
  } catch (error) {
    console.error('Error handling get current page:', error);
    sendResponse({ type: 'PAGE_DATA', data: null });
  }
}

/**
 * Handles retry requests from the side panel
 */
async function handleRetryFetch(message: RetryMessage): Promise<void> {
  const slug = message.slug;
  
  console.log('Retry fetch requested for slug:', slug);
  
  // Clear cache for this specific page
  pageCache.delete(slug);
  
  // Get the current active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      console.error('No active tab found for retry');
      return;
    }
    
    // Fetch page data again (without debouncing for retry)
    try {
      console.log('Re-fetching page data for slug:', slug);
      const pageData = await findPageBySlug(slug);
      
      // Cache the result
      pageCache.set(slug, {
        data: pageData,
        timestamp: Date.now()
      });
      
      // Send to side panel
      await sendPageDataToSidePanel(pageData);
    } catch (error) {
      console.error('Error re-fetching page data:', error);
      
      // Check if it's an ApiError
      const apiError = error as ApiError;
      if (apiError && apiError.type && apiError.message) {
        // Send error to side panel
        await sendPageDataToSidePanel(null, apiError);
      } else {
        // Unknown error
        const unknownError: ApiError = {
          type: 'network',
          message: 'An unexpected error occurred',
          retryable: true
        };
        await sendPageDataToSidePanel(null, unknownError);
      }
    }
  } catch (error) {
    console.error('Error handling retry fetch:', error);
  }
}
