# Design Document

## Overview

This feature adds real-time preview integration to the SF.gov Wagtail Extension by injecting a content script into the Wagtail admin interface. When content editors work on pages in the admin interface (api.sf.gov/admin), the extension monitors the preview button and automatically displays draft content in the side panel. The design introduces a new content script component, extends the messaging system between components, and enhances the side panel's state management to handle preview URLs and prevent incorrect "no page info available" messages.

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Service Worker  │◄────────┤  Content Script  │          │
│  │                  │         │  (Admin Pages)   │          │
│  └────────┬─────────┘         └──────────────────┘          │
│           │                            │                     │
│           │                            │                     │
│           │                            │                     │
│           ▼                            │                     │
│  ┌──────────────────┐                 │                     │
│  │   Side Panel     │◄────────────────┘                     │
│  │   (React App)    │                                        │
│  │                  │                                        │
│  │  ┌────────────┐  │                                        │
│  │  │ useSfGovPage│  │                                        │
│  │  │   Hook     │  │                                        │
│  │  └────────────┘  │                                        │
│  │                  │                                        │
│  │  ┌────────────┐  │                                        │
│  │  │ Wagtail    │  │                                        │
│  │  │ API Client │  │                                        │
│  │  └────────────┘  │                                        │
│  └──────────────────┘                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Content Script Injection**: Service worker injects content script into admin pages matching `api.sf.gov/admin/*`
2. **Preview Detection**: Content script monitors DOM for preview button element `[data-controller="preview-button"]`
3. **URL Extraction**: Content script extracts href from preview button when not disabled
4. **Message Passing**: Content script sends preview URL to side panel via Chrome runtime messaging
5. **Side Panel Update**: Side panel receives preview URL and updates displayed content
6. **Real-time Monitoring**: Content script uses MutationObserver to detect href changes and sends updates

## Components and Interfaces

### Content Script (New Component)

**File**: `src/content/admin-preview-monitor.ts`

**Purpose**: Injected into Wagtail admin pages to monitor the preview button and communicate preview URLs to the side panel.

**Key Responsibilities**:
- Detect and monitor preview button element
- Extract preview URL from button href
- Watch for href attribute changes using MutationObserver
- Send preview URL updates via Chrome runtime messaging
- Handle button disabled state changes
- Clean up observers when page unloads

**Interface**:
```typescript
interface PreviewButtonState {
	href: string | null;
	isDisabled: boolean;
	exists: boolean;
}

interface PreviewMessage {
	type: "PREVIEW_URL_UPDATE" | "PREVIEW_UNAVAILABLE";
	url?: string;
	timestamp: number;
}
```

**Implementation Details**:
- Use `MutationObserver` to watch for DOM changes to preview button
- Implement retry logic with exponential backoff for button detection (max 5 seconds)
- Debounce href change events (100ms) to avoid excessive messaging
- Send messages only when href actually changes or button state changes
- Include timestamp in messages for staleness detection

### Service Worker (Enhanced)

**File**: `src/background/service-worker.ts`

**Purpose**: Manage content script injection and message routing between content script and side panel.

**New Responsibilities**:
- Inject content script into admin pages on navigation
- Route preview messages from content script to side panel
- Track active admin tabs to prevent duplicate injections
- Clean up state when tabs close

**Interface**:
```typescript
interface ContentScriptInjection {
	tabId: number;
	injected: boolean;
	timestamp: number;
}
```

**Implementation Details**:
- Listen to `chrome.tabs.onUpdated` for admin page navigation
- Check URL pattern `api.sf.gov/admin/*` before injection
- Use `chrome.scripting.executeScript` for content script injection
- Maintain map of injected tabs to prevent duplicate injections
- Forward messages from content script to side panel using `chrome.runtime.sendMessage`

### Side Panel Hook (Enhanced)

**File**: `src/sidepanel/hooks/useSfGovPage.ts`

**Purpose**: Manage page data fetching, caching, and state for the side panel, now with preview URL support.

