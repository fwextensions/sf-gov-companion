# Implementation Plan

- [x] 1. Move URL detection and slug extraction utilities to side panel





  - Copy `isOnSfGov()` function from service worker to `sidepanel.ts`
  - Copy `extractPageSlug()` function from service worker to `sidepanel.ts`
  - Add TypeScript type annotations for these utility functions
  - _Requirements: 2.2, 3.2_
-

- [x] 2. Implement cache management in side panel





  - [x] 2.1 Create cache data structures and constants

    - Define `CacheEntry` interface in `sidepanel.ts`
    - Create `pageCache` Map with string keys and CacheEntry values
    - Define `CACHE_TTL` constant (5 minutes in milliseconds)
    - _Requirements: 5.1, 5.3, 5.4_
  

  - [x] 2.2 Implement cache utility functions

    - Write `getCachedData(slug: string)` function to retrieve and validate cached entries
    - Write `setCachedData(slug: string, entry: CacheEntry)` function to store cache entries
    - Write `isCacheValid(entry: CacheEntry)` function to check if cache entry is still valid
    - Write `clearCache()` function to clear all cached data
    - _Requirements: 5.2, 5.5_


- [x] 3. Implement tab monitoring in side panel




  - [x] 3.1 Create tab state tracking


    - Define `TabState` interface in `sidepanel.ts`
    - Create `currentTabState` variable to track current tab information
    - _Requirements: 2.1, 2.3_
  
  - [x] 3.2 Implement tab event listeners


    - Write `setupTabListeners()` function to register Chrome tab event listeners
    - Write `removeTabListeners()` function to unregister listeners
    - Create `onTabUpdated` handler function for `chrome.tabs.onUpdated` events
    - Create `onTabActivated` handler function for `chrome.tabs.onActivated` events
    - _Requirements: 2.1, 2.3, 4.1, 4.4_
  
  - [x] 3.3 Implement tab update handling logic


    - Write `handleTabUpdate(tabId: number, url: string)` function
    - Add logic to detect state changes by comparing with `currentTabState`
    - Add logic to update `currentTabState` when URL changes
    - Add logic to call fetch function when on SF.gov with valid slug
    - Add logic to show appropriate message when not on SF.gov
    - _Requirements: 2.2, 2.4, 2.5_

- [x] 4. Implement debounced data fetching





  - [x] 4.1 Create debounce mechanism

    - Create `debounceTimer` variable to track active timer
    - Define `DEBOUNCE_DELAY` constant (300 milliseconds)
    - Write `debouncedFetchPageData(slug: string)` function using closure pattern
    - Implement timer cancellation logic for rapid successive calls
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  

  - [ ] 4.2 Implement main data fetching function
    - Write `fetchPageData(slug: string)` async function
    - Add cache check at the beginning using `getCachedData()`
    - Add loading state display before API call
    - Import and call `findPageBySlug()` from wagtail-client
    - Add cache storage after successful fetch using `setCachedData()`
    - Add error handling with ApiError type checking
    - Add cache storage for non-retryable errors
    - Call appropriate render functions based on success or error
    - _Requirements: 5.1, 5.2, 5.5_
-

- [x] 5. Implement side panel lifecycle management



  - [x] 5.1 Create initialization function


    - Write `initialize()` function to set up side panel on load
    - Call `setupTabListeners()` during initialization
    - Call `loadCurrentPage()` to fetch initial data
    - Set up retry button event listener
    - Add `beforeunload` event listener for cleanup
    - _Requirements: 3.1, 3.2, 3.3_
  


  - [ ] 5.2 Create cleanup function
    - Write `cleanup()` function to remove listeners and clear timers
    - Call `removeTabListeners()` to unregister tab event listeners
    - Clear `debounceTimer` if active
    - Add console logging for debugging
    - _Requirements: 4.1, 4.2, 4.3, 4.5_


  
  - [ ] 5.3 Implement current page loading
    - Write `loadCurrentPage()` async function
    - Query current active tab using `chrome.tabs.query()`
    - Check if tab URL is on SF.gov using `isOnSfGov()`
    - Extract slug using `extractPageSlug()` if on SF.gov
    - Call `fetchPageData()` if valid slug exists
    - Show appropriate message if not on SF.gov
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
-

