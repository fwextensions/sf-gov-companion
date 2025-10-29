/**
 * Wagtail API Client
 * Handles communication with the SF.gov Wagtail CMS API
 */

import type { WagtailPage, ApiError, MediaAsset, Translation } from '../types/wagtail';

/**
 * Base URL for the Wagtail API
 */
const BASE_API_URL = 'https://api.sf.gov/api/v2/';

/**
 * Default timeout for API requests in milliseconds
 */
const DEFAULT_TIMEOUT = 10000;

/**
 * Fetches a URL with a timeout using AbortController
 * @param url - The URL to fetch
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to the Response
 * @throws ApiError if the request times out or fails
 */
async function fetchWithTimeout(url: string, timeout: number = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw createApiError('timeout', 'Request timed out after 10 seconds');
    }

    throw error;
  }
}

/**
 * Finds a Wagtail page by its slug
 * @param slug - The page slug to search for
 * @param currentUrl - Optional current URL to determine which locale version to use
 * @returns Promise resolving to WagtailPage or null if not found
 * @throws ApiError for network errors, timeouts, or server errors
 */
export async function findPageBySlug(slug: string, currentUrl?: string): Promise<WagtailPage | null> {
  try {
    const url = `${BASE_API_URL}pages/?slug=${encodeURIComponent(slug)}&fields=*`;
    const response = await fetchWithTimeout(url);

    // Handle HTTP error status codes
    if (response.status === 404) {
      throw createApiError('not_found', 'This page is not found in the CMS', 404);
    }

    if (response.status === 500) {
      throw createApiError('server_error', 'CMS server error. Please try again later.', 500);
    }

    if (!response.ok) {
      throw createApiError('network', `HTTP error ${response.status}`, response.status);
    }

    const data = await response.json();

    // Check if any pages were returned
    if (!data.items || data.items.length === 0) {
      return null;
    }

    // If multiple items returned (translations), determine which one matches the current URL
    let currentPageData = data.items[0];

    if (data.items.length > 1 && currentUrl) {
      // Try to match based on the URL path
      const matchedPage = data.items.find((item: any) => {
        const htmlUrl = item.meta?.html_url;
        if (htmlUrl) {
          try {
            const apiUrlObj = new URL(htmlUrl);
            const currentUrlObj = new URL(currentUrl);
            // Compare the pathname (which includes locale prefix like /fil/)
            return apiUrlObj.pathname === currentUrlObj.pathname;
          } catch (e) {
            return false;
          }
        }
        return false;
      });

      if (matchedPage) {
        currentPageData = matchedPage;
      }
    }

    // Fetch full page details from the detail URL
    const detailUrl = currentPageData.meta?.detail_url;
    if (!detailUrl) {
      throw createApiError('network', 'Page detail URL not found in API response');
    }

    console.log('Fetching full page details from:', detailUrl);
    const detailResponse = await fetchWithTimeout(detailUrl);

    if (!detailResponse.ok) {
      throw createApiError('network', `Failed to fetch page details: HTTP ${detailResponse.status}`, detailResponse.status);
    }

    const fullPageData = await detailResponse.json();

    // Parse the full page data with all translations
    return parsePageDataWithTranslations(fullPageData, data.items);
  } catch (error) {
    // Re-throw ApiErrors as-is
    if (isApiError(error)) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw createApiError('network', 'Unable to connect to Wagtail API. Check your network connection.');
    }

    // Handle unexpected errors
    throw createApiError('network', 'An unexpected error occurred');
  }
}

/**
 * Parses API response data into a WagtailPage object with translations from all items
 * @param pageData - Raw page data from the API for the current page
 * @param allItems - All items returned from the API (including translations)
 * @returns Parsed WagtailPage object
 */
function parsePageDataWithTranslations(pageData: any, allItems: any[]): WagtailPage {
  const pageId = pageData.id;
  const editUrl = `https://api.sf.gov/admin/pages/${pageId}/edit/`;

  // Extract primary agency information
  let primaryAgency = undefined;
  if (pageData.primary_agency && typeof pageData.primary_agency === 'object') {
    primaryAgency = {
      id: pageData.primary_agency.id,
      title: pageData.primary_agency.title || '',
      url: pageData.primary_agency.meta?.html_url || ''
    };
  }

  return {
    id: pageId,
    title: pageData.title || '',
    slug: pageData.meta?.slug || pageData.slug || '',
    contentType: pageData.meta?.type || '',
    primaryAgency,
    translations: extractTranslationsFromItems(allItems),
    images: extractImages(pageData),
    files: extractFiles(pageData),
    editUrl,
    meta: {
      type: pageData.meta?.type || '',
      detailUrl: pageData.meta?.detail_url || '',
      htmlUrl: pageData.meta?.html_url || ''
    }
  };
}

/**
 * Extracts image data from page content
 * @param pageData - Raw page data from the API
 * @returns Array of MediaAsset objects for images
 */
