# Implementation Plan: Server-Side Link Checking

## Overview

This implementation plan converts the server-side link checking design into actionable coding tasks. The implementation will replace the current client-side link checker with a server-based solution that uses Wagtail authentication and streams results via Server-Sent Events (SSE).

## Tasks

- [x] 1. Set up server-side infrastructure and types
	- Create `/api/link-check.ts` serverless function endpoint in `packages/server/api/`
	- Define TypeScript interfaces for request/response types in `@sf-gov/shared`
	- Add environment variable for Wagtail base URL to server `.env`
	- _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Extract and share Wagtail session authentication
	- [x] 2.1 Extract `validateWagtailSession()` to shared utility
		- Create `packages/server/lib/auth.ts` with `validateWagtailSession()` function
		- Move the existing function from `feedback.ts` to the new shared module
		- Update `feedback.ts` to import from shared module
		- Ensure the function accepts sessionId and wagtailApiUrl parameters
		- _Requirements: 2.1, 2.2, 2.3, 2.4_
	
	- [ ]* 2.2 Write unit tests for session validation
		- Test valid session returns true
		- Test invalid session returns false
		- Test missing cookies returns false
		- Test network errors return false
		- _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Implement request validation and parsing
	- [x] 3.1 Create request payload validation
		- Validate JSON structure matches `LinkCheckRequest` interface
		- Validate `urls` array exists and contains valid HTTP/HTTPS URLs
		- Validate `pageUrl` is a valid URL
		- Enforce maximum 200 URLs per batch
		- Return 400 error with details for invalid requests
		- _Requirements: 1.2, 1.4, 1.5_
	
	- [ ]* 3.2 Write unit tests for request validation
		- Test valid requests pass validation
		- Test invalid URL formats are rejected
		- Test batches over 200 URLs are rejected
		- Test missing required fields are rejected
		- _Requirements: 1.2, 1.4, 1.5_

- [x] 4. Implement SSE streaming infrastructure
	- [x] 4.1 Create SSE helper functions
		- Implement `sendSSE(res, data)` to send formatted SSE events
		- Implement `closeSSE(res)` to properly close the stream
		- Set appropriate headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
		- _Requirements: 3.1, 3.2, 8.4, 8.5, 8.6, 8.7_
	
	- [x] 4.2 Implement client disconnection detection
		- Listen for `res.on('close')` event
		- Set flag to stop processing remaining links
		- Clean up resources when disconnection detected
		- _Requirements: 6.6, 6.7_

- [x] 5. Implement core link validation logic
	- [x] 5.1 Create `checkLink()` function
		- Make HEAD request with 10-second timeout
		- Follow redirects up to 5 hops
		- Detect mixed content (HTTP on HTTPS page)
		- Map HTTP status codes to link statuses (ok, broken, redirect, timeout, error, insecure)
		- Return `LinkCheckResultEvent` with url, status, statusCode, finalUrl, error
		- _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
	
	- [x] 5.2 Implement retry logic with exponential backoff
		- Retry failed requests up to 2 times
		- Use exponential backoff (100ms, 200ms)
		- Return error status after all retries exhausted
		- _Requirements: 6.2, 6.3_
	
	- [x] 5.3 Add domain-specific handling
		- Normalize bare `https://sf.gov` to `https://www.sf.gov`
		- Handle twitter.com/x.com domains (attempt validation, skip only if fails)
		- _Requirements: 5.3, 5.4_
	
	- [ ]* 5.4 Write unit tests for link validation
		- Test 2xx status returns "ok"
		- Test 4xx/5xx status returns "broken"
		- Test redirects return "redirect" with finalUrl
		- Test timeout returns "timeout"
		- Test HTTP on HTTPS page returns "insecure"
		- Test network errors return "error"
		- Test sf.gov normalization
		- _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.4_

