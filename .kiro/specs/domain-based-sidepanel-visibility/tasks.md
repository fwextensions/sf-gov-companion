# Implementation Plan

- [x] 1. Implement domain matching utility function





	- Create `isSfGovDomain()` function that checks if a URL matches *.sf.gov pattern
	- Handle URL parsing errors gracefully
	- Return boolean indicating if domain matches
	- _Requirements: 1.1, 1.2, 2.3_



- [x] 2. Implement centralized side panel update function



	- Create `updateSidePanelForTab()` async function that takes tabId and URL
	- Use `isSfGovDomain()` to determine if side panel should be enabled
	- Call `chrome.sidePanel.setOptions()` with appropriate enabled state and tabId
	- Set `path: "sidepanel.html"` when enabling
	- Wrap in try-catch and log errors without throwing
	- _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.4, 3.1, 3.2_
-

- [x] 3. Update onInstalled event handler




	- Add `chrome.sidePanel.setOptions({ enabled: false })` call to disable side panel by default
	- Keep existing `setPanelBehavior()` call
	- Keep existing console log
	- _Requirements: 1.5_

- [x] 4. Implement tab activation event handler




	- Add `chrome.tabs.onActivated` listener
	- Fetch tab details using `chrome.tabs.get()`
	- Check if tab has URL property
	- Call `updateSidePanelForTab()` with tabId and URL
	- Wrap in try-catch and log errors
	- _Requirements: 1.1, 1.2, 2.1, 2.2, 2.4, 3.1, 3.2, 3.3_

- [x] 5. Implement tab update event handler




	- Add `chrome.tabs.onUpdated` listener
	- Check if tab has URL property
	- Call `updateSidePanelForTab()` with tabId and URL
	- Wrap in try-catch and log errors
	- _Requirements: 1.3, 1.4, 2.1, 2.2, 2.4, 3.1, 3.2, 3.3_

- [ ]* 6. Manual testing
	- Test extension installation with default disabled state
	- Test tab switching between SF.gov and non-SF.gov domains
	- Test navigation within a tab between domains
	- Test multiple tabs with independent side panel states
	- Test edge cases (chrome://, about:blank, invalid URLs)
	- Verify no console errors crash the extension
	- _Requirements: All_
