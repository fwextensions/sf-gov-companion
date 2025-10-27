# Implementation Plan

- [x] 1. Initialize CRXJS project and configure TypeScript






  - Run `npm create crxjs@latest` to scaffold the extension project
  - Configure TypeScript with strict mode and appropriate compiler options
  - Set up project structure with src/ directories for background, sidepanel, api, and types
  - _Requirements: 1.3_
-

- [x] 2. Define TypeScript types and interfaces







  - Create `src/types/wagtail.ts` with WagtailPage, Translation, MediaAsset, and ApiError interfaces
  - Define message type interfaces for communication between background and side panel
  - Export all types for use across the extension
  - _Requirements: 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_


-

- [x] 3. Implement Wagtail API client






  - [x] 3.1 Create API client with fetch wrapper and timeout handling

    - Write `src/api/wagtail-client.ts` with fetchWithTimeout function
    - Implement 10-second timeout using AbortController
    - Create base API URL constant for https://api.sf.gov/api/v2/
    - _Requirements: 7.4, 7.5_
  
  - [x] 3.2 Implement page lookup by slug


    - Write findPageBySlug function that queries the Wagtail API with slug parameter
    - Add `fields=*` query parameter to get all page data
    - Handle API response and return WagtailPage or null
    - _Requirements: 2.1, 2.3_
  
  - [x] 3.3 Implement response parsing and data extraction


    - Write parsePageData function to transform API response to WagtailPage interface
    - Implement extractImages function to parse image data from page content
    - Implement extractFiles function to parse file/document data from page content
    - Implement extractTranslations function to identify translated page versions
    - Extract partner agency and content type from API response
    - _Requirements: 3.1, 4.1, 5.1, 5.2, 6.1_
  
  - [x] 3.4 Implement error handling for API requests


    - Create ApiError class with type, message, statusCode, and retryable properties
    - Handle network errors and map to appropriate ApiError types
    - Handle HTTP status codes (404, 500) with specific error messages
    - Handle timeout errors from AbortController
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 4. Implement background service worker




  - [x] 4.1 Set up event listeners for tab updates


    - Create `src/background/service-worker.ts`
    - Add listener for chrome.tabs.onUpdated to detect navigation events
    - Add listener for chrome.tabs.onActivated to handle tab switching
    - Add listener for chrome.runtime.onMessage for side panel communication
    - _Requirements: 1.1, 1.2_
  
  - [x] 4.2 Implement URL detection and slug extraction


    - Write isOnSfGov function to check if URL contains sf.gov domain
    - Write extractPageSlug function to extract slug from URL path
    - Handle URLs with query parameters and trailing slashes
    - _Requirements: 1.1, 1.2, 2.1_
  
  - [x] 4.3 Implement side panel state management


    - Write openSidePanel function using chrome.sidePanel.open API
    - Write closeSidePanel function to close panel when leaving SF.gov
    - Track current tab state to avoid redundant API calls
    - _Requirements: 1.1, 1.2_
  
  - [x] 4.4 Implement page change handler with API integration


    - Write handlePageChange function that calls WagtailClient.findPageBySlug
    - Send PageDataMessage to side panel with results or errors
    - Implement debouncing (300ms) to avoid excessive API calls during navigation
    - Add in-memory caching with 5-minute TTL to reduce API calls
    - _Requirements: 2.1, 2.4, 7.1_
  
  - [x] 4.5 Handle retry requests from side panel


    - Listen for RetryMessage from side panel
    - Re-fetch page data and send updated PageDataMessage
    - Clear cache for the specific page on retry
    - _Requirements: 7.1_