- [x] 6. Implement rate limiting and concurrency control
	- [x] 6.1 Create concurrent link checker with rate limiting
		- Process links with maximum 10 concurrent requests
		- Implement 100ms delay between requests to same domain
		- Track domain request timing to enforce delays
		- Stream results as each link completes
		- _Requirements: 5.1, 5.2, 3.2_
	
	- [x] 6.2 Add execution time limit
		- Enforce 60-second maximum execution time per batch
		- Send partial results if time limit reached
		- Send completion event with checked count
		- _Requirements: 5.5, 5.6_
	
	- [ ]* 6.3 Write unit tests for rate limiting
		- Test maximum 10 concurrent requests
		- Test domain delay enforcement
		- Test execution time limit
		- _Requirements: 5.1, 5.2, 5.5_

- [ ] 7. Checkpoint - Ensure server tests pass
	- Run all server-side tests
	- Verify authentication, validation, and link checking logic
	- Ask user if questions arise

- [x] 8. Implement main request handler
	- [x] 8.1 Wire together authentication, validation, and streaming
		- Check HTTP method is POST
		- Extract and validate Wagtail session cookies
		- Validate request payload
		- Open SSE stream
		- Process links with rate limiting and concurrency control
		- Send results incrementally via SSE
		- Handle errors and send error events
		- Send completion event when done
		- Close stream properly
		- _Requirements: 2.5, 3.3, 3.4, 3.5, 6.1, 6.4_
	
	- [ ]* 8.2 Write integration tests for request handler
		- Test full flow with valid authentication
		- Test 401 response with invalid authentication
		- Test SSE stream with multiple links
		- Test error handling
		- _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

- [x] 9. Create client-side API client
	- [x] 9.1 Implement `LinkCheckClient` class in `packages/extension/src/api/link-check-client.ts`
		- Create class with `startCheck()` and `abort()` methods
		- Use EventSource for SSE connection
		- Parse SSE events and call appropriate callbacks (onResult, onComplete, onError)
		- Handle connection errors and retries
		- Support aborting in-progress checks
		- _Requirements: 3.3, 6.5, 7.2_
	
	- [ ]* 9.2 Write unit tests for LinkCheckClient
		- Test successful check flow
		- Test error handling
		- Test abort functionality
		- Test SSE event parsing
		- _Requirements: 3.3, 6.5_

- [x] 10. Update LinkCheckerCard component
	- [x] 10.1 Replace client-side checking with server API
		- Remove `chrome.scripting.executeScript` code
		- Import and use `LinkCheckClient`
		- Update state management for incremental results
		- Add progress indicator showing checked/total counts
		- Group results by status (broken, insecure, ok)
		- _Requirements: 7.1, 7.2, 7.3_
	
	- [x] 10.2 Implement result caching
		- Cache results for 10 minutes per page URL
		- Add "Refresh" button to clear cache and re-run check
		- Display cached results immediately when available
		- _Requirements: 7.4, 7.5_
	
	- [x] 10.3 Update UI for real-time feedback
		- Show progress bar or spinner during check
		- Update results list as events arrive
		- Display error messages appropriately
		- Show completion status
		- _Requirements: 7.1, 7.2, 7.3_

- [ ] 11. Handle batch splitting for large link sets
	- [ ] 11.1 Implement client-side batch splitting
		- Split link arrays larger than 200 into multiple batches
		- Send batches sequentially
		- Aggregate results from multiple batches
		- Update progress across all batches
		- _Requirements: 1.3_

- [x] 12. Add error logging and monitoring
	- [x] 12.1 Implement server-side error logging
		- Log authentication failures with context
		- Log link check errors with URL and error details
		- Log client disconnections
		- Use structured logging format
		- _Requirements: 6.4_

- [ ] 13. Final checkpoint - End-to-end testing
	- Test complete flow from extension to server and back
	- Verify authentication works with real Wagtail session
	- Test with various link types (ok, broken, redirect, timeout)
	- Test with large batches (100+ links)
	- Verify SSE streaming works correctly
	- Test error scenarios (invalid auth, network errors, timeouts)
	- Ensure all tests pass
	- Ask user if questions arise

- [ ] 14. Update documentation
	- [ ] 14.1 Update README with server-side link checking details
		- Document new API endpoint
		- Explain authentication requirements
		- Describe SSE streaming approach
		- _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The implementation replaces the existing client-side link checker
- SSE streaming provides real-time feedback without blocking
- Wagtail authentication prevents abuse of the link checking endpoint
