# Implementation Plan

- [x] 1. Create Airtable type definitions





	- Create `src/types/airtable.ts` with FeedbackRecord, AirtableResponse, AirtableRecord, AirtableApiError, and AirtableConfig interfaces
	- Ensure all field mappings match the Airtable schema from the design document
	- _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.3_


- [x] 2. Implement Airtable API client



	- [x] 2.1 Create base client structure with constants and cache


		- Create `src/api/airtable-client.ts` with BASE_ID ("appo4SjothLkSxmbG"), TABLE_NAME ("Karl data"), and cache Map
		- Implement fetchWithTimeout function following wagtail-client pattern
		- _Requirements: 5.1, 5.2, 6.1_
	- [x] 2.2 Implement token management functions


		- Write getAccessToken function to retrieve token from chrome.storage.sync
		- Write setAccessToken function to store token in chrome.storage.sync
		- _Requirements: 2.2, 2.3_
	- [x] 2.3 Implement path normalization


		- Write normalizePath function to remove query params, trailing slashes, and convert to lowercase
		- Handle homepage ("/") as special case
		- _Requirements: 4.1, 4.2, 4.3, 4.5_
	- [x] 2.4 Implement feedback fetching with caching


		- Write getFeedbackByPath function with cache check and API request
		- Construct Airtable API URL with filterByFormula for path matching
		- Add sort by submission_created descending and maxRecords=5
		- Parse API response and transform to FeedbackRecord array
		- _Requirements: 1.1, 1.2, 4.4, 6.1, 6.4, 6.5_
	- [x] 2.5 Implement error handling and retry logic


		- Create createApiError helper function for different error types
		- Implement fetchWithRetry with exponential backoff
		- Map HTTP status codes to AirtableApiError types
		- _Requirements: 1.4, 2.5, 6.2_


- [x] 3. Create FeedbackCard component



	- [x] 3.1 Create base component structure


		- Create `src/sidepanel/components/FeedbackCard.tsx` with props interface
		- Set up state management for feedback, error, isLoading, and hasToken
		- Implement useEffect to fetch feedback when pagePath changes
		- _Requirements: 1.1, 5.4, 5.5_
	- [x] 3.2 Implement loading and error states


		- Create loading state UI with Card wrapper
		- Create error state UI with conditional retry button
		- Implement retry function that clears cache and refetches
		- _Requirements: 1.4, 6.3_
	- [x] 3.3 Implement token configuration UI


		- Create inline token input form with password field
		- Add save button that calls setAccessToken
		- Show configuration UI when hasToken is false
		- _Requirements: 2.1, 2.2, 2.4_
	- [x] 3.4 Implement feedback display


		- Create FeedbackItem sub-component for individual records
		- Display submission date, helpfulness badge, issue category, helpful details, and additional details
		- Style helpfulness badge with conditional colors (green for yes, orange for no)
		- Show submission ID at bottom of each item
		- Handle empty state when no feedback exists

		- _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Integrate FeedbackCard into side panel



	- [x] 4.1 Update useSfGovPage hook to export pagePath


		- Add pagePath to UseSfGovPageReturn interface
		- Extract pathname from currentUrl and export it
		- _Requirements: 1.1_
	- [x] 4.2 Add FeedbackCard to App.tsx


		- Import FeedbackCard component
		- Add FeedbackCard below existing cards when pageData exists
		- Pass pagePath prop from useSfGovPage hook
		- _Requirements: 1.2, 5.4_

- [ ]* 5. Add error boundary and edge case handling
	- Wrap FeedbackCard in error boundary to prevent side panel crashes
	- Handle edge cases: empty referrer field, malformed dates, missing fields
	- Add fallback values for null/undefined fields
	- _Requirements: 1.4_

- [ ]* 6. Write unit tests for Airtable client
	- Test normalizePath with various inputs (query params, trailing slashes, case variations, homepage)
	- Test cache hit/miss scenarios
	- Test token storage and retrieval
	- Test error handling for each error type (auth, network, timeout, rate_limit, server_error)
	- Test API response parsing and field mapping
	- _Requirements: 4.1, 4.2, 4.3, 4.5, 6.1_

- [ ]* 7. Write component tests for FeedbackCard
	- Test loading state rendering
	- Test no token state rendering
	- Test no feedback state rendering
	- Test feedback records rendering with correct data
	- Test error state rendering with retry button
	- Test token configuration flow
	- _Requirements: 1.2, 1.3, 1.4, 2.1, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
