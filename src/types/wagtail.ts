/**
 * TypeScript types and interfaces for Wagtail API integration
 */

/**
 * Represents a media asset (image or document) from Wagtail
 */
export interface MediaAsset {
  id: number;
  title: string;
  url: string;
  type: 'image' | 'document';
  filename?: string;
}

/**
 * Represents a translated version of a page
 */
export interface Translation {
  language: string;
  languageCode: string;
  pageId: number;
  editUrl: string;
  title: string;
}

/**
 * Represents a Wagtail page with all relevant metadata
 */
export interface WagtailPage {
  id: number;
  title: string;
  slug: string;
  contentType: string;
  partnerAgency?: string;
  translations: Translation[];
  images: MediaAsset[];
  files: MediaAsset[];
  editUrl: string;
  meta: {
    type: string;
    detailUrl: string;
    htmlUrl: string;
  };
}

/**
 * Represents an API error with type and retry information
 */
export interface ApiError {
  type: 'network' | 'timeout' | 'not_found' | 'server_error';
  message: string;
  statusCode?: number;
  retryable: boolean;
}

/**
 * Message sent from background to side panel with page data
 */
export interface PageDataMessage {
  type: 'PAGE_DATA';
  data: WagtailPage | null;
  error?: ApiError;
}

/**
 * Message sent from side panel to background to retry fetching data
 */
export interface RetryMessage {
  type: 'RETRY_FETCH';
  slug: string;
}

/**
 * Message sent from side panel to background to get current page data
 */
export interface GetCurrentPageMessage {
  type: 'GET_CURRENT_PAGE';
}

/**
 * Union type of all message types for type-safe message handling
 */
export type ExtensionMessage = PageDataMessage | RetryMessage | GetCurrentPageMessage;
