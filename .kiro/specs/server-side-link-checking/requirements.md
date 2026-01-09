# Requirements Document

## Introduction

This specification defines a server-side link checking system for the SF.gov Wagtail Extension. The current client-side link checker is constrained by CORS limitations and cannot reliably verify redirects or access restricted resources. The server-side solution will provide more accurate link validation while preventing abuse through Wagtail authentication and supporting incremental result streaming for better user experience.

## Glossary

- **Link_Checker_Service**: The serverless function that validates HTTP/HTTPS links
- **Extension_Client**: The browser extension side panel that initiates link checks
- **Wagtail_Session**: The authenticated session cookie that proves user access to Wagtail CMS
- **Link_Batch**: A collection of URLs submitted for validation in a single request
- **Result_Stream**: Server-sent events (SSE) or chunked response delivering incremental results
- **Link_Status**: The validation state of a URL (ok, broken, redirect, timeout, error, insecure)

## Requirements

### Requirement 1: Batch Link Submission

**User Story:** As a content manager, I want to submit all page links at once, so that I don't have to wait for dozens of sequential API calls.

#### Acceptance Criteria

1. WHEN the Extension_Client initiates a link check, THE Extension_Client SHALL send all URLs in a single HTTP POST request
2. THE Link_Checker_Service SHALL accept a JSON payload containing an array of URLs with a maximum of 200 links per batch
3. WHEN a batch exceeds 200 links, THE Extension_Client SHALL split the batch into multiple requests
4. THE Link_Checker_Service SHALL validate that each URL in the batch is a valid HTTP or HTTPS URL
5. WHEN invalid URLs are present, THE Link_Checker_Service SHALL return an error response with details about invalid entries

### Requirement 2: Wagtail Authentication

**User Story:** As a system administrator, I want link checking to require Wagtail authentication, so that the endpoint cannot be abused by unauthorized users.

#### Acceptance Criteria

1. WHEN a link check request is received, THE Link_Checker_Service SHALL verify the presence of a valid Wagtail session cookie
2. THE Link_Checker_Service SHALL validate the session by making a request to the Wagtail admin API endpoint
3. WHEN the Wagtail session is invalid or missing, THE Link_Checker_Service SHALL return a 401 Unauthorized response
4. WHEN the Wagtail session is valid, THE Link_Checker_Service SHALL proceed with link validation
5. THE Extension_Client SHALL include Wagtail session cookies in the link check request headers

### Requirement 3: Incremental Result Streaming

**User Story:** As a content manager, I want to see link check results as they complete, so that I don't have to wait for all links to be checked before seeing any feedback.

#### Acceptance Criteria

1. THE Link_Checker_Service SHALL use Server-Sent Events (SSE) to stream results incrementally
2. WHEN each link validation completes, THE Link_Checker_Service SHALL immediately send the result to the client
3. THE Extension_Client SHALL display results as they arrive without waiting for the complete batch
4. WHEN all links have been checked, THE Link_Checker_Service SHALL send a completion event and close the stream
5. WHEN a stream error occurs, THE Link_Checker_Service SHALL send an error event before closing the stream

### Requirement 4: Link Validation Logic

**User Story:** As a content manager, I want accurate link status information, so that I can identify and fix broken links on SF.gov pages.

#### Acceptance Criteria

1. THE Link_Checker_Service SHALL follow HTTP redirects up to a maximum of 5 hops
2. WHEN a link returns a 2xx status code, THE Link_Checker_Service SHALL report status as "ok"
3. WHEN a link returns a 3xx status code after following redirects, THE Link_Checker_Service SHALL report status as "redirect" with the final URL
4. WHEN a link returns a 4xx or 5xx status code, THE Link_Checker_Service SHALL report status as "broken" with the status code
5. WHEN a link request times out after 10 seconds, THE Link_Checker_Service SHALL report status as "timeout"
6. WHEN a link uses HTTP protocol on an HTTPS page, THE Link_Checker_Service SHALL report status as "insecure"
7. WHEN a link validation fails due to network errors, THE Link_Checker_Service SHALL report status as "error" with error details

### Requirement 5: Rate Limiting and Resource Management

**User Story:** As a system administrator, I want the link checker to respect rate limits, so that it doesn't overwhelm external servers or consume excessive resources.

#### Acceptance Criteria

1. THE Link_Checker_Service SHALL check links with a maximum concurrency of 10 simultaneous requests
2. THE Link_Checker_Service SHALL implement a 100ms delay between starting new link checks to the same domain
3. WHEN checking links to twitter.com or x.com domains, THE Link_Checker_Service SHALL attempt validation first and only skip if validation fails
4. WHEN checking a bare https://sf.gov URL, THE Link_Checker_Service SHALL normalize it to https://www.sf.gov before validation to avoid redirect detection
5. THE Link_Checker_Service SHALL enforce a maximum execution time of 60 seconds per batch request
6. WHEN the execution time limit is reached, THE Link_Checker_Service SHALL return partial results and close the stream

### Requirement 6: Error Handling and Resilience

**User Story:** As a content manager, I want the link checker to handle errors gracefully, so that one failing link doesn't prevent other links from being checked.

#### Acceptance Criteria

1. WHEN a single link check fails, THE Link_Checker_Service SHALL continue checking remaining links
2. WHEN a network error occurs, THE Link_Checker_Service SHALL retry the request up to 2 times with exponential backoff
3. WHEN all retry attempts fail, THE Link_Checker_Service SHALL report the link status as "error"
4. THE Link_Checker_Service SHALL log all errors with request context for debugging
5. WHEN the Extension_Client loses connection to the stream, THE Extension_Client SHALL display partial results and allow retry
6. WHEN the client disconnects during streaming, THE Link_Checker_Service SHALL detect the disconnection and stop processing remaining links
7. WHEN client disconnection is detected, THE Link_Checker_Service SHALL clean up resources and terminate gracefully without errors

### Requirement 7: Client-Side Integration

**User Story:** As a content manager, I want the link checker UI to show real-time progress, so that I understand how many links have been checked and how many remain.

#### Acceptance Criteria

1. WHEN a link check starts, THE Extension_Client SHALL display a progress indicator showing checked/total counts
2. WHEN results arrive via the stream, THE Extension_Client SHALL update the UI immediately with new results
3. THE Extension_Client SHALL group results by status (broken, insecure, ok) for easy review
4. WHEN the link check completes, THE Extension_Client SHALL cache results for 10 minutes to avoid redundant checks
5. THE Extension_Client SHALL provide a "Refresh" button to clear cache and re-run the check

### Requirement 8: API Endpoint Design

**User Story:** As a developer, I want a well-defined API contract, so that the client and server can communicate reliably.

#### Acceptance Criteria

1. THE Link_Checker_Service SHALL expose a POST endpoint at `/api/link-check`
2. THE request payload SHALL be JSON with structure: `{ urls: string[], pageUrl: string }` where pageUrl is the source page URL for context
3. THE Link_Checker_Service SHALL use pageUrl to determine if the source page is HTTPS for mixed content detection
4. THE response SHALL use `Content-Type: text/event-stream` for SSE streaming
5. WHEN sending result events, THE Link_Checker_Service SHALL use format: `data: {"url": "...", "status": "...", "statusCode": 200}\n\n`
6. WHEN sending completion events, THE Link_Checker_Service SHALL use format: `data: {"type": "complete", "total": 50}\n\n`
7. WHEN sending error events, THE Link_Checker_Service SHALL use format: `data: {"type": "error", "message": "..."}\n\n`
