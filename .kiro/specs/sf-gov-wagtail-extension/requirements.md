# Requirements Document

## Introduction

This document specifies requirements for a cross-browser extension that provides content management information for the SF.gov website. The extension displays a side panel when users navigate SF.gov pages, showing metadata and administrative links retrieved from the Wagtail CMS API. The extension enables content editors and administrators to quickly access editing interfaces and view page metadata without leaving the public-facing website.

## Glossary

- **Extension**: The browser extension application built using CRXJS framework
- **Side Panel**: A browser UI panel that appears alongside the main browser window
- **Wagtail API**: The public REST API available at https://api.sf.gov/api/v2/ that provides CMS data
- **Page Slug**: The URL-friendly identifier for a Wagtail page
- **Page ID**: The unique numeric identifier for a page in the Wagtail CMS
- **Content Type**: The Wagtail model/template type used to render a page
- **Partner Agency**: The government organization associated with a page
- **Admin Interface**: The Wagtail CMS editing interface at https://api.sf.gov/admin/

## Requirements

### Requirement 1

**User Story:** As a content editor, I want the extension to activate only on SF.gov pages, so that it doesn't interfere with my browsing on other websites

#### Acceptance Criteria

1. WHEN the user navigates to a URL with domain "sf.gov", THE Extension SHALL activate the side panel
2. WHEN the user navigates to a URL without domain "sf.gov", THE Extension SHALL deactivate the side panel
3. THE Extension SHALL support Chrome, Firefox, and Edge browsers

### Requirement 2

**User Story:** As a content editor, I want to see a direct link to edit the current page, so that I can quickly access the CMS editor

#### Acceptance Criteria

1. WHEN the side panel displays page information, THE Extension SHALL query the Wagtail API using the current page slug
2. WHEN the Wagtail API returns a page ID, THE Extension SHALL display a clickable link to https://api.sf.gov/admin/pages/{page_id}/edit/
3. IF the Wagtail API returns no matching page, THEN THE Extension SHALL display a message indicating the page was not found in the CMS
4. THE Extension SHALL complete the API query and display results within 3 seconds of page load

### Requirement 3

**User Story:** As a content editor, I want to see which partner agency owns the current page, so that I know which organization is responsible for the content

#### Acceptance Criteria

1. WHEN the Wagtail API returns page data, THE Extension SHALL extract the partner agency information from the JSON response
2. WHEN partner agency data exists, THE Extension SHALL display the agency name in the side panel
3. IF no partner agency data exists, THEN THE Extension SHALL display a message indicating no agency association

### Requirement 4

**User Story:** As a multilingual content editor, I want to see links to edit other language versions of the current page, so that I can manage translations efficiently

#### Acceptance Criteria

1. WHEN the Wagtail API returns page data, THE Extension SHALL identify all translated versions of the page
2. WHEN translated versions exist, THE Extension SHALL display edit links for each language version
3. THE Extension SHALL label each link with the corresponding language identifier
4. IF no translations exist, THEN THE Extension SHALL display a message indicating the page has no translations

### Requirement 5

**User Story:** As a content editor, I want to see a list of images and files linked from the current page, so that I can audit and manage media assets

#### Acceptance Criteria

1. WHEN the Wagtail API returns page data, THE Extension SHALL extract all image references from the page content
2. WHEN the Wagtail API returns page data, THE Extension SHALL extract all file references from the page content
3. THE Extension SHALL display image filenames or URLs in a list within the side panel
4. THE Extension SHALL display file names or URLs in a list within the side panel
5. IF no images or files are linked, THEN THE Extension SHALL display a message indicating no media assets

### Requirement 6

**User Story:** As a developer, I want to see the content type used for the current page, so that I understand which Wagtail model is rendering the content

#### Acceptance Criteria

1. WHEN the Wagtail API returns page data, THE Extension SHALL extract the content type information
2. THE Extension SHALL display the content type name in the side panel
3. THE Extension SHALL display the content type in a human-readable format

### Requirement 7

**User Story:** As a user, I want the extension to handle API errors gracefully, so that temporary network issues don't break the extension

#### Acceptance Criteria

1. IF the Wagtail API request fails with a network error, THEN THE Extension SHALL display an error message with retry option
2. IF the Wagtail API returns a 404 status code, THEN THE Extension SHALL display a message indicating the page is not in the CMS
3. IF the Wagtail API returns a 500 status code, THEN THE Extension SHALL display a message indicating a server error
4. THE Extension SHALL implement a timeout of 10 seconds for API requests
5. IF an API request exceeds the timeout, THEN THE Extension SHALL display a timeout error message