function extractImages(pageData: any): MediaAsset[] {
  const images: MediaAsset[] = [];

  // Helper function to recursively search for images in nested objects
  function findImages(obj: any): void {
    if (!obj || typeof obj !== 'object') return;

    // Check if this object represents an image
    if (obj.type === 'image' && obj.value) {
      const imageData = obj.value;
      if (imageData.id) {
        images.push({
          id: imageData.id,
          title: imageData.title || imageData.alt || '',
          url: imageData.url || imageData.full_url || '',
          type: 'image',
          filename: imageData.filename
        });
      }
    }

    // Check for image fields in the object
    if (obj.image && typeof obj.image === 'object') {
      if (obj.image.id) {
        images.push({
          id: obj.image.id,
          title: obj.image.title || obj.image.alt || '',
          url: obj.image.url || obj.image.full_url || '',
          type: 'image',
          filename: obj.image.filename
        });
      }
    }

    // Recursively search arrays and objects
    if (Array.isArray(obj)) {
      obj.forEach(item => findImages(item));
    } else {
      Object.values(obj).forEach(value => findImages(value));
    }
  }

  findImages(pageData);

  // Remove duplicates based on ID
  const uniqueImages = Array.from(
    new Map(images.map(img => [img.id, img])).values()
  );

  return uniqueImages;
}

/**
 * Extracts file/document data from page content
 * @param pageData - Raw page data from the API
 * @returns Array of MediaAsset objects for files
 */
function extractFiles(pageData: any): MediaAsset[] {
  const files: MediaAsset[] = [];

  // Helper function to recursively search for documents in nested objects
  function findFiles(obj: any): void {
    if (!obj || typeof obj !== 'object') return;

    // Check if this object represents a document
    if (obj.type === 'document' && obj.value) {
      const docData = obj.value;
      if (docData.id) {
        files.push({
          id: docData.id,
          title: docData.title || docData.filename || '',
          url: docData.url || docData.download_url || '',
          type: 'document',
          filename: docData.filename
        });
      }
    }

    // Check for document fields in the object
    if (obj.document && typeof obj.document === 'object') {
      if (obj.document.id) {
        files.push({
          id: obj.document.id,
          title: obj.document.title || obj.document.filename || '',
          url: obj.document.url || obj.document.download_url || '',
          type: 'document',
          filename: obj.document.filename
        });
      }
    }

    // Recursively search arrays and objects
    if (Array.isArray(obj)) {
      obj.forEach(item => findFiles(item));
    } else {
      Object.values(obj).forEach(value => findFiles(value));
    }
  }

  findFiles(pageData);

  // Remove duplicates based on ID
  const uniqueFiles = Array.from(
    new Map(files.map(file => [file.id, file])).values()
  );

  return uniqueFiles;
}

/**
 * Extracts translation information from all items returned by the API
 * @param allItems - All page items from the API response (same slug, different locales)
 * @returns Array of Translation objects
 */
function extractTranslationsFromItems(allItems: any[]): Translation[] {
  const translations: Translation[] = [];
  const seenPageIds = new Set<number>();

  // Map of locale codes to language names
  const localeNames: Record<string, string> = {
    'en': 'English',
    'es': 'Español',
    'zh': '中文',
    'fil': 'Filipino',
    'vi': 'Tiếng Việt',
    'ru': 'Русский'
  };

  // Process each item as a translation
  allItems.forEach((item: any) => {
    if (item.id && !seenPageIds.has(item.id)) {
      const locale = item.meta?.locale || 'en';
      const languageCode = typeof locale === 'string' ? locale : locale.language_code || 'en';
      const languageName = localeNames[languageCode] || languageCode.toUpperCase();

      translations.push({
        language: languageName,
        languageCode: languageCode,
        pageId: item.id,
        editUrl: `https://api.sf.gov/admin/pages/${item.id}/edit/`,
        title: item.title || ''
      });
      seenPageIds.add(item.id);
    }
  });

  // Sort translations: English first, then alphabetically by language code
  translations.sort((a, b) => {
    if (a.languageCode === 'en') return -1;
    if (b.languageCode === 'en') return 1;
    return a.languageCode.localeCompare(b.languageCode);
  });

  return translations;
}

/**
 * Creates an ApiError object with the specified properties
 * @param type - The error type
 * @param message - The error message
 * @param statusCode - Optional HTTP status code
 * @returns ApiError object
 */
function createApiError(
  type: 'network' | 'timeout' | 'not_found' | 'server_error',
  message: string,
  statusCode?: number
): ApiError {
  return {
    type,
    message,
    statusCode,
    retryable: type !== 'not_found' // All errors except 404 are retryable
  };
}

/**
 * Type guard to check if an error is an ApiError
 * @param error - The error to check
 * @returns True if the error is an ApiError
 */
function isApiError(error: any): error is ApiError {
  return (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    'message' in error &&
    'retryable' in error
  );
}
