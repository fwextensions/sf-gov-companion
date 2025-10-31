/**
 * Background Service Worker
 * Handles toolbar button clicks to toggle the side panel
 * Forwards messages from content scripts to side panel
 */

/**
 * Set up event listeners when the service worker is installed
 */
chrome.runtime.onInstalled.addListener(() => {
	void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
	console.log("SF.gov Companion installed");
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
