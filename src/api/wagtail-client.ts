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
 * @returns Promise resolving to WagtailPage or null if not found
 * @throws ApiError for network errors, timeouts, or server errors
 */
export async function findPageBySlug(slug: string): Promise<WagtailPage | null> {
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

    // Parse and return the first matching page
    return parsePageData(data.items[0]);
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
 * Parses API response data into a WagtailPage object
 * @param pageData - Raw page data from the API
 * @returns Parsed WagtailPage object
 */
function parsePageData(pageData: any): WagtailPage {
  const pageId = pageData.id;
  const editUrl = `https://api.sf.gov/admin/pages/${pageId}/edit/`;

  return {
    id: pageId,
    title: pageData.title || '',
    slug: pageData.meta?.slug || pageData.slug || '',
    contentType: pageData.meta?.type || '',
    partnerAgency: pageData.partner_agency?.title || pageData.partner_agency || undefined,
    translations: extractTranslations(pageData),
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
 * Extracts translation information from page data
 * @param pageData - Raw page data from the API
 * @returns Array of Translation objects
 */
function extractTranslations(pageData: any): Translation[] {
  const translations: Translation[] = [];

  // Check for translations in the API response
  if (pageData.translations && Array.isArray(pageData.translations)) {
    pageData.translations.forEach((trans: any) => {
      if (trans.id) {
        translations.push({
          language: trans.locale?.language_name || trans.language || '',
          languageCode: trans.locale?.language_code || trans.language_code || '',
          pageId: trans.id,
          editUrl: `https://api.sf.gov/admin/pages/${trans.id}/edit/`,
          title: trans.title || ''
        });
      }
    });
  }

  // Check for locale/language information in meta
  if (pageData.locale && pageData.locale !== 'en') {
    // This page itself is a translation
    const locale = pageData.locale;
    if (typeof locale === 'object' && locale.language_code) {
      translations.push({
        language: locale.language_name || locale.language_code,
        languageCode: locale.language_code,
        pageId: pageData.id,
        editUrl: `https://api.sf.gov/admin/pages/${pageData.id}/edit/`,
        title: pageData.title || ''
      });
    }
  }

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
