/**
 * Side Panel Logic
 * Handles rendering of page data and user interactions
 */

import type {
  PageDataMessage,
  RetryMessage,
  GetCurrentPageMessage,
  WagtailPage,
  ApiError,
  Translation,
  MediaAsset
} from '../types/wagtail';

/**
 * Current page slug for retry functionality
 */
let currentSlug: string = '';

/**
 * Initialize the side panel
 */
function initializeSidePanel(): void {
  console.log('Side panel initialized');

  // Show loading state immediately
  showLoading();

  // Set up message listener
  chrome.runtime.onMessage.addListener((message: PageDataMessage) => {
    console.log('Received message:', message);
    if (message.type === 'PAGE_DATA') {
      handlePageData(message);
    }
  });

  // Request current page data on load
  requestCurrentPageData();

  // Set up retry button listener
  const retryButton = document.getElementById('retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', handleRetryClick);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSidePanel);
} else {
  // DOM is already loaded
  initializeSidePanel();
}

/**
 * Requests current page data from the background service worker
 */
function requestCurrentPageData(): void {
  console.log('Requesting current page data from service worker...');
  const message: GetCurrentPageMessage = {
    type: 'GET_CURRENT_PAGE'
  };

  chrome.runtime.sendMessage(message, (response: PageDataMessage) => {
    console.log('Received response from service worker:', response);
    console.log('Response has data:', !!response?.data);
    console.log('Response has error:', !!response?.error);
    if (chrome.runtime.lastError) {
      console.error('Chrome runtime error:', chrome.runtime.lastError);
    }
    if (response && response.type === 'PAGE_DATA') {
      handlePageData(response);
    } else {
      console.warn('No valid response received');
    }
  });
}

/**
 * Handles incoming page data messages
 */
function handlePageData(message: PageDataMessage): void {
  if (message.error) {
    showError(message.error);
  } else if (message.data) {
    currentSlug = message.data.slug;
    renderPageData(message.data);
  } else {
    showLoading();
  }
}

/**
 * Renders page data to the UI
 */
function renderPageData(pageData: WagtailPage): void {
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
  if (!currentSlug) {
    console.error('No slug available for retry');
    return;
  }

  const message: RetryMessage = {
    type: 'RETRY_FETCH',
    slug: currentSlug
  };

  showLoading();
  chrome.runtime.sendMessage(message);
}
