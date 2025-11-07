/**
 * Airtable API Client
 * Handles communication with the Airtable API for user feedback data
 */

import type { FeedbackRecord, AirtableResponse, AirtableApiError } from "../types/airtable";

/**
 * Airtable base ID for SF.gov feedback
 */
const BASE_ID = "appo4SjothLkSxmbG";

/**
 * Airtable table name
 */
const TABLE_NAME = "Karl data";

/**
 * Default timeout for API requests in milliseconds
 */
const DEFAULT_TIMEOUT = 10000;

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Cache entry structure
 */
interface CacheEntry {
	data: FeedbackRecord[];
	timestamp: number;
}

/**
 * In-memory cache for feedback records
 */
const feedbackCache = new Map<string, CacheEntry>();

/**
 * Fetches a URL with a timeout using AbortController
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Promise resolving to the Response
 * @throws Error if the request times out or fails
 */
async function fetchWithTimeout(
	url: string,
	options: RequestInit,
	timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		return response;
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof Error && error.name === "AbortError") {
			throw new Error("Request timed out");
		}

		throw error;
	}
}

/**
 * Retrieves the Airtable Personal Access Token from chrome.storage.sync
 * @returns Promise resolving to the token string or null if not configured
 */
export async function getAccessToken(): Promise<string | null> {
	try {
		const result = await chrome.storage.sync.get("airtableAccessToken");
		return result.airtableAccessToken || null;
	} catch (error) {
		console.error("Failed to retrieve Airtable access token:", error);
		return null;
	}
}

/**
 * Stores the Airtable Personal Access Token in chrome.storage.sync
 * @param token - The Personal Access Token to store
 * @returns Promise that resolves when the token is stored
 */
export async function setAccessToken(token: string): Promise<void> {
	try {
		await chrome.storage.sync.set({ airtableAccessToken: token });
	} catch (error) {
		console.error("Failed to store Airtable access token:", error);
		throw new Error("Failed to save access token");
	}
}

/**
 * Normalizes a page path for consistent matching
 * - Removes query parameters
 * - Removes trailing slashes (except for homepage)
 * - Converts to lowercase
 * @param path - The path to normalize
 * @returns Normalized path string
 */
export function normalizePath(path: string): string {
	// Remove query parameters
	const pathWithoutQuery = path.split("?")[0];

	// Convert to lowercase
	let normalized = pathWithoutQuery.toLowerCase();

	// Remove trailing slash, but keep "/" for homepage
	if (normalized !== "/" && normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1);
	}

	return normalized;
}

/**
 * Fetches feedback records for a given page path
 * @param path - The page path to fetch feedback for
 * @returns Promise resolving to an array of FeedbackRecord objects
 * @throws AirtableApiError for authentication, network, or server errors
 */
export async function getFeedbackByPath(path: string): Promise<FeedbackRecord[]> {
	const normalizedPath = normalizePath(path);
	const cacheKey = `feedback:${normalizedPath}`;

	// Check cache first
	const cached = feedbackCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		console.log("Returning cached feedback for:", normalizedPath);
		return cached.data;
	}

	// Get access token
	const token = await getAccessToken();
	if (!token) {
		throw createApiError("auth", "No Airtable access token configured");
	}

	// Construct API URL with filter formula
	const encodedTableName = encodeURIComponent(TABLE_NAME);
	const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodedTableName}`;

	// Create filter formula for path matching
	// Handle homepage special case: match "/" or empty string
	const filterFormula =
		normalizedPath === "/"
			? "OR(LOWER({referrer})='/', {referrer}='')"
			: `LOWER({referrer})='${normalizedPath}'`;

	const url = new URL(baseUrl);
	url.searchParams.set("filterByFormula", filterFormula);
	url.searchParams.set("sort[0][field]", "submission_created");
	url.searchParams.set("sort[0][direction]", "desc");
	url.searchParams.set("maxRecords", "5");

	console.log("Fetching feedback from Airtable:", url.toString());

	try {
		const response = await fetchWithTimeout(
			url.toString(),
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		);

		// Handle HTTP error status codes
		if (response.status === 401 || response.status === 403) {
			throw createApiError(
				"auth",
				"Invalid Airtable access token. Please check your configuration.",
				response.status
			);
		}

		if (response.status === 429) {
			throw createApiError(
				"rate_limit",
				"Too many requests. Please wait a moment and try again.",
				response.status
			);
		}

		if (response.status >= 500) {
			throw createApiError(
				"server_error",
				"Airtable server error. Please try again later.",
				response.status
			);
		}

		if (!response.ok) {
			throw createApiError(
				"network",
				`HTTP error ${response.status}`,
				response.status
			);
		}

		const data: AirtableResponse = await response.json();

		// Transform API response to FeedbackRecord array
		const feedbackRecords: FeedbackRecord[] = data.records.map((record) => ({
			id: record.id,
			submissionId: record.fields.submission_id,
			submissionCreated: record.fields.submission_created,
			referrer: record.fields.referrer,
			wasHelpful: record.fields.wasTheLastPageYouViewedHelpful || null,
			issueCategory: record.fields.whatWasWrongWithThePage1 || null,
			whatWasHelpful: record.fields.whatWasHelpful || null,
			additionalDetails: record.fields.shareMoreDetails || null,
		}));

		// Cache the results
		feedbackCache.set(cacheKey, {
			data: feedbackRecords,
			timestamp: Date.now(),
		});

		return feedbackRecords;
	} catch (error) {
		// Re-throw AirtableApiError as-is
		if (isAirtableApiError(error)) {
			throw error;
		}

		// Handle timeout errors
		if (error instanceof Error && error.message === "Request timed out") {
			throw createApiError("timeout", "Request timed out. Please try again.");
		}

		// Handle network errors
		if (error instanceof TypeError) {
			throw createApiError(
				"network",
				"Unable to connect to Airtable. Check your network connection."
			);
		}

		// Handle unexpected errors
		throw createApiError("network", "An unexpected error occurred");
	}
}

/**
 * Creates an AirtableApiError object with the specified properties
 * @param type - The error type
 * @param message - The error message
 * @param statusCode - Optional HTTP status code
 * @returns AirtableApiError object
 */
function createApiError(
	type: "auth" | "network" | "timeout" | "rate_limit" | "server_error",
	message: string,
	statusCode?: number
): AirtableApiError {
	return {
		type,
		message,
		statusCode,
		retryable: type !== "auth", // All errors except auth are retryable
	};
}

/**
 * Type guard to check if an error is an AirtableApiError
 * @param error - The error to check
 * @returns True if the error is an AirtableApiError
 */
function isAirtableApiError(error: any): error is AirtableApiError {
	return (
		error &&
		typeof error === "object" &&
		"type" in error &&
		"message" in error &&
		"retryable" in error
	);
}

/**
 * Clears the feedback cache for a specific path or all paths
 * @param path - Optional path to clear from cache. If not provided, clears entire cache
 */
export function clearCache(path?: string): void {
	if (path) {
		const normalizedPath = normalizePath(path);
		const cacheKey = `feedback:${normalizedPath}`;
		feedbackCache.delete(cacheKey);
	} else {
		feedbackCache.clear();
	}
}
