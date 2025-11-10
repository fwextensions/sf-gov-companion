import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import type { AirtableResponse, FeedbackRecord } from "@sf-gov/shared";

/**
 * Environment variables required for the proxy
 */
interface ProxyEnv {
	WAGTAIL_API_URL: string;
	AIRTABLE_API_KEY: string;
	AIRTABLE_BASE_ID: string;
	AIRTABLE_TABLE_NAME: string;
}

/**
 * Validates that all required environment variables are present
 */
function validateEnv(): ProxyEnv {
	const env = {
		WAGTAIL_API_URL: process.env.WAGTAIL_API_URL,
		AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY,
		AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
		AIRTABLE_TABLE_NAME: process.env.AIRTABLE_TABLE_NAME,
	};

	const missing = Object.entries(env)
		.filter(([_, value]) => !value)
		.map(([key]) => key);

	if (missing.length > 0) {
		throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
	}

	return env as ProxyEnv;
}

/**
 * Validates origin header to prevent unauthorized access
 */
function validateOrigin(origin: string | undefined): boolean {
	if (!origin) return false;

	// Allow chrome-extension:// and edge-extension:// origins
	if (origin.startsWith("chrome-extension://") || origin.startsWith("edge-extension://")) {
		return true;
	}

	// Allow localhost for development
	if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
		return true;
	}

	return false;
}

/**
 * Implements rate limiting using Vercel KV
 * Returns true if request should be allowed, false if rate limited
 */
async function checkRateLimit(identifier: string): Promise<boolean> {
	const key = `ratelimit:${identifier}`;
	const limit = 10; // requests
	const window = 10; // seconds

	try {
		const current = await kv.incr(key);
		
		if (current === 1) {
			// First request in window, set expiration
			await kv.expire(key, window);
		}

		return current <= limit;
	} catch (error) {
		// If KV fails, allow the request (fail open)
		console.error("Rate limit check failed:", error);
		return true;
	}
}

/**
 * Validates Wagtail session by making a request to the Wagtail admin
 */
async function validateWagtailSession(sessionId: string, wagtailApiUrl: string): Promise<boolean> {
	try {
		// remove trailing slash from URL if present
		const baseUrl = wagtailApiUrl.replace(/\/$/, "");
		const validationUrl = `${baseUrl}/pages`;
		
		console.log(`Validating session with Wagtail admin: ${validationUrl}`);
		const response = await fetch(validationUrl, {
			method: "GET",
			headers: {
				"Cookie": `sessionid=${sessionId}`,
			},
			redirect: "manual", // don't follow redirects
			signal: AbortSignal.timeout(5000), // 5 second timeout
		});

		console.log(`Wagtail session validation response: ${response.status} ${response.statusText}`);
		
		// consider 200 OK and 3xx redirects as valid (logged in users get redirected)
		return response.ok || (response.status >= 300 && response.status < 400);
	} catch (error) {
		console.error("Wagtail session validation failed:", error);
		return false;
	}
}

/**
 * Validates session with caching using Vercel KV
 * Cache TTL: 5 minutes
 */
async function validateSessionWithCache(sessionId: string, wagtailApiUrl: string): Promise<boolean> {
	const cacheKey = `session:${sessionId}`;
	const cacheTTL = 300; // 5 minutes in seconds

	try {
		// Check cache first
		const cached = await kv.get<boolean>(cacheKey);
		if (cached !== null) {
			return cached;
		}

		// Cache miss, validate with Wagtail
		const isValid = await validateWagtailSession(sessionId, wagtailApiUrl);

		// Store result in cache
		if (isValid) {
			await kv.setex(cacheKey, cacheTTL, true);
		}

		return isValid;
	} catch (error) {
		// If KV fails, fall back to direct validation
		console.error("Session cache check failed, falling back to direct validation:", error);
		return await validateWagtailSession(sessionId, wagtailApiUrl);
	}
}

/**
 * Normalizes a page path for consistent matching
 */
function normalizePath(path: string): string {
	// Remove query parameters
	const withoutQuery = path.split("?")[0];
	
	// Remove trailing slashes (except for root "/")
	const withoutTrailingSlash = withoutQuery === "/" ? "/" : withoutQuery.replace(/\/+$/, "");
	
	// Convert to lowercase for case-insensitive matching
	return withoutTrailingSlash.toLowerCase();
}

