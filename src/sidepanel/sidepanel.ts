/**
 * Side Panel Logic
 * Handles rendering of page data and user interactions
 */

import type {
  WagtailPage,
  ApiError,
  Translation,
  MediaAsset,
  CacheEntry
} from '../types/wagtail';
import { findPageBySlug } from '../api/wagtail-client';

/**
 * Interface for tracking the current tab state
 */
interface TabState {
  url: string;
  slug: string;
  isOnSfGov: boolean;
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
    // For SF.gov, the slug is typically the full path
    return pathname;
  } catch (error) {
    return '';
  }
}

/**
 * Retrieves cached data for a given slug if valid
 * @param slug - The page slug to retrieve from cache
 * @returns The cached entry if valid, null otherwise
 */
function getCachedData(slug: string): CacheEntry | null {
  const entry = pageCache.get(slug);
  if (entry && isCacheValid(entry)) {
    return entry;
  }
  return null;
}

/**
 * Stores page data in the cache with a timestamp
 * @param slug - The page slug to use as cache key
 * @param entry - The cache entry to store
 */
function setCachedData(slug: string, entry: CacheEntry): void {
  pageCache.set(slug, entry);
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
 * Clears all cached data
 * Note: Currently unused, will be removed in task 8
 */
// function clearCache(): void {
//   pageCache.clear();
// }

/**
 * Handler for chrome.tabs.onUpdated events
 */
const onTabUpdated = (
  tabId: number,
  changeInfo: { status?: string; url?: string },
  tab: chrome.tabs.Tab
) => {
  if (changeInfo.status === 'complete' && tab.url) {
    handleTabUpdate(tabId, tab.url);
  }
};

/**
 * Handler for chrome.tabs.onActivated events
 */
const onTabActivated = async (activeInfo: { tabId: number; windowId: number }) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      handleTabUpdate(activeInfo.tabId, tab.url);
    }
  } catch (error) {
    console.error('Error getting tab info:', error);
  }
};

/**
 * Sets up Chrome tab event listeners
 */
function setupTabListeners(): void {
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.tabs.onActivated.addListener(onTabActivated);
  console.log('Tab listeners registered');
}

/**
 * Removes Chrome tab event listeners
 */
function removeTabListeners(): void {
  chrome.tabs.onUpdated.removeListener(onTabUpdated);
  chrome.tabs.onActivated.removeListener(onTabActivated);
  console.log('Tab listeners removed');
}

/**
 * Handles tab update events by checking URL and fetching data if needed
 * @param _tabId - The ID of the tab that was updated
 * @param url - The URL of the tab
 */
function handleTabUpdate(_tabId: number, url: string): void {
  const onSfGov = isOnSfGov(url);
  const slug = onSfGov ? extractPageSlug(url) : '';
  
  // Check if state changed
  const stateChanged = !currentTabState || 
                       currentTabState.url !== url || 
                       currentTabState.slug !== slug ||
                       currentTabState.isOnSfGov !== onSfGov;
  
  if (!stateChanged) {
    console.log('Tab state unchanged, skipping update');
    return; // No change, skip processing
  }
  
  // Update current state
  currentTabState = { url, slug, isOnSfGov: onSfGov };
  console.log('Tab state updated:', currentTabState);
  
  if (onSfGov && slug) {
    // On SF.gov with valid slug - fetch data with debouncing
    console.log('On SF.gov page with slug:', slug);
    debouncedFetchPageData(slug);
  } else {
    // Not on SF.gov or no valid slug
    showNotOnSfGov();
  }
}

/**
 * Shows a message when not on an SF.gov page
 */
function showNotOnSfGov(): void {
  hideLoading();
  hideError();
  hideContent();
  
  const errorEl = document.getElementById('error');
  const errorMessageEl = document.getElementById('error-message');
  const retryButton = document.getElementById('retry-button');
  
  if (errorEl && errorMessageEl) {
    errorMessageEl.textContent = 'Navigate to an SF.gov page to see CMS information';
    
    // Hide retry button for this state
    if (retryButton) {
      retryButton.style.display = 'none';
    }
    
    errorEl.style.display = 'flex';
  }
}

/**
 * Current tab state tracking
 */
let currentTabState: TabState | null = null;

/**
 * Cache for storing page data with timestamps
 */
const pageCache = new Map<string, CacheEntry>();

/**
 * Cache time-to-live in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Debounce delay in milliseconds
 */
const DEBOUNCE_DELAY = 300;

/**
 * Timer for debouncing data fetches
 */
let debounceTimer: number | null = null;

/**
 * Debounced function to fetch page data
 * Uses closure pattern to maintain timer state
 * @param slug - The page slug to fetch data for
 */
const debouncedFetchPageData = (() => {
  return (slug: string) => {
    // Clear existing timer if present
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    
    // Set new timer
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      fetchPageData(slug);
    }, DEBOUNCE_DELAY);
  };
})();

/**
 * Fetches page data from the Wagtail API with caching
 * @param slug - The page slug to fetch data for
 */
