# Requirements Document

## Introduction

This feature enables automatic hiding and showing of the side panel based on the active tab's domain. When users switch between tabs, the side panel should only be visible when viewing pages on the *.sf.gov domain, ensuring the extension only appears when relevant content is being viewed.

## Glossary

- **Side Panel**: The Chrome extension UI panel that displays SF.gov page metadata and admin links
- **Service Worker**: The background script that manages extension lifecycle and events
- **Active Tab**: The currently focused browser tab in the active window
- **SF.gov Domain**: Any URL matching the pattern *.sf.gov (e.g., www.sf.gov, admin.sf.gov)
- **Tab Context**: The specific browser tab instance for which side panel visibility is being controlled

## Requirements

### Requirement 1

**User Story:** As a content manager, I want the side panel to automatically hide when I switch to non-SF.gov tabs, so that the extension only appears when I'm viewing relevant content

#### Acceptance Criteria

1. WHEN a user activates a tab with a URL not matching *.sf.gov, THE Service Worker SHALL disable the Side Panel for that Tab Context
2. WHEN a user activates a tab with a URL matching *.sf.gov, THE Service Worker SHALL enable the Side Panel for that Tab Context
3. WHEN a user updates a tab's URL to a non-SF.gov domain, THE Service Worker SHALL disable the Side Panel for that Tab Context
4. WHEN a user updates a tab's URL to an SF.gov domain, THE Service Worker SHALL enable the Side Panel for that Tab Context
5. WHEN the extension is installed, THE Service Worker SHALL disable the Side Panel by default for all tabs

### Requirement 2

**User Story:** As a developer, I want the domain checking logic to be centralized and reusable, so that the codebase is maintainable and consistent

#### Acceptance Criteria

1. THE Service Worker SHALL implement a single function that determines Side Panel visibility based on tab URL
2. THE Service Worker SHALL use the centralized function in both tab activation and tab update event handlers
3. THE Service Worker SHALL handle URL parsing errors without crashing the extension
4. THE Service Worker SHALL log errors to the console when Side Panel operations fail

### Requirement 3

**User Story:** As a content manager, I want the side panel state to be managed per-tab, so that each tab's side panel visibility is independent

#### Acceptance Criteria

1. WHEN the Service Worker enables the Side Panel, THE Service Worker SHALL set the enabled state for the specific Tab Context only
2. WHEN the Service Worker disables the Side Panel, THE Service Worker SHALL set the disabled state for the specific Tab Context only
3. THE Service Worker SHALL not affect Side Panel state in other tabs when updating a specific Tab Context
