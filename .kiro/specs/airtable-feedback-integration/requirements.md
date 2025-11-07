# Requirements Document

## Introduction

This feature integrates Airtable feedback data into the SF.gov Wagtail Extension side panel. When users navigate to SF.gov pages, the extension will query an Airtable database to retrieve user feedback submissions associated with the current page path and display them in a dedicated card component.

## Glossary

- **Extension**: The SF.gov Wagtail Extension browser extension
- **Side Panel**: The browser side panel UI that displays page information
- **Airtable Base**: The Airtable database containing user feedback submissions (ID: appo4SjothLkSxmbG)
- **Feedback Table**: The Airtable table storing feedback records (ID: tblbhivrMRm5X8eSU)
- **Page Path**: The absolute path portion of the SF.gov URL (e.g., "/new-laguna-honda") used for matching against the Airtable `referrer` column
- **Personal Access Token**: Airtable authentication credential with read permissions
- **Feedback Record**: A single user feedback submission from Airtable
- **Airtable Client**: The API client module that communicates with Airtable REST API
- **Feedback Card**: The React component that displays feedback data in the side panel

## Requirements

### Requirement 1

**User Story:** As a content manager, I want to see user feedback for the current SF.gov page, so that I can understand user sentiment and issues without leaving the browser

#### Acceptance Criteria

1. WHEN the Extension side panel opens on an SF.gov page, THE Airtable Client SHALL extract the Page Path from the current URL and query the Feedback Table
2. WHEN the Airtable Client receives feedback records, THE Feedback Card SHALL display all matching submissions in the Side Panel
3. WHEN no feedback records match the current Page Path, THE Feedback Card SHALL display a message indicating no feedback is available
4. WHEN the Airtable API returns an error, THE Feedback Card SHALL display an error message to the user
5. WHEN multiple feedback records exist for a page, THE Feedback Card SHALL display all records sorted by submission date descending

### Requirement 2

**User Story:** As a content manager, I want to configure my Airtable access token, so that the extension can authenticate with my Airtable account

#### Acceptance Criteria

1. THE Extension SHALL provide a configuration interface for entering the Personal Access Token
2. WHEN a user enters a Personal Access Token, THE Extension SHALL store the token in chrome.storage.sync
3. WHEN the Airtable Client makes API requests, THE Airtable Client SHALL retrieve the Personal Access Token from chrome.storage.sync
4. WHEN no Personal Access Token is configured, THE Feedback Card SHALL display a message prompting token configuration
5. WHEN an invalid Personal Access Token is used, THE Airtable Client SHALL return an authentication error

### Requirement 3

**User Story:** As a content manager, I want to see detailed feedback information including helpfulness ratings and user comments, so that I can identify specific issues and positive feedback

#### Acceptance Criteria

1. THE Feedback Card SHALL display the submission ID field for each Feedback Record
2. THE Feedback Card SHALL display the submission creation date field for each Feedback Record
3. THE Feedback Card SHALL display the helpfulness rating field (wasTheLastPageYouViewedHelpful) for each Feedback Record
4. THE Feedback Card SHALL display the issue category field (whatWasWrongWithThePage1) for each Feedback Record
5. THE Feedback Card SHALL display the helpful details field (whatWasHelpful) for each Feedback Record
6. THE Feedback Card SHALL display the additional details field (shareMoreDetails) for each Feedback Record

### Requirement 4

**User Story:** As a content manager, I want the extension to match feedback to pages accurately, so that I only see relevant feedback for the current page

#### Acceptance Criteria

1. THE Airtable Client SHALL extract the Page Path from the current URL by using the pathname property and ignoring query parameters
2. WHEN comparing the Page Path to the referrer field, THE Airtable Client SHALL normalize both paths by removing trailing slashes
3. WHEN comparing the Page Path to the referrer field, THE Airtable Client SHALL perform case-insensitive matching
4. THE Airtable Client SHALL use Airtable filterByFormula to query records where the referrer field matches the normalized Page Path
5. WHEN the current Page Path is the homepage ("/"), THE Airtable Client SHALL match feedback records with referrer values of "/" or empty string

### Requirement 5

**User Story:** As a developer, I want the Airtable integration to follow the existing extension architecture patterns, so that the codebase remains maintainable and consistent

#### Acceptance Criteria

1. THE Airtable Client SHALL be implemented in a dedicated module at src/api/airtable-client.ts
2. THE Airtable Client SHALL follow the same error handling patterns as the existing wagtail-client module
3. THE Airtable Client SHALL define TypeScript interfaces for all Airtable response types in src/types/airtable.ts
4. THE Feedback Card SHALL be implemented as a React component in src/sidepanel/components/FeedbackCard.tsx
5. THE Feedback Card SHALL use the existing Card component as its base layout component

### Requirement 6

**User Story:** As a content manager, I want the feedback data to load efficiently, so that the side panel remains responsive

#### Acceptance Criteria

1. THE Airtable Client SHALL implement request caching with a 5-minute cache duration
2. WHEN the Airtable API rate limit is exceeded, THE Airtable Client SHALL implement exponential backoff retry logic
3. THE Feedback Card SHALL display a loading state while fetching feedback data
4. THE Airtable Client SHALL limit API requests to a maximum of 5 records per query sorted by submission date descending
5. WHEN the Feedback Table contains more than 5 matching records, THE Feedback Card SHALL display only the 5 most recent submissions
