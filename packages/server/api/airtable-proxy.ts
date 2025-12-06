import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { AirtableResponse, FeedbackRecord } from "@sf-gov/shared";

// cache TTL for session validation (5 minutes in seconds)
// We use a constant here for simplicity with the raw fetch implementation, 
// matching feedback-stats pattern
const SESSION_CACHE_TTL = 300;
const WAGTAIL_VALIDATION_TIMEOUT = parseInt(process.env.WAGTAIL_VALIDATION_TIMEOUT || "5000", 10); // default: 5 seconds in milliseconds

/**
 * Environment variables required for the proxy
 * 
 * Note: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are automatically
 * read by Redis.fromEnv() and do not need to be included here.
 */
interface ProxyEnv {
	WAGTAIL_API_URL: string;
	AIRTABLE_API_KEY: string;
	AIRTABLE_BASE_ID: string;
	AIRTABLE_TABLE_NAME: string;
	UPSTASH_REDIS_REST_URL?: string;
	UPSTASH_REDIS_REST_TOKEN?: string;
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
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	};

	const required = ["WAGTAIL_API_URL", "AIRTABLE_API_KEY", "AIRTABLE_BASE_ID", "AIRTABLE_TABLE_NAME"];
	const missing = required.filter(key => !env[key as keyof ProxyEnv]);

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
 * Raw Redis Fetch Implementation
 */
async function redisGet<T>(key: string, url: string, token: string): Promise<T | null> {
	try {
		const encodedKey = encodeURIComponent(key);
		const fetchUrl = `${url}/get/${encodedKey}`;
		const response = await fetch(fetchUrl, {
			headers: { Authorization: `Bearer ${token}` }
		});

		if (!response.ok) return null;

		const data: any = await response.json();
		if (!data.result) return null;

		try {
			return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
		} catch {
			return data.result as T;
		}
	} catch (error) {
		console.error(`Redis GET failed for ${key}:`, error);
		return null;
	}
}

async function redisSet(key: string, value: any, url: string, token: string, ttlSeconds: number): Promise<void> {
	try {
		const encodedKey = encodeURIComponent(key);
		const fetchUrl = `${url}/set/${encodedKey}?ex=${ttlSeconds}`;
		const body = JSON.stringify(value);

		const response = await fetch(fetchUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json"
			},
			body: body
		});

		if (!response.ok) {
			const text = await response.text();
			console.error(`Redis SET failed for ${key}: ${response.status} ${text}`);
		}
	} catch (error) {
		console.error(`Redis SET failed for ${key}:`, error);
	}
}

async function redisIncr(key: string, url: string, token: string): Promise<number | null> {
	try {
		const encodedKey = encodeURIComponent(key);
		const fetchUrl = `${url}/incr/${encodedKey}`;
		const response = await fetch(fetchUrl, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!response.ok) {
			console.error(`Redis INCR failed for ${key}: ${response.status}`);
			return null;
		}
		const data: any = await response.json();
		return data.result as number;
	} catch (error) {
		console.error(`Redis INCR failed for ${key}:`, error);
		return null;
	}
}

async function redisExpire(key: string, seconds: number, url: string, token: string): Promise<void> {
	try {
		const encodedKey = encodeURIComponent(key);
		const fetchUrl = `${url}/expire/${encodedKey}/${seconds}`;
		const response = await fetch(fetchUrl, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!response.ok) {
			console.error(`Redis EXPIRE failed for ${key}: ${response.status}`);
		}
	} catch (error) {
		console.error(`Redis EXPIRE failed for ${key}:`, error);
	}
}

/**
 * Implements rate limiting using Upstash Redis
 * Returns true if request should be allowed, false if rate limited
 * 
 * Uses Redis INCR and EXPIRE commands to track request counts per identifier
 * within a sliding window. If Redis is unavailable, fails open to allow requests.
 */