- [x] 5. Create side panel UI structure






  - [x] 5.1 Create HTML structure for side panel

    - Create `src/sidepanel/sidepanel.html` with semantic HTML structure
    - Add sections for page header, edit links, metadata, media assets, and errors
    - Include loading spinner element
    - Add retry button for error states
    - _Requirements: 2.2, 3.2, 4.2, 5.3, 5.4, 6.2_
  
  - [x] 5.2 Style side panel with CSS


    - Create `src/sidepanel/sidepanel.css` with clean, readable styles
    - Style loading states, error messages, and content sections
    - Ensure responsive layout for different panel widths
    - Add hover states for interactive elements
    - _Requirements: 2.2, 3.2, 4.2, 5.3, 5.4, 6.2_
-

- [x] 6. Implement side panel logic



  - [x] 6.1 Set up message listener and state management


    - Create `src/sidepanel/sidepanel.ts`
    - Add listener for chrome.runtime.onMessage to receive PageDataMessage
    - Request current page data on panel load by sending GetCurrentPageMessage
    - _Requirements: 2.1, 2.2_


  
  - [x] 6.2 Implement rendering functions for page data

    - Write renderPageInfo function to display page title and metadata
    - Write renderEditLink function to create clickable link to admin interface


    - Format edit URL as https://api.sf.gov/admin/pages/{pageId}/edit/
    - _Requirements: 2.2, 6.2_
  
  - [x] 6.3 Implement partner agency and content type display


    - Write renderMetadata function to display partner agency name
    - Display content type in human-readable format
    - Show "No agency association" message when partner agency is missing
    - _Requirements: 3.2, 3.3, 6.2, 6.3_


  
  - [x] 6.4 Implement translation links rendering

    - Write renderTranslations function to display edit links for each language
    - Label each link with language identifier
    - Show "No translations" message when translations array is empty

    - _Requirements: 4.2, 4.3, 4.4_
  
  - [x] 6.5 Implement media assets display

    - Write renderMediaAssets function to list images and files
    - Display image filenames or URLs in a list
    - Display file names or URLs in a separate list
    - Show "No media assets" message when arrays are empty
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [x] 6.6 Implement loading and error states

    - Write showLoading function to display spinner during API requests
    - Write showError function to display error messages based on ApiError type
    - Show retry button only for retryable errors
    - Handle retry button clicks by sending RetryMessage to background
    - Display appropriate messages for 404, 500, network, and timeout errors
    - _Requirements: 2.3, 7.1, 7.2, 7.3, 7.5_

- [x] 7. Configure extension manifest





  - Create manifest.json with Manifest V3 configuration
  - Set permissions for sidePanel, tabs, and storage
  - Set host_permissions for *.sf.gov/* and https://api.sf.gov/*
  - Configure background service worker entry point
  - Configure side panel default path
  - Add extension name, version, and description
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 8. Add extension icons
  - Create or add icon files in public/icons/ directory
  - Include icons in multiple sizes (16x16, 48x48, 128x128)
  - Reference icons in manifest.json
  - _Requirements: 1.3_

- [ ] 9. Test extension functionality
  - [ ] 9.1 Load extension in Chrome and verify basic functionality
    - Load unpacked extension in Chrome
    - Navigate to SF.gov pages and verify side panel opens
    - Verify side panel closes when navigating away from SF.gov
    - Test edit link navigation to admin interface
    - _Requirements: 1.1, 1.2, 1.3, 2.2_
  
  - [ ] 9.2 Test API integration with real SF.gov pages
    - Test with various SF.gov page URLs
    - Verify correct page data is retrieved and displayed
    - Test partner agency display
    - Test translation links display
    - Test media assets display
    - _Requirements: 2.1, 2.4, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2_
  
  - [ ] 9.3 Test error handling scenarios
    - Test with pages not in CMS (should show 404 message)
    - Test with network disconnected (should show network error with retry)
    - Test timeout behavior by throttling network
    - Verify retry button functionality
    - _Requirements: 2.3, 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 9.4 Test in Firefox and Edge browsers
    - Load extension in Firefox Developer Edition
    - Load extension in Edge
    - Verify side panel behavior in each browser
    - Test all core functionality across browsers
    - _Requirements: 1.3_
