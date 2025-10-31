# Implementation Plan

- [-] 1. Create content script for admin preview monitoring




- [x] 1.1 Create admin-preview-monitor.ts content script file

  - Create new file at `src/content/admin-preview-monitor.ts`
  - Define TypeScript interfaces for `PreviewButtonState` and `PreviewMessage`
  - Implement preview button detection function with retry logic (max 5 seconds)
  - _Requirements: 1.1, 4.2, 4.3_


- [x] 1.2 Implement MutationObserver for href monitoring

  - Create MutationObserver to watch preview button href and class attributes
  - Implement debounced handler for href changes (100ms debounce)
  - Add logic to check if button is disabled before sending messages
  - _Requirements: 1.2, 2.1, 2.2_



- [x] 1.3 Implement message sending to side panel

  - Create function to send `PREVIEW_URL_UPDATE` messages with url and timestamp
  - Create function to send `PREVIEW_UNAVAILABLE` messages when button disabled
  - Add error handling and retry logic for message sending failures

  - _Requirements: 1.3, 2.2, 4.4_



- [x] 1.4 Add cleanup and lifecycle management


  - Implement cleanup function to disconnect MutationObserver
  - Add page unload listener to clean up resources
  - Add logging for debugging preview detection and monitoring
  - _Requirements: 1.5, 4.4_

-

- [x] 2. Enhance service worker for content script injection


- [x] 2.1 Add content script injection logic


  - Update `src/background/service-worker.ts` to listen for tab navigation events
  - Implement URL pattern matching for `api.sf.gov/admin/*` pages
  - Add programmatic content script injection using `chrome.scripting.executeScript`
  - Create map to track injected tabs and prevent duplicate injections
  - _Requirements: 1.1, 4.1, 4.5_

- [x] 2.2 Implement message routing


  - Add message listener in service worker to receive messages from content script
  - Implement message forwarding from content script to side panel
  - Add tab cleanup logic when tabs are closed
  - _Requirements: 1.3, 2.2, 4.5_

- [x] 3. Update manifest configuration for content script





- [ ] 3.1 Add content script configuration to manifest
  - Update `manifest.config.ts` to include content script entry
  - Configure script to run at `document_idle` for admin pages
  - Ensure proper permissions for scripting API
  - _Requirements: 1.1, 4.1_



- [x] 4. Enhance useSfGovPage hook for preview support


- [x] 4.1 Add preview state management


  - Add state variables for `previewUrl`, `isPreviewMode`, and `previewTimestamp`
  - Create `PreviewState` interface for preview tracking
  - Update `TabState` interface to include `previewUrl` field
  - _Requirements: 1.4, 3.5_

- [x] 4.2 Implement preview message listener


  - Add `chrome.runtime.onMessage` listener in hook
  - Implement handler for `PREVIEW_URL_UPDATE` messages with timestamp validation
  - Implement handler for `PREVIEW_UNAVAILABLE` messages (keep current preview URL, don't clear)
  - Add logic to ignore stale messages (older than 5 seconds)
  - Wait for initial preview state from content script before rendering iframe on admin pages
  - _Requirements: 1.4, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4_

- [x] 4.3 Update cache key generation for preview mode


  - Modify cache key logic to distinguish between preview and live content
  - Use format `${slug}:preview:${timestamp}` for preview cache keys
  - Use format `${slug}:live` for live content cache keys
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4.4 Implement preview URL override logic


  - Update `fetchPageData` to accept optional preview parameters
  - Extract preview parameters from preview URL query string
  - Pass preview parameters to API client when in preview mode
  - _Requirements: 1.4, 3.1, 3.2, 3.3_

- [x] 4.5 Fix state persistence bug


  - Add `lastValidStateRef` to track last successful page load
  - Modify `handleTabUpdate` to compare URLs before clearing state
  - Preserve `pageData` when URL unchanged (window focus changes)
  - Add visibility change listener to detect window focus changes
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_



- [x] 5. Enhance Wagtail API client for preview parameters


- [x] 5.1 Add preview parameter support to API functions


  - Update `findPageBySlug` function signature to accept optional `PreviewParams`
  - Update `findPageById` function signature to accept optional `PreviewParams`
  - Create `PreviewParams` interface with `preview` and `ts` fields
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5.2 Implement preview parameter URL construction


  - Create helper function to append preview parameters to API URLs
  - Ensure preview parameters are preserved in paginated requests
  - Handle URL construction for both slug-based and ID-based queries
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5.3 Add preview-specific error handling


  - Handle 404 errors for invalid preview URLs gracefully
  - Add specific error messages for preview unavailable scenarios
  - _Requirements: 3.4_

- [-] 6. Update side panel UI for preview m
ode indicator
- [x] 6.1 Add preview mode banner component



  - Create visual indicator banner for preview mode at top of side panel
  - Style banner with distinct amber/yellow color scheme
  - Display "Viewing draft preview" text with timestamp
  - _Requirements: 3.5_

- [x] 6.2 Update App.tsx to show preview indicator





  - Import `isPreviewMode` and `previewUrl` from `useSfGovPage` hook
  - Conditionally render preview banner when `isPreviewMode` is true
  - Add "Preview unavailable" message state when preview disabled
  - _Requirements: 3.5_

- [ ] 7. Add logging and debugging support
- [ ] 7.1 Add comprehensive logging
  - Add console logging in content script for preview detection events
  - Add logging in service worker for injection and message routing
  - Add logging in hook for preview state changes and cache operations
  - Include timestamps and relevant context in all log messages
  - _Requirements: All requirements (debugging support)_
