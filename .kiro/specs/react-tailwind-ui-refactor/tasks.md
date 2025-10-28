# Implementation Plan

- [x] 1. Install and configure Tailwind CSS v4





  - Install Tailwind CSS v4 packages (@tailwindcss/vite@next, tailwindcss@next)
  - Create tailwind.config.ts with content paths for sidepanel
  - Create src/sidepanel/index.css with Tailwind imports
  - Update vite.config.ts to include Tailwind plugin
  - _Requirements: 2.1, 2.3_

- [x] 2. Set up React entry point and base structure





  - Update src/sidepanel/index.html to have a root div for React mounting
  - Create src/sidepanel/main.tsx as React entry point with ReactDOM.createRoot
  - Create src/sidepanel/App.tsx as root component with basic structure
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 3. Create base Card component
  - Create src/sidepanel/components/Card.tsx with title and children props
  - Implement consistent Tailwind styling for card container (background, border, shadow, padding)
  - Add optional title rendering with consistent typography
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_


- [x] 4. Create state display components





- [x] 4.1 Create LoadingState component

  - Create src/sidepanel/components/LoadingState.tsx
  - Implement spinner animation and loading text using Tailwind utilities
  - _Requirements: 6.1, 6.5_

- [x] 4.2 Create ErrorState component


  - Create src/sidepanel/components/ErrorState.tsx with error and onRetry props
  - Implement error icon, message display, and conditional retry button
  - Style with Tailwind utilities for error states
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [x] 5. Create custom hook for data fetching





  - Create src/sidepanel/hooks/useSfGovPage.ts
  - Implement Chrome tab listeners (onUpdated, onActivated) with useEffect
  - Implement URL parsing and slug extraction logic
  - Implement in-memory cache with TTL using useRef
  - Implement debounced data fetching with useRef for timer
  - Implement retry functionality with useCallback
  - Return pageData, error, isLoading, isOnSfGov, currentUrl, and retry function
  - _Requirements: 1.3, 5.5_
-

- [x] 6. Create content display components




- [x] 6.1 Create PageHeader component


  - Create src/sidepanel/components/PageHeader.tsx with title and contentType props
  - Implement formatContentType utility function
  - Display title and formatted content type badge with Tailwind styling
  - _Requirements: 1.4, 4.1_

- [x] 6.2 Create EditLinkCard component


  - Create src/sidepanel/components/EditLinkCard.tsx with pageId prop
  - Use base Card component with title "Edit Page"
  - Render external link to Wagtail admin edit page
  - _Requirements: 1.4, 1.5, 4.2_

- [x] 6.3 Create MetadataCard component


  - Create src/sidepanel/components/MetadataCard.tsx with partnerAgency and contentType props
  - Use base Card component with title "Metadata"
  - Implement grid layout for label-value pairs
  - Handle empty state for missing partner agency
  - _Requirements: 1.4, 4.3_

- [x] 6.4 Create TranslationsCard component


  - Create src/sidepanel/components/TranslationsCard.tsx with translations prop
  - Use base Card component with title "Translations"
  - Render list of translation links with language badges
  - Display empty state message when no translations
  - _Requirements: 1.4, 1.5, 4.4_

- [x] 6.5 Create MediaAssetsCard component


  - Create src/sidepanel/components/MediaAssetsCard.tsx with images and files props
  - Use base Card component with title "Media Assets"
  - Implement two subsections for images and files
  - Render media item links with external link styling
  - Display empty state messages for each subsection
  - _Requirements: 1.4, 1.5, 4.5_

- [x] 7. Wire up App component





  - Implement useSfGovPage hook in App.tsx
  - Add conditional rendering for loading, error, and content states
  - Render LoadingState when isLoading is true
  - Render ErrorState when error exists with retry handler
  - Render PageHeader and all card components when pageData exists
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1_

- [ ] 8. Clean up old files and verify build
  - Remove src/sidepanel/sidepanel.ts
  - Remove src/sidepanel/sidepanel.css
  - Remove src/components/HelloWorld.tsx
  - Verify no imports reference removed files
  - Run build command to ensure successful compilation
  - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4_

- [ ]* 9. Test the refactored side panel
  - Test loading state displays correctly
  - Test error state with retryable and non-retryable errors
  - Test content display with valid page data
  - Test tab change detection and data fetching
  - Test cache functionality prevents duplicate API calls
  - Test retry button clears cache and refetches
  - Test "not on SF.gov" message displays appropriately
  - _Requirements: 1.1, 1.2, 1.5, 6.1, 6.2, 6.3, 6.4, 6.5_