**New Responsibilities**:
- Listen for preview URL messages from content script
- Override current URL with preview URL when received
- Pass preview parameters to API client
- Maintain separate cache entries for preview vs live URLs
- Prevent state clearing when window focus changes if URL unchanged

**Interface**:
```typescript
interface UseSfGovPageReturn {
	pageData: WagtailPage | null;
	error: ApiError | null;
	isLoading: boolean;
	isOnSfGov: boolean;
	isAdminPage: boolean;
	isPreviewMode: boolean;  // NEW
	previewUrl: string | null;  // NEW
	currentUrl: string;
	retry: () => void;
}

interface PreviewState {
	url: string;
	timestamp: number;
	active: boolean;
}
```

**Implementation Details**:
- Add `chrome.runtime.onMessage` listener for preview messages
- Store preview URL in separate state variable
- Use preview URL for API calls when available
- Add visual indicator state (`isPreviewMode`) for UI
- Enhance cache key to include preview status: `${slug}:preview` vs `${slug}:live`
- Modify `handleTabUpdate` to preserve state when URL unchanged
- Add timestamp comparison to ignore stale preview messages
- **Persist preview URL**: When `PREVIEW_UNAVAILABLE` message received, keep current preview URL and mode active
- **Initial state**: On panel load, wait for initial preview state from content script before rendering iframe
- Only clear preview mode when navigating away from admin page or tab changes

### Wagtail API Client (Enhanced)

**File**: `src/api/wagtail-client.ts`

**Purpose**: Handle API requests to Wagtail, now with preview parameter support.

**New Responsibilities**:
- Accept optional preview parameters in API calls
- Append `preview=true` and `ts` parameters to API requests
- Handle preview-specific error responses

**Interface**:
```typescript
interface PreviewParams {
	preview: boolean;
	ts: string;
}

function findPageBySlug(
	slug: string,
	url?: string,
	previewParams?: PreviewParams  // NEW
): Promise<WagtailPage>;

function findPageById(
	pageId: number,
	previewParams?: PreviewParams  // NEW
): Promise<WagtailPage>;
```

**Implementation Details**:
- Extract preview parameters from preview URL query string
- Append preview parameters to API endpoint URLs
- Preserve preview parameters across paginated requests
- Handle 404 errors for invalid preview URLs gracefully

### Side Panel UI (Enhanced)

**File**: `src/sidepanel/App.tsx`

**Purpose**: Render side panel UI with preview mode indicator.

**New Responsibilities**:
- Display visual indicator when in preview mode
- Show preview timestamp or "draft" badge
- Handle preview unavailable state

**Implementation Details**:
- Add preview mode banner at top of side panel
- Style banner with distinct color (e.g., amber/yellow)
- Include text: "Viewing draft preview" with timestamp
- Show "Preview unavailable" message when preview disabled

## Data Models

### Message Types

```typescript
// Content script to side panel messages
type PreviewMessage = 
	| { type: "PREVIEW_URL_UPDATE"; url: string; timestamp: number }
	| { type: "PREVIEW_UNAVAILABLE"; timestamp: number };

// Internal state models
interface PreviewState {
	url: string | null;
	timestamp: number;
	active: boolean;
}

interface TabState {
	url: string;
	slug: string;
	isOnSfGov: boolean;
	isAdminPage: boolean;
	pageId: number | null;
	previewUrl: string | null;  // NEW
}
```

### Cache Keys

Cache keys will be enhanced to distinguish between preview and live content:

```typescript
// Live content cache key
const liveKey = `${slug}:live`;

// Preview content cache key
const previewKey = `${slug}:preview:${timestamp}`;

// Page ID cache key (for admin pages)
const idKey = `id:${pageId}`;
```

## Error Handling

### Content Script Errors

1. **Preview button not found**: Wait up to 5 seconds with exponential backoff, then send `PREVIEW_UNAVAILABLE` message
2. **Invalid href**: Log warning, do not send message
3. **Message sending failure**: Log error, retry once after 1 second
4. **Observer disconnection**: Reconnect observer, log warning

