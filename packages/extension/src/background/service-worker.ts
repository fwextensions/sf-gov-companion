/**
 * Background Service Worker
 * Handles toolbar button clicks to toggle the side panel
 * Forwards messages from content scripts to side panel
 */

/**
 * Check if a URL matches the SF.gov domain pattern (*.sf.gov)
 * @param url - The URL to check
 * @returns true if the URL matches *.sf.gov, false otherwise
 */
function isSfGovDomain(url: string): boolean {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();
		
		// check if hostname is exactly sf.gov or ends with .sf.gov
		return hostname === "sf.gov" || hostname.endsWith(".sf.gov");
	} catch (err) {
		// URL parsing failed (e.g., chrome://, about:blank, invalid URLs)
		// treat as non-SF.gov domain
		return false;
	}
}

/**
 * Update side panel visibility for a specific tab based on its URL
 * @param tabId - The Chrome tab ID
 * @param url - The tab's current URL
 */
async function updateSidePanelForTab(tabId: number, url: string): Promise<void> {
	try {
		const isSfGov = isSfGovDomain(url);
		
		if (isSfGov) {
			// enable side panel for SF.gov domains
			await chrome.sidePanel.setOptions({
				tabId,
				enabled: true,
				path: "src/sidepanel/index.html",
			});
		} else {
			// disable side panel for non-SF.gov domains
			await chrome.sidePanel.setOptions({
				tabId,
				enabled: false,
			});
		}
	} catch (err) {
		console.error(`Side panel update error for tab ${tabId}:`, err);
	}
}

/**
 * Set up event listeners when the service worker is installed
 */
chrome.runtime.onInstalled.addListener(() => {
	// disable side panel by default for all tabs
	void chrome.sidePanel.setOptions({ enabled: false });
	
	void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
	console.log("SF.gov Companion installed");
});

/**
 * Listen for tab activation events (user switches tabs)
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
	try {
		const tab = await chrome.tabs.get(tabId);
		if (!tab.url) return;
		
		await updateSidePanelForTab(tabId, tab.url);
	} catch (err) {
		console.error("Side panel activation handling error:", err);
	}
});

/**
 * Listen for tab update events (URL changes within a tab)
 */
chrome.tabs.onUpdated.addListener(async (tabId, _changeInfo, tab) => {
	if (!tab.url) return;
	
	try {
		await updateSidePanelForTab(tabId, tab.url);
	} catch (err) {
		console.error("Side panel update handling error:", err);
	}
});

/**
 * Listen for messages from content script and forward to side panel
 */
chrome.runtime.onMessage.addListener((message, sender) => {
	// only process messages from content scripts
	if (!sender.tab) {
		return;
	}

	// forward preview messages to side panel
	if (message.type === "PREVIEW_URL_UPDATE" || message.type === "PREVIEW_UNAVAILABLE") {
		console.log(`Forwarding message from tab ${sender.tab.id}:`, message.type);
		
		// forward to side panel (all extension contexts will receive this)
		// note: this will fail silently if side panel is not open, which is expected
		chrome.runtime.sendMessage(message).catch(() => {
			// side panel not open, message will be ignored
		});
	}
});
