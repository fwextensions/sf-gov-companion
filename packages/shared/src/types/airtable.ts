/**
 * Airtable API type definitions for SF.gov feedback integration
 */

/**
 * Represents a user feedback submission from Airtable
 */
export interface FeedbackRecord {
	id: string;
	submissionId: string;
	submissionCreated: string; // ISO 8601 date string
	referrer: string;
	wasHelpful: "yes" | "no" | null;
	issueCategory: string | null;
	whatWasHelpful: string | null;
	additionalDetails: string | null;
}

/**
 * Calculated feedback statistics for a page
 */
export interface FeedbackStats {
	total: number;
	helpful: number;
	notHelpful: number;
	helpfulPercent: number;
	notHelpfulPercent: number;
}

/**
 * Combined feedback response with stats and recent records
 */
export interface FeedbackResponse {
	stats: FeedbackStats;
	records: FeedbackRecord[];
}

/**
 * Raw Airtable API response structure
 */
export interface AirtableResponse {
	records: AirtableRecord[];
	offset?: string;
}

/**
 * Individual record from Airtable API
 */
export interface AirtableRecord {
	id: string;
	fields: {
		submission_id: string;
		submission_created: string;
		referrer: string;
		wasTheLastPageYouViewedHelpful?: "yes" | "no";
		whatWasWrongWithThePage1?: string;
		whatWasHelpful?: string;
		shareMoreDetails?: string;
	};
	createdTime: string;
}

/**
 * Airtable API error structure
 */
export interface AirtableApiError {
	type: "auth" | "network" | "timeout" | "rate_limit" | "server_error";
	message: string;
	statusCode?: number;
	retryable: boolean;
}

/**
 * Airtable configuration stored in chrome.storage
 */
export interface AirtableConfig {
	accessToken: string | null;
}