### Side Panel Errors

1. **Invalid preview URL**: Display error message "Preview unavailable", fall back to live content
2. **Preview API error**: Show error state with retry button, preserve live content in background
3. **Stale preview message**: Ignore messages older than current preview timestamp
4. **Missing preview parameters**: Log warning, treat as live content request

### Service Worker Errors

1. **Content script injection failure**: Log error, do not retry (user can reload page)
2. **Message routing failure**: Log error, message will be lost (content script will retry)
3. **Tab query failure**: Log error, skip injection for that navigation event

## Testing Strategy

### Unit Tests

1. **Content Script**:
   - Test preview button detection with various DOM states
   - Test MutationObserver triggers on href changes
   - Test debouncing of href change events
   - Test message format and content
   - Test cleanup on page unload

2. **Service Worker**:
   - Test content script injection logic
   - Test URL pattern matching for admin pages
   - Test message routing between components
   - Test duplicate injection prevention

3. **useSfGovPage Hook**:
   - Test preview message handling
   - Test cache key generation for preview vs live
   - Test state preservation on window focus changes
   - Test preview URL override logic
   - Test timestamp-based message staleness detection

4. **Wagtail API Client**:
   - Test preview parameter appending to URLs
   - Test preview parameter extraction from URLs
   - Test API calls with and without preview params

### Integration Tests

1. **End-to-End Preview Flow**:
   - Navigate to admin edit page
   - Verify content script injection
   - Verify preview URL detection
   - Verify side panel displays preview content
   - Modify content in admin
   - Verify side panel updates automatically

2. **State Persistence**:
   - Open side panel on SF.gov page
   - Switch to different window
   - Return to original tab
   - Verify page data still displayed (no "no page info available")

3. **Preview Unavailable Handling**:
   - Navigate to admin page with disabled preview
   - Verify side panel shows appropriate message
   - Enable preview in admin
   - Verify side panel updates to show preview

### Manual Testing Scenarios

1. **Admin Preview Workflow**:
   - Open admin edit page for a published page
   - Open side panel
   - Verify preview loads in side panel
   - Make changes to page content
   - Verify side panel updates within 1 second
   - Save changes
   - Verify preview still works

2. **Window Switching**:
   - Open SF.gov page with side panel
   - Switch to different application
   - Wait 5 minutes
   - Return to browser
   - Verify page data still displayed

3. **Multiple Admin Tabs**:
   - Open multiple admin edit pages in different tabs
   - Open side panel
   - Switch between tabs
   - Verify side panel shows correct preview for active tab

4. **Preview Button States**:
   - Open admin page with unsaved changes (preview enabled)
   - Verify preview loads
   - Save changes (preview may become disabled temporarily)
   - Verify side panel handles state change gracefully

## Implementation Notes

### Content Script Injection Timing

The service worker must inject the content script at `document_idle` to ensure the DOM is ready. The manifest will specify:

```typescript
content_scripts: [{
	matches: ["*://api.sf.gov/admin/*"],
	js: ["src/content/admin-preview-monitor.ts"],
	run_at: "document_idle"
}]
```

Alternatively, use programmatic injection in service worker for more control:

```typescript
chrome.scripting.executeScript({
	target: { tabId: tab.id },
	files: ["src/content/admin-preview-monitor.ts"],
	world: "ISOLATED"
});
```

### MutationObserver Configuration

The content script will use a MutationObserver with these settings:

```typescript
const observer = new MutationObserver(handleMutations);
observer.observe(previewButton, {
	attributes: true,
	attributeFilter: ["href", "class"],
	subtree: false
});
```

### Message Passing Security

All messages will include a timestamp and type field for validation:

```typescript
// Sender (content script)
chrome.runtime.sendMessage({
	type: "PREVIEW_URL_UPDATE",
	url: previewUrl,
	timestamp: Date.now()
});

// Receiver (side panel)
chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "PREVIEW_URL_UPDATE" && message.url) {
		// Validate timestamp is recent (within 5 seconds)
		if (Date.now() - message.timestamp < 5000) {
			handlePreviewUrl(message.url);
		}
	}
});
```

