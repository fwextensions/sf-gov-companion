# Design Document

## Overview

This feature implements domain-based visibility control for the Chrome extension side panel. The service worker will listen to tab activation and URL update events, checking if the active tab's URL matches the *.sf.gov domain pattern. Based on this check, it will enable or disable the side panel for that specific tab context.

The implementation follows Chrome's extension API patterns for side panel management and uses per-tab configuration to ensure independent state management across browser tabs.

## Architecture

### Component Overview

```
Service Worker (service-worker.ts)
├── Event Listeners
│   ├── chrome.runtime.onInstalled
│   ├── chrome.tabs.onActivated
│   ├── chrome.tabs.onUpdated
│   └── chrome.runtime.onMessage (existing)
└── Utility Functions
    └── updateSidePanelForTab(tabId, url)
```

### Event Flow

1. **Extension Installation**
   - Service worker initializes
   - Side panel disabled globally by default
   - Panel behavior set to open on action click

2. **Tab Activation** (user switches tabs)
   - `chrome.tabs.onActivated` fires with tabId
   - Service worker retrieves tab details
   - Calls `updateSidePanelForTab()` with tab URL
   - Side panel enabled/disabled for that tab

3. **Tab URL Update** (navigation within tab)
   - `chrome.tabs.onUpdated` fires with tab details
   - Service worker checks if URL changed
   - Calls `updateSidePanelForTab()` with new URL
   - Side panel enabled/disabled for that tab

## Components and Interfaces

### Domain Matching Logic

```typescript
function isSfGovDomain(url: string): boolean
```

**Purpose:** Determines if a URL belongs to the SF.gov domain

**Parameters:**
- `url: string` - The full URL to check

**Returns:** `boolean` - true if URL matches *.sf.gov pattern

**Logic:**
- Parse URL using `new URL()`
- Extract hostname
- Check if hostname ends with `.sf.gov` or equals `sf.gov`
- Return boolean result

### Side Panel Update Function

```typescript
async function updateSidePanelForTab(tabId: number, url: string): Promise<void>
```

**Purpose:** Centralized function to enable or disable side panel based on URL

**Parameters:**
- `tabId: number` - The Chrome tab ID
- `url: string` - The tab's current URL

**Logic:**
1. Check if URL matches SF.gov domain using `isSfGovDomain()`
2. If match:
   - Call `chrome.sidePanel.setOptions()` with `enabled: true` and `tabId`
   - Set `path: "sidepanel.html"`
3. If no match:
   - Call `chrome.sidePanel.setOptions()` with `enabled: false` and `tabId`
4. Catch and log any errors

**Error Handling:**
- Wrap in try-catch block
- Log errors to console with context
- Do not throw errors (fail silently to avoid breaking extension)

### Event Handlers

#### onInstalled Handler

```typescript
chrome.runtime.onInstalled.addListener(() => {
  // disable side panel by default
  chrome.sidePanel.setOptions({ enabled: false });
  
  // set panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  console.log("SF.gov Companion installed");
});
```

**Changes from current:**
- Add `chrome.sidePanel.setOptions({ enabled: false })` call

#### onActivated Handler (NEW)

```typescript
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;
    
    await updateSidePanelForTab(tabId, tab.url);
  } catch (err) {
    console.error("Side panel activation handling error:", err);
  }
});
```

**Purpose:** Handle tab switching events

**Logic:**
1. Extract tabId from event
2. Fetch full tab details using `chrome.tabs.get()`
3. Check if tab has URL
4. Call `updateSidePanelForTab()` with tabId and URL
5. Handle errors gracefully

#### onUpdated Handler (NEW)

```typescript
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  
  try {
    await updateSidePanelForTab(tabId, tab.url);
  } catch (err) {
    console.error("Side panel update handling error:", err);
  }
});
```

**Purpose:** Handle URL changes within a tab

**Logic:**
1. Check if tab has URL
2. Call `updateSidePanelForTab()` with tabId and URL
3. Handle errors gracefully

**Note:** We don't need to check `changeInfo.url` specifically because we want to ensure correct state even if the event fires for other reasons

## Data Models

No new data models required. The feature uses existing Chrome API types:

- `chrome.tabs.Tab` - Tab information including URL
- `chrome.tabs.TabActiveInfo` - Tab activation event data
- `chrome.sidePanel.PanelOptions` - Side panel configuration options

## Error Handling

### URL Parsing Errors

**Scenario:** Invalid URL format (e.g., `chrome://`, `about:blank`)

**Handling:**
- Wrap URL parsing in try-catch
- If parsing fails, treat as non-SF.gov domain
- Disable side panel for that tab
- Log error to console

### API Call Failures

**Scenario:** `chrome.sidePanel.setOptions()` or `chrome.tabs.get()` fails

**Handling:**
- Wrap all Chrome API calls in try-catch blocks
- Log errors with context to console
- Do not propagate errors (fail silently)
- Extension continues to function for other tabs

### Missing Tab URL

**Scenario:** Tab object has no URL property

**Handling:**
- Early return from handler functions
- Do not attempt to update side panel state
- No error logging (this is expected for some tab types)

## Testing Strategy

### Manual Testing

1. **Installation Test**
   - Install extension
   - Verify side panel is disabled by default
   - Open SF.gov page
   - Click extension icon
   - Verify side panel opens

2. **Tab Switching Test**
   - Open SF.gov tab (side panel visible)
   - Open non-SF.gov tab (e.g., google.com)
   - Switch to non-SF.gov tab
   - Verify side panel is hidden
   - Switch back to SF.gov tab
   - Verify side panel is visible again

3. **Navigation Test**
   - Open SF.gov page with side panel visible
   - Navigate to non-SF.gov domain in same tab
   - Verify side panel hides
   - Navigate back to SF.gov domain
   - Verify side panel shows

4. **Multiple Tabs Test**
   - Open multiple SF.gov tabs
   - Open multiple non-SF.gov tabs
   - Switch between tabs
   - Verify each tab has correct side panel state

5. **Edge Cases**
   - Test with `chrome://` URLs
   - Test with `about:blank`
   - Test with invalid URLs
   - Verify no console errors crash the extension

### Domain Matching Tests

Test the `isSfGovDomain()` function with various URLs:

- `https://www.sf.gov/` → true
- `https://sf.gov/` → true
- `https://admin.sf.gov/` → true
- `https://subdomain.sf.gov/path` → true
- `https://google.com/` → false
- `https://sf.gov.fake.com/` → false
- `https://notsf.gov/` → false
- `chrome://extensions/` → false (or handle error)

## Implementation Notes

### Code Organization

The service worker file will be organized as follows:

1. Utility functions (top of file)
   - `isSfGovDomain()`
   - `updateSidePanelForTab()`

2. Event listeners (bottom of file)
   - `chrome.runtime.onInstalled`
   - `chrome.tabs.onActivated`
   - `chrome.tabs.onUpdated`
   - `chrome.runtime.onMessage` (existing)

### Performance Considerations

- Event handlers are async but non-blocking
- URL parsing is fast (native browser API)
- Chrome API calls are asynchronous
- No polling or timers required
- Minimal memory footprint

### Browser Compatibility

This feature uses Chrome Extension Manifest V3 APIs:
- `chrome.sidePanel.setOptions()` - Available in Chrome 114+
- `chrome.tabs.onActivated` - Standard API
- `chrome.tabs.onUpdated` - Standard API

The extension already requires Manifest V3, so no additional compatibility concerns.
