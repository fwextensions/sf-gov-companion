/**
 * Airtable API Client
 * Handles communication with the Airtable proxy API for user feedback data
 */

import type { FeedbackRecord, AirtableApiError } from "@sf-gov/shared";

/**
 * API proxy endpoint URL
 */
const API_PROXY_URL = import.meta.env.VITE_API_PROXY_URL || "https://sfgov-companion-api.vercel.app/api/airtable-proxy";

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
 * Proxy API response structure
 */
interface ProxyResponse {
	records: FeedbackRecord[];
}

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
 * Retrieves the Wagtail session ID from browser cookies
 * @returns Promise resolving to the session ID string or null if not found
 */
export async function getWagtailSessionId(): Promise<string | null> {
	try {
		// try to get cookie from api.sf.gov first (where admin is hosted)
		let cookies = await chrome.cookies.getAll({
			domain: "api.sf.gov",
			name: "sessionid",
		});

		// fallback to .sf.gov domain if not found
		if (cookies.length === 0) {
			cookies = await chrome.cookies.getAll({
				domain: ".sf.gov",
				name: "sessionid",
			});
		}

		if (cookies.length > 0) {
			console.log("Found Wagtail session cookie:", cookies[0].domain);
			return cookies[0].value;
		}

		console.log("No Wagtail session cookie found");
		return null;
	} catch (error) {
		console.error("Failed to retrieve Wagtail session cookie:", error);
		return null;
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
 * Fetches feedback records for a given page path via the API proxy
 * @param path - The page path to fetch feedback for
 * @returns Promise resolving to an array of FeedbackRecord objects
 * @throws AirtableApiError for authentication, network, or server errors
 */
export async function getFeedbackByPath(path: string): Promise<FeedbackRecord[]> {
	const normalizedPath = normalizePath(path);
	const cacheKey = `feedback:${normalizedPath}`;

	// check cache first
	const cached = feedbackCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		console.log("Returning cached feedback for:", normalizedPath);
		return cached.data;
	}

	// get Wagtail session ID from cookies
	const sessionId = await getWagtailSessionId();
	if (!sessionId) {
		throw createApiError(
			"auth",
			"Not authenticated."
		);
	}

	// construct proxy API URL with page path
	const url = new URL(API_PROXY_URL);
	url.searchParams.set("pagePath", normalizedPath);

	console.log("Fetching feedback from proxy:", url.toString());

	try {
		const response = await fetchWithTimeout(
			url.toString(),
			{
				headers: {
					"X-Wagtail-Session": sessionId,
					"X-SF-Gov-Extension": "companion",
				},
			}
		);

		// handle HTTP error status codes
		if (response.status === 401) {
			throw createApiError(
				"auth",
				"Invalid or expired session.",
				response.status
			);
		}

		if (response.status === 403) {
			throw createApiError(
				"auth",
				"Access denied. Please check your permissions.",
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
				"Server error. Please try again later.",
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

		const data: ProxyResponse = await response.json();

		// cache the results
		feedbackCache.set(cacheKey, {
			data: data.records,
			timestamp: Date.now(),
		});

		return data.records;
	} catch (error) {
		// re-throw AirtableApiError as-is
		if (isAirtableApiError(error)) {
			throw error;
		}

		// handle timeout errors
		if (error instanceof Error && error.message === "Request timed out") {
			throw createApiError("timeout", "Request timed out. Please try again.");
		}

		// handle network errors
		if (error instanceof TypeError) {
			throw createApiError(
				"network",
				"Unable to connect to API. Check your network connection."
			);
		}

		// handle unexpected errors
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