### State Persistence Strategy

To fix the "no page info available" bug, the hook will:

1. Store last successful tab state in ref: `lastValidStateRef`
2. On window focus/blur events, compare current URL with last valid URL
3. If URLs match, preserve existing `pageData` state
4. Only clear state if URL actually changed
5. Add logging to track state transitions for debugging

```typescript
// Pseudo-code for state persistence
const lastValidStateRef = useRef<{ url: string; pageData: WagtailPage } | null>(null);

useEffect(() => {
	const handleVisibilityChange = () => {
		if (document.visibilityState === "visible") {
			// Check if URL changed while hidden
			const currentUrl = getCurrentTabUrl();
			if (lastValidStateRef.current?.url === currentUrl) {
				// URL unchanged, preserve state
				console.log("Preserving state, URL unchanged");
				return;
			}
			// URL changed, fetch new data
			handleTabUpdate(currentUrl);
		}
	};
	
	document.addEventListener("visibilitychange", handleVisibilityChange);
	return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
}, []);
```

## Design Decisions and Rationales

### Decision 1: Content Script vs Background Polling

**Decision**: Use content script injected into admin pages rather than background polling.

**Rationale**: 
- Content scripts have direct DOM access for reliable button detection
- Avoids permission issues with cross-origin iframe access
- More efficient than polling (event-driven)
- Follows Chrome extension best practices

### Decision 2: MutationObserver vs Polling

**Decision**: Use MutationObserver to watch for href changes rather than setInterval polling.

**Rationale**:
- More efficient (event-driven vs continuous polling)
- Detects changes immediately without delay
- Lower CPU usage
- Standard web API with good browser support

### Decision 3: Separate Cache Keys for Preview vs Live

**Decision**: Use different cache keys for preview and live content.

**Rationale**:
- Prevents preview content from overwriting live content cache
- Allows quick switching between preview and live views
- Enables cache invalidation for preview without affecting live cache
- Supports multiple preview versions (different timestamps)

### Decision 4: Message Timestamp Validation

**Decision**: Include timestamps in messages and validate freshness in receiver.

**Rationale**:
- Prevents stale messages from updating UI incorrectly
- Handles race conditions when multiple messages sent quickly
- Provides debugging information for message timing issues
- Minimal overhead (single number field)

### Decision 5: Preserve State on Window Focus Changes

**Decision**: Maintain page data when window focus changes if URL unchanged.

**Rationale**:
- Fixes reported bug of incorrect "no page info available" messages
- Improves user experience (no unnecessary loading states)
- Reduces API calls (more efficient)
- Aligns with user expectations (tab content didn't change)

### Decision 6: Visual Preview Indicator

**Decision**: Add prominent visual indicator when viewing preview content.

**Rationale**:
- Prevents confusion between live and draft content
- Provides clear feedback that preview mode is active
- Helps users understand why content may differ from live site
- Standard pattern in CMS preview interfaces

### Decision 7: Persist Preview URL When Button Becomes Disabled

**Decision**: When the preview button becomes disabled, keep showing the current preview URL instead of switching to the published version.

**Rationale**:
- Users typically make changes that temporarily disable the preview button (e.g., during save operations)
- Switching to published content would be jarring and confusing
- Users expect to continue viewing their draft changes
- The preview URL remains valid even when the button is disabled
- Reduces unnecessary iframe reloads and improves UX
- Only clear preview mode when user navigates away or explicitly closes the panel

### Decision 8: Initial Preview State Detection

**Decision**: When the side panel loads on an admin page, immediately check if a preview URL is available and use it.

**Rationale**:
- Ensures users see draft content immediately when opening the panel
- Avoids showing published content first, then switching to preview
- Provides consistent experience whether panel is opened before or after preview button is enabled
- Content script sends initial state on load, so panel can use it immediately