/**
 * Fetches feedback records from Airtable for a given page path
 */
async function fetchAirtableFeedback(
	pagePath: string,
	env: ProxyEnv
): Promise<FeedbackRecord[]> {
	const normalizedPath = normalizePath(pagePath);
	
	// URL encode the table name (e.g., "Karl data" -> "Karl%20data")
	const encodedTableName = encodeURIComponent(env.AIRTABLE_TABLE_NAME);
	
	// Build Airtable API URL with filter formula
	const filterFormula = `LOWER({referrer})='${normalizedPath}'`;
	const url = new URL(
		`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodedTableName}`
	);
	
	console.log(`Fetching from Airtable: ${url.toString()}`);
	url.searchParams.set("filterByFormula", filterFormula);
	url.searchParams.set("sort[0][field]", "submission_created");
	url.searchParams.set("sort[0][direction]", "desc");
	url.searchParams.set("maxRecords", "5");

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
			},
			signal: AbortSignal.timeout(10000), // 10 second timeout
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Airtable API error (${response.status}): ${errorText}`);
		}

		const data = await response.json() as AirtableResponse;

		// Transform Airtable records to FeedbackRecord format
		return data.records.map(record => ({
			id: record.id,
			submissionId: record.fields.submission_id,
			submissionCreated: record.fields.submission_created,
			referrer: record.fields.referrer,
			wasHelpful: record.fields.wasTheLastPageYouViewedHelpful || null,
			issueCategory: record.fields.whatWasWrongWithThePage1 || null,
			whatWasHelpful: record.fields.whatWasHelpful || null,
			additionalDetails: record.fields.shareMoreDetails || null,
		}));
	} catch (error) {
		console.error("Airtable fetch failed:", error);
		throw error;
	}
}

/**
 * Main handler for the Airtable proxy serverless function
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	const origin = req.headers.origin as string | undefined;
	
	// validate origin first
	const isValidOrigin = validateOrigin(origin);
	
	// set CORS headers for valid origins
	if (isValidOrigin && origin) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Wagtail-Session");
		res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
	}

	// handle preflight requests
	if (req.method === "OPTIONS") {
		if (!isValidOrigin) {
			return res.status(403).json({ error: "Invalid origin" });
		}
		return res.status(200).end();
	}

	// only allow GET requests
	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	// validate origin for actual requests
	if (!isValidOrigin) {
		return res.status(403).json({ error: "Invalid origin" });
	}

	try {
		// Validate environment variables
		const env = validateEnv();

		// Extract session ID from header
		const sessionId = req.headers["x-wagtail-session"] as string | undefined;
		if (!sessionId) {
			return res.status(401).json({ error: "Missing session token" });
		}

		// Check rate limit (use session ID as identifier)
		const rateLimitOk = await checkRateLimit(sessionId);
		if (!rateLimitOk) {
			return res.status(429).json({ 
				error: "Too many requests. Please wait a moment and try again." 
			});
		}

		// Validate session with caching
		const isValidSession = await validateSessionWithCache(sessionId, env.WAGTAIL_API_URL);
		if (!isValidSession) {
			return res.status(401).json({ 
				error: "Invalid or expired session. Please log in to Wagtail admin." 
			});
		}

		// Extract page path from query parameter
		const pagePath = req.query.pagePath as string | undefined;
		if (!pagePath) {
			return res.status(400).json({ error: "Missing pagePath query parameter" });
		}

		// Fetch feedback from Airtable
		const feedback = await fetchAirtableFeedback(pagePath, env);

		// Return feedback records
		return res.status(200).json({ records: feedback });

	} catch (error) {
		console.error("Proxy handler error:", error);
		
		// Return appropriate error response
		if (error instanceof Error) {
			if (error.message.includes("Missing required environment variables")) {
				return res.status(500).json({ error: "Server configuration error" });
			}
			if (error.message.includes("Airtable API error")) {
				return res.status(502).json({ error: "Failed to fetch feedback data" });
			}
		}

		return res.status(500).json({ error: "Internal server error" });
	}
}