async function checkRateLimit(identifier: string, redisUrl?: string, redisToken?: string): Promise<boolean> {
	if (!redisUrl || !redisToken) return true; // Fail open if Redis not configured

	const key = `ratelimit:${identifier}`;
	const limit = 10; // requests
	const window = 10; // seconds

	try {
		const current = await redisIncr(key, redisUrl, redisToken);

		if (current === 1) {
			// first request in window, set expiration using Redis EXPIRE
			await redisExpire(key, window, redisUrl, redisToken);
		}

		return (current || 0) <= limit;
	} catch (error) {
		// if Upstash Redis fails, allow the request (fail open)
		console.error("Redis rate limit check failed:", error);
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

		const fetchPromise = fetch(validationUrl, {
			method: "GET",
			headers: {
				"Cookie": `sessionid=${sessionId}`,
				"User-Agent": "SF-Gov-Companion-Extension/1.0",
				"X-SF-Gov-Extension": "companion",
			},
			redirect: "manual", // don't follow redirects
		});

		const timeoutPromise = new Promise<Response>((_, reject) => {
			setTimeout(() => reject(new Error("Request timed out")), WAGTAIL_VALIDATION_TIMEOUT);
		});

		const response = await Promise.race([fetchPromise, timeoutPromise]);

		console.log(`Wagtail session validation response: ${response.status} ${response.statusText}`);

		// consider 200 OK and 3xx redirects as valid (logged in users get redirected)
		return response.ok || (response.status >= 300 && response.status < 400);
	} catch (error) {
		console.error("Wagtail session validation failed:", error);
		return false;
	}
}

/**
 * Truncates session ID for logging (first 8 characters)
 */
function truncateSessionId(sessionId: string): string {
	return sessionId.substring(0, 8);
}

/**
 * Validates session with caching using Upstash Redis
 * Cache TTL: configurable via SESSION_CACHE_TTL environment variable (default: 5 minutes)
 * 
 * Uses Redis GET and SET commands with expiration to cache session validation results.
 * Falls back to direct Wagtail validation if Redis operations fail.
 */
async function validateSessionWithCache(sessionId: string, wagtailApiUrl: string, redisUrl?: string, redisToken?: string): Promise<boolean> {
	const cacheKey = `session:${sessionId}`;
	const truncatedId = truncateSessionId(sessionId);

	// check cache
	if (redisUrl && redisToken) {
		const cacheReadStart = Date.now();
		const cached = await redisGet<boolean>(cacheKey, redisUrl, redisToken);
		const cacheReadDuration = Date.now() - cacheReadStart;

		if (cached !== null) {
			// Redis cache hit - log with performance timing
			console.log(`Session cache hit for session:${truncatedId} (${cacheReadDuration}ms)`);
			return cached;
		}
	}

	// Redis cache miss - log before validation
	console.log(`Session cache miss for session:${truncatedId}, validating with Wagtail`);

	// validate with Wagtail
	const isValid = await validateWagtailSession(sessionId, wagtailApiUrl);

	// store result in Upstash Redis cache if valid
	if (isValid && redisUrl && redisToken) {
		try {
			const cacheWriteStart = Date.now();
			await redisSet(cacheKey, true, redisUrl, redisToken, SESSION_CACHE_TTL);
			const cacheWriteDuration = Date.now() - cacheWriteStart;

			// Redis cache write success - log with timing
			console.log(`Session validation result cached for session:${truncatedId} (${cacheWriteDuration}ms)`);
		} catch (writeError) {
			// Redis cache write failed - log error but continue
			console.error(`Redis cache write failed for session:${truncatedId}:`, writeError);
		}
	}

	return isValid;
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

	let timeoutId: NodeJS.Timeout;

	try {
		const fetchPromise = fetch(url.toString(), {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
			},
		});

		const timeoutPromise = new Promise<Response>((_, reject) => {
			timeoutId = setTimeout(() => reject(new Error("Request timed out")), 30000);
		});

		const response = await Promise.race([fetchPromise, timeoutPromise]);
		clearTimeout(timeoutId!);

		if (!response.ok) {
			const text = await response.text();
			console.error(`Airtable API error: ${response.status} ${text}`);
			throw new Error(`Airtable API error: ${response.status}`);
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
		// @ts-ignore
		if (typeof timeoutId !== 'undefined') clearTimeout(timeoutId);
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
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Wagtail-Session, X-SF-Gov-Extension");
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
		const rateLimitOk = await checkRateLimit(sessionId, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
		if (!rateLimitOk) {
			return res.status(429).json({
				error: "Too many requests. Please wait a moment and try again."
			});
		}

		// Validate session with caching
		const isValidSession = await validateSessionWithCache(sessionId, env.WAGTAIL_API_URL, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
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
