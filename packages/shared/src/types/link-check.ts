/**
 * TypeScript types for server-side link checking
 */

/**
 * Request payload for link checking endpoint
 */
export interface LinkCheckRequest {
	urls: string[];          // URLs to validate (max 200)
	pageUrl: string;         // Source page URL for context (used for mixed content detection)
}

/**
 * Link validation status
 */
export type LinkStatus = "ok" | "broken" | "redirect" | "timeout" | "error" | "insecure" | "warning";

/**
 * Result event for a single link check (sent via SSE)
 */
export interface LinkCheckResultEvent {
	url: string;
	status: LinkStatus;
	statusCode?: number;
	finalUrl?: string;       // For redirects
	error?: string;          // For errors
}

/**
 * Completion event sent when all links have been checked (sent via SSE)
 */
export interface LinkCheckCompleteEvent {
	type: "complete";
	total: number;
	checked: number;
}

/**
 * Error event sent when an error occurs (sent via SSE)
 */
export interface LinkCheckErrorEvent {
	type: "error";
	message: string;
}

/**
 * Union type for all SSE events
 */
export type LinkCheckEvent = LinkCheckResultEvent | LinkCheckCompleteEvent | LinkCheckErrorEvent;