async function fetchPageData(slug: string): Promise<void> {
  // Check cache first
  const cachedEntry = getCachedData(slug);
  if (cachedEntry) {
    console.log('Using cached data for slug:', slug);
    renderPageData(cachedEntry.data, cachedEntry.error);
    return;
  }
  
  // Show loading state
  showLoading();
  
  // Fetch from API
  try {
    console.log('Fetching page data for slug:', slug);
    const pageData = await findPageBySlug(slug);
    
    // Cache the result
    setCachedData(slug, {
      data: pageData,
      timestamp: Date.now()
    });
    
    // Render the data
    renderPageData(pageData);
  } catch (error) {
    console.error('Error fetching page data:', error);
    
    // Type check for ApiError
    const apiError = error as ApiError;
    if (apiError && apiError.type && apiError.message && typeof apiError.retryable === 'boolean') {
      // Cache non-retryable errors
      if (!apiError.retryable) {
        setCachedData(slug, {
          data: null,
          error: apiError,
          timestamp: Date.now()
        });
      }
      
      renderPageData(null, apiError);
    } else {
      // Handle unexpected errors
      const unexpectedError: ApiError = {
        type: 'network',
        message: 'An unexpected error occurred',
        retryable: true
      };
      renderPageData(null, unexpectedError);
    }
  }
}

/**
 * Loads data for the current active tab
 */
async function loadCurrentPage(): Promise<void> {
  try {
    // Query current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tabs.length === 0 || !tabs[0] || !tabs[0].url) {
      console.warn('No active tab found or tab has no URL');
      showNotOnSfGov();
      return;
    }
    
    const tab = tabs[0];
    const url = tab.url!; // We've already checked it's not undefined
    
    console.log('Loading current page:', url);
    
    // Check if on SF.gov
    const onSfGov = isOnSfGov(url);
    
    if (onSfGov) {
      // Extract slug
      const slug = extractPageSlug(url);
      
      if (slug) {
        // Update current state
        currentTabState = { url, slug, isOnSfGov: true };
        
        // Fetch page data
        await fetchPageData(slug);
      } else {
        console.warn('No valid slug found for SF.gov URL');
        showNotOnSfGov();
      }
    } else {
      // Not on SF.gov
      console.log('Not on SF.gov page');
      showNotOnSfGov();
    }
  } catch (error) {
    console.error('Error loading current page:', error);
    showNotOnSfGov();
  }
}

/**
 * Cleans up side panel resources when closing
 */
function cleanup(): void {
  console.log('Side panel cleaning up');
  
  // Remove tab listeners
  removeTabListeners();
  
  // Clear debounce timer if active
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    console.log('Debounce timer cleared');
  }
}

/**
 * Initialize the side panel
 */
function initialize(): void {
  console.log('Side panel initialized');

  // Set up tab listeners
  setupTabListeners();
  
  // Load current page data
  loadCurrentPage();

  // Set up retry button listener
  const retryButton = document.getElementById('retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', handleRetryClick);
  }
  
  // Set up cleanup on unload
  window.addEventListener('beforeunload', cleanup);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOM is already loaded
  initialize();
}



/**
 * Renders page data to the UI
 * @param pageData - The page data to render (can be null if error occurred)
 * @param error - Optional error to display instead of page data
 */
function renderPageData(pageData: WagtailPage | null, error?: ApiError): void {
  // Handle error case
  if (error) {
    showError(error);
    return;
  }
  
  // Handle null data case (no error but no data)
  if (!pageData) {
    const notFoundError: ApiError = {
      type: 'not_found',
      message: 'This page is not found in the CMS',
      retryable: false
    };
    showError(notFoundError);
    return;
  }
  
  // Render successful data case
  hideLoading();
  hideError();
  showContent();

  renderPageInfo(pageData);
  renderEditLink(pageData.id);
  renderMetadata(pageData);
  renderTranslations(pageData.translations);
  renderMediaAssets(pageData.images, pageData.files);
}

/**
 * Renders page title and content type badge
 */
function renderPageInfo(pageData: WagtailPage): void {
  const pageTitleEl = document.getElementById('page-title');
  const contentTypeEl = document.getElementById('content-type');

  if (pageTitleEl) {
    pageTitleEl.textContent = pageData.title;
  }

  if (contentTypeEl) {
    // Format content type to be human-readable
    const formattedType = formatContentType(pageData.contentType);
    contentTypeEl.textContent = formattedType;
  }
}

/**
 * Renders the edit link for the current page
 */
function renderEditLink(pageId: number): void {
  const editLinkContainer = document.getElementById('edit-link-container');

  if (!editLinkContainer) {
    return;
  }

  // Clear existing content
  editLinkContainer.innerHTML = '';

  // Create edit link
  const editUrl = `https://api.sf.gov/admin/pages/${pageId}/edit/`;
  const link = document.createElement('a');
  link.href = editUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Edit in Wagtail Admin';

  editLinkContainer.appendChild(link);
}

/**
 * Formats content type string to be human-readable
 */
function formatContentType(contentType: string): string {
  // Remove common prefixes and convert to title case
  let formatted = contentType
    .replace(/^(wagtailcore\.|pages\.)/, '')
    .replace(/_/g, ' ')
    .split('.')
    .pop() || contentType;

  // Convert to title case
  formatted = formatted
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return formatted;
}

