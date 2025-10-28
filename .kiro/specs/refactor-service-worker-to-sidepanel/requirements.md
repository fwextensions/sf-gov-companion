# Requirements Document

## Introduction

This feature refactors the Chrome extension architecture to move most functionality from the background service worker to the side panel. Currently, the service worker monitors tab changes, detects SF.gov URLs, fetches Wagtail API data, and manages caching. This creates unnecessary background processing and complexity. The refactoring will simplify the architecture by having the side panel handle its own data fetching and tab monitoring when open, while the service worker only handles opening/closing the panel via the toolbar button.

## Glossary

- **Service Worker**: The background script that runs independently of any web page or browser tab
- **Side Panel**: The Chrome extension UI panel that displays Wagtail page information
- **Wagtail API**: The SF.gov CMS API that provides page metadata and content information
- **Tab State**: Information about the current browser tab including URL and SF.gov detection status
- **Page Cache**: Temporary storage of API responses to avoid redundant network requests

## Requirements

### Requirement 1

**User Story:** As a developer, I want the service worker to only handle toolbar button clicks, so that the extension has a simpler architecture with less background processing

#### Acceptance Criteria

1. WHEN the user clicks the toolbar button, THE Service Worker SHALL toggle the side panel open or closed for the current tab
2. THE Service Worker SHALL NOT monitor tab navigation events after the refactoring
3. THE Service Worker SHALL NOT fetch data from the Wagtail API after the refactoring
4. THE Service Worker SHALL NOT maintain tab state or page cache after the refactoring
5. THE Service Worker SHALL contain only the toolbar button click handler and basic initialization code

### Requirement 2

**User Story:** As a user, I want the side panel to automatically detect when I navigate to SF.gov pages, so that I see relevant page information without manual intervention

#### Acceptance Criteria

1. WHEN the side panel is open, THE Side Panel SHALL listen for tab navigation events
2. WHEN the active tab URL changes, THE Side Panel SHALL check if the new URL is on the SF.gov domain
3. WHEN the active tab changes to a different tab, THE Side Panel SHALL check the new tab's URL
4. IF the new URL is on SF.gov, THEN THE Side Panel SHALL extract the page slug and fetch Wagtail data
5. IF the new URL is not on SF.gov, THEN THE Side Panel SHALL display an appropriate empty or informational state

### Requirement 3

**User Story:** As a user, I want the side panel to load current page information when I open it, so that I immediately see data for the page I'm viewing

#### Acceptance Criteria

1. WHEN the side panel opens, THE Side Panel SHALL query the current active tab's URL
2. IF the current tab is on SF.gov, THEN THE Side Panel SHALL extract the page slug and fetch Wagtail data
3. IF the current tab is not on SF.gov, THEN THE Side Panel SHALL display an appropriate message indicating no SF.gov page is active
4. THE Side Panel SHALL display a loading state while fetching initial page data
5. THE Side Panel SHALL handle errors gracefully if the initial data fetch fails

### Requirement 4

**User Story:** As a user, I want the side panel to stop monitoring tabs when closed, so that the extension doesn't consume resources unnecessarily

#### Acceptance Criteria

1. WHEN the side panel is closed, THE Side Panel SHALL remove all tab event listeners
2. WHEN the side panel is closed, THE Side Panel SHALL stop any pending API requests
3. WHEN the side panel is closed, THE Side Panel SHALL clear any debounce timers
4. THE Side Panel SHALL NOT process tab navigation events when closed
5. THE Side Panel SHALL properly clean up resources to prevent memory leaks

### Requirement 5

**User Story:** As a user, I want the side panel to cache API responses, so that navigating back to previously viewed pages is fast and doesn't make redundant API calls

#### Acceptance Criteria

1. WHEN the side panel fetches page data, THE Side Panel SHALL store the response in a cache with the page slug as the key
2. WHEN the side panel needs page data for a slug, THE Side Panel SHALL check the cache before making an API request
3. THE Side Panel SHALL include a timestamp with each cached entry
4. THE Side Panel SHALL consider cached entries valid for 5 minutes
5. IF a cached entry is older than 5 minutes, THEN THE Side Panel SHALL fetch fresh data from the API

### Requirement 6

**User Story:** As a user, I want the side panel to debounce rapid navigation changes, so that the extension doesn't make excessive API calls when I quickly switch between tabs

#### Acceptance Criteria

1. WHEN tab navigation events occur in rapid succession, THE Side Panel SHALL delay processing until navigation stabilizes
2. THE Side Panel SHALL use a debounce delay of 300 milliseconds
3. IF a new navigation event occurs before the debounce timer expires, THEN THE Side Panel SHALL cancel the previous timer and start a new one
4. THE Side Panel SHALL only fetch API data after the debounce period completes without interruption
5. THE Side Panel SHALL maintain separate debounce timers for different types of navigation events if needed

### Requirement 7

**User Story:** As a user, I want the retry functionality to continue working, so that I can manually refresh page data when errors occur

#### Acceptance Criteria

1. WHEN the user clicks the retry button, THE Side Panel SHALL clear the cached entry for the current page slug
2. WHEN the user clicks the retry button, THE Side Panel SHALL immediately fetch fresh data from the Wagtail API
3. THE Side Panel SHALL display a loading state during the retry operation
4. THE Side Panel SHALL handle retry errors the same way as initial fetch errors
5. THE Side Panel SHALL update the cache with the new data if the retry succeeds
