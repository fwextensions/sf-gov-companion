# Requirements Document

## Introduction

This feature enables the SF.gov Wagtail Extension to display live preview content in the side panel when users are editing pages in the Wagtail admin interface. When a content editor is working on a page in the admin interface (api.sf.gov/admin), the side panel will automatically detect and display the preview URL, updating in real-time as the editor makes changes. This provides immediate visual feedback of content modifications without requiring the editor to manually trigger previews or switch tabs.

## Glossary

- **Extension**: The SF.gov Wagtail Extension browser extension
- **Side Panel**: The browser side panel UI that displays page information
- **Admin Interface**: The Wagtail CMS admin interface hosted at api.sf.gov/admin
- **Preview Button**: The Wagtail admin UI element with attribute `data-controller="preview-button"` that contains the preview URL
- **Content Script**: A JavaScript script injected into the admin interface page to monitor DOM changes
- **Preview URL**: A URL containing `preview=true` and `ts` query parameters that displays draft content
- **Service Worker**: The extension's background script that manages extension lifecycle and messaging

## Requirements

### Requirement 1

**User Story:** As a content editor, I want the side panel to automatically show a preview of my draft changes when I'm editing a page in the Wagtail admin interface, so that I can see my modifications in real-time without leaving the admin page.

#### Acceptance Criteria

1. WHEN the user navigates to a page matching the pattern `api.sf.gov/admin/*`, THE Extension SHALL inject a content script into the page
2. WHEN the content script detects a preview button element via selector `[data-controller="preview-button"]`, THE Extension SHALL extract the href attribute from the button
3. IF the preview button does not have a disabled class, THEN THE Extension SHALL send the preview URL to the side panel
4. WHEN the side panel receives a preview URL containing `preview=true` and `ts` parameters, THE Side Panel SHALL load and display content from the preview URL instead of the live page URL
5. WHILE the user is on an admin interface page, THE Content Script SHALL monitor changes to the preview button's href attribute

### Requirement 2

**User Story:** As a content editor, I want the side panel preview to update automatically when I make changes in the admin interface, so that I always see the most current version of my draft content.

#### Acceptance Criteria

1. WHEN the preview button's href attribute changes, THE Content Script SHALL detect the change within 500 milliseconds
2. WHEN the Content Script detects an href change, THE Extension SHALL send the updated preview URL to the side panel
3. WHEN the side panel receives an updated preview URL, THE Side Panel SHALL refresh the displayed content to reflect the new preview
4. IF the preview button becomes disabled, THEN THE Extension SHALL notify the side panel that preview is unavailable
5. WHEN the user navigates away from the admin interface, THE Side Panel SHALL revert to displaying live page content based on the current tab URL

### Requirement 3

**User Story:** As a content editor, I want the side panel to handle preview URLs correctly, so that I see accurate draft content including unpublished changes.

#### Acceptance Criteria

1. WHEN the side panel receives a preview URL, THE Side Panel SHALL preserve the `preview=true` query parameter in all API requests
2. WHEN the side panel receives a preview URL, THE Side Panel SHALL preserve the `ts` query parameter in all API requests
3. WHEN making API requests with a preview URL, THE Side Panel SHALL pass preview parameters to the Wagtail API client
4. IF the preview URL becomes invalid or returns an error, THEN THE Side Panel SHALL display an error message indicating preview is unavailable
5. WHEN the side panel loads preview content, THE Side Panel SHALL display a visual indicator that the content is a draft preview

### Requirement 4

**User Story:** As a content editor, I want the extension to work reliably across different admin page types, so that I can preview content regardless of which admin view I'm using.

#### Acceptance Criteria

1. WHEN the user is on any admin interface page matching `api.sf.gov/admin/*`, THE Extension SHALL attempt to inject the content script
2. IF the preview button element is not present on the page, THEN THE Content Script SHALL wait up to 5 seconds for the element to appear
3. WHEN the preview button element appears after initial page load, THE Content Script SHALL detect it and begin monitoring
4. IF the preview button element is removed from the DOM, THEN THE Content Script SHALL stop monitoring and notify the side panel
5. WHEN the user switches between admin tabs, THE Extension SHALL ensure only the active tab's content script communicates with the side panel

### Requirement 5

**User Story:** As a content editor, I want the side panel to maintain page information when I switch windows or return to a tab, so that I don't see incorrect "no page info available" messages when the tab content hasn't changed.

#### Acceptance Criteria

1. WHEN the user switches to a different window and returns to a tab with the side panel open, THE Side Panel SHALL retain the previously loaded page information
2. WHEN the side panel loses focus and regains focus, THE Side Panel SHALL not clear existing page data unless the tab URL has changed
3. IF the tab URL has not changed since the last successful data load, THEN THE Side Panel SHALL display the cached page information
4. WHEN the side panel regains focus after being inactive, THE Side Panel SHALL verify the current tab URL matches the displayed content
5. IF the tab URL has changed while the side panel was inactive, THEN THE Side Panel SHALL fetch and display updated page information

### Requirement 6

**User Story:** As a content editor, I want the side panel to continue showing my draft preview even when the preview button becomes temporarily disabled, so that I can continue viewing my changes without interruption during save operations or other admin actions.

#### Acceptance Criteria

1. WHEN the Side Panel is displaying a preview URL and receives a PREVIEW_UNAVAILABLE message, THE Side Panel SHALL continue displaying the current preview URL
2. WHEN the preview button becomes disabled after being enabled, THE Side Panel SHALL not switch to the published version of the page
3. WHEN the Side Panel loads on an admin page, THE Side Panel SHALL wait for the initial preview state from the Content Script before rendering the iframe
4. IF a preview URL is available when the Side Panel loads, THEN THE Side Panel SHALL display the preview URL instead of the published URL
5. WHEN the user navigates away from the admin page, THE Side Panel SHALL clear the preview mode and revert to normal behavior