- [x] 6. Update UI rendering functions





  - [x] 6.1 Add non-SF.gov state display

    - Write `showNotOnSfGov()` function to display informational message
    - Hide loading, error, and content containers
    - Show message: "Navigate to an SF.gov page to see CMS information"
    - _Requirements: 2.5, 3.3_
  
  - [x] 6.2 Update existing render functions

    - Modify `renderPageData()` to accept optional error parameter
    - Update function signature to handle both data and error cases
    - Ensure proper state management between loading, error, and content states
    - _Requirements: 3.4, 3.5_

-

- [x] 7. Update retry functionality



  - Modify `handleRetryClick()` to work without service worker messages
  - Update to use `currentTabState.slug` instead of `currentSlug` variable
  - Add cache deletion using `pageCache.delete()`
  - Call `fetchPageData()` directly instead of sending message
  - Remove `currentSlug` global variable (replaced by `currentTabState`)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Simplify service worker




  - Remove all tab event listeners (`chrome.tabs.onUpdated`, `chrome.tabs.onActivated`)
  - Remove `chrome.runtime.onMessage` listener and all message handling functions
  - Remove `handleTabUpdate()` function
  - Remove `handlePageChange()` function
  - Remove `handleGetCurrentPage()` function
  - Remove `handleRetryFetch()` function
  - Remove `sendPageDataToSidePanel()` function
  - Remove `closeSidePanel()` function
  - Remove all utility functions (`isOnSfGov`, `extractPageSlug`, `isCacheValid`)
  - Remove all state management variables (`tabStates`, `pageCache`, `debounceTimers`)
  - Remove all interfaces and type imports except basic Chrome types
  - Keep only `chrome.runtime.onInstalled` and `chrome.action.onClicked` listeners
  - Update `chrome.action.onClicked` to simply call `chrome.sidePanel.open()`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 9. Remove obsolete message types





  - Remove `GetCurrentPageMessage` interface from `src/types/wagtail.ts`
  - Remove `RetryMessage` interface from `src/types/wagtail.ts`
  - Remove `PageDataMessage` interface from `src/types/wagtail.ts`
  - Remove `ExtensionMessage` union type from `src/types/wagtail.ts`
  - Update imports in both service worker and side panel files
  - _Requirements: 1.2, 1.3_

- [x] 10. Update side panel imports




  - Add import for `findPageBySlug` from `../api/wagtail-client`
  - Remove any imports related to Chrome message passing that are no longer needed
  - Add Chrome tabs API type imports if not already present
  - Verify all TypeScript types are properly imported
  - _Requirements: 2.1, 2.2, 3.1_

- [ ] 11. Test and verify the refactoring
  - [ ] 11.1 Test basic functionality
    - Verify toolbar button opens side panel
    - Verify side panel loads data for current SF.gov page on open
    - Verify side panel shows appropriate message on non-SF.gov pages
    - Verify tab navigation updates side panel content
    - Verify tab switching updates side panel content
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
  
  - [ ] 11.2 Test cache and debounce behavior
    - Verify cache is used for previously visited pages
    - Verify debouncing works during rapid tab switching
    - Verify cache expires after 5 minutes
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 11.3 Test error handling and retry
    - Verify error states display correctly
    - Verify retry button works for retryable errors
    - Verify retry button is hidden for non-retryable errors
    - _Requirements: 3.5, 7.1, 7.2, 7.3, 7.4_
  
  - [ ] 11.4 Test cleanup and resource management
    - Verify listeners are removed when panel closes
    - Verify no memory leaks or orphaned timers
    - Check Chrome DevTools for proper cleanup
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
