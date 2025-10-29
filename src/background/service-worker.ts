/**
 * Background Service Worker
 * Handles toolbar button clicks to toggle the side panel
 */

/**
 * Set up event listeners when the service worker is installed
 */
chrome.runtime.onInstalled.addListener(() => {
	void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
	console.log("SF.gov Companion installed");
});