/**
 * Renders metadata including partner agency and content type
 */
function renderMetadata(pageData: WagtailPage): void {
  const partnerAgencyEl = document.getElementById('partner-agency');
  const contentTypeDetailEl = document.getElementById('content-type-detail');

  // Render partner agency
  if (partnerAgencyEl) {
    if (pageData.partnerAgency) {
      partnerAgencyEl.textContent = pageData.partnerAgency;
      partnerAgencyEl.classList.remove('empty');
    } else {
      partnerAgencyEl.textContent = 'No agency association';
      partnerAgencyEl.classList.add('empty');
    }
  }

  // Render content type detail
  if (contentTypeDetailEl) {
    const formattedType = formatContentType(pageData.contentType);
    contentTypeDetailEl.textContent = formattedType;
    contentTypeDetailEl.classList.remove('empty');
  }
}

/**
 * Renders translation links for each language version
 */
function renderTranslations(translations: Translation[]): void {
  const translationsContainer = document.getElementById('translations-container');

  if (!translationsContainer) {
    return;
  }

  // Clear existing content
  translationsContainer.innerHTML = '';

  if (translations.length === 0) {
    // Show "No translations" message
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'translations-empty';
    emptyMessage.textContent = 'No translations';
    translationsContainer.appendChild(emptyMessage);
    return;
  }

  // Create a link for each translation
  translations.forEach(translation => {
    const link = document.createElement('a');
    link.href = translation.editUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'translation-link';

    // Create language label
    const languageLabel = document.createElement('span');
    languageLabel.className = 'translation-language';
    languageLabel.textContent = translation.language;

    // Create title span
    const titleSpan = document.createElement('span');
    titleSpan.className = 'translation-title';
    titleSpan.textContent = translation.title;

    // Assemble the link
    link.appendChild(languageLabel);
    link.appendChild(titleSpan);

    translationsContainer.appendChild(link);
  });
}

/**
 * Renders media assets (images and files)
 */
function renderMediaAssets(images: MediaAsset[], files: MediaAsset[]): void {
  renderMediaList('images-container', images, 'No images');
  renderMediaList('files-container', files, 'No files');
}

/**
 * Renders a list of media assets to a container
 */
function renderMediaList(containerId: string, assets: MediaAsset[], emptyMessage: string): void {
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  // Clear existing content
  container.innerHTML = '';

  if (assets.length === 0) {
    // Show empty message
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'media-empty';
    emptyDiv.textContent = emptyMessage;
    container.appendChild(emptyDiv);
    return;
  }

  // Create an item for each asset
  assets.forEach(asset => {
    const item = document.createElement('div');
    item.className = 'media-item';

    // Create link to the asset
    const link = document.createElement('a');
    link.href = asset.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    // Use filename if available, otherwise use title or URL
    const displayText = asset.filename || asset.title || asset.url;
    link.textContent = displayText;

    item.appendChild(link);
    container.appendChild(item);
  });
}

/**
 * Shows error state with appropriate message
 */
function showError(error: ApiError): void {
  hideLoading();
  hideContent();

  const errorEl = document.getElementById('error');
  const errorMessageEl = document.getElementById('error-message');
  const retryButton = document.getElementById('retry-button');

  if (!errorEl || !errorMessageEl) {
    return;
  }

  // Set error message based on error type
  let message = error.message;

  switch (error.type) {
    case 'not_found':
      message = 'This page is not found in the CMS.';
      break;
    case 'server_error':
      message = 'CMS server error. Please try again later.';
      break;
    case 'network':
      message = 'Unable to connect to Wagtail API. Check your network connection.';
      break;
    case 'timeout':
      message = 'Request timed out after 10 seconds.';
      break;
    default:
      message = error.message || 'An unexpected error occurred.';
  }

  errorMessageEl.textContent = message;

  // Show or hide retry button based on whether error is retryable
  if (retryButton) {
    if (error.retryable) {
      retryButton.style.display = 'block';
    } else {
      retryButton.style.display = 'none';
    }
  }

  errorEl.style.display = 'flex';
}

/**
 * Shows loading state
 */
function showLoading(): void {
  hideError();
  hideContent();

  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'flex';
  }
}

/**
 * UI state management functions
 */
function hideLoading(): void {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
}

function hideError(): void {
  const errorEl = document.getElementById('error');
  if (errorEl) {
    errorEl.style.display = 'none';
  }
}

function showContent(): void {
  const contentEl = document.getElementById('content');
  if (contentEl) {
    contentEl.style.display = 'block';
  }
}

function hideContent(): void {
  const contentEl = document.getElementById('content');
  if (contentEl) {
    contentEl.style.display = 'none';
  }
}

/**
 * Handles retry button clicks
 */
function handleRetryClick(): void {
  if (!currentTabState || !currentTabState.slug) {
    console.error('No slug available for retry');
    return;
  }

  // Clear cache for this slug
  pageCache.delete(currentTabState.slug);
  
  // Fetch fresh data directly
  fetchPageData(currentTabState.slug);
}
