/**
 * Background Service Worker
 * Handles toolbar button clicks to open the side panel
 */

/**
 * Set up event listeners when the service worker is installed
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('SF.gov Wagtail Extension installed');
});

/**
 * Listen for toolbar button clicks to open the side panel
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log('Side panel opened via toolbar button');
    } catch (error) {
      console.error('Error opening side panel:', error);
    }
  }
});
