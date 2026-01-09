import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { AirtableResponse, FeedbackRecord, FeedbackResponse, FeedbackStats } from "@sf-gov/shared";
import { validateWagtailSession } from "../lib/auth.js";

// cache TTL for feedback data (2 hours in seconds)
const FEEDBACK_CACHE_TTL = 7200;
const SESSION_CACHE_TTL = 300;

interface ProxyEnv {
	WAGTAIL_API_URL: string;
	AIRTABLE_API_KEY: string;
	AIRTABLE_BASE_ID: string;
	AIRTABLE_TABLE_NAME: string;
	UPSTASH_REDIS_REST_URL?: string;
	UPSTASH_REDIS_REST_TOKEN?: string;
}

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

async function redisGet<T>(key: string, url: string, token: string): Promise<T | null> {
	const start = Date.now();
	try {
		const encodedKey = encodeURIComponent(key);
		const fetchUrl = `${url}/get/${encodedKey}`;
		const response = await fetch(fetchUrl, {
			headers: { Authorization: `Bearer ${token}` }
		});

		if (!response.ok) {
			console.log(`Redis GET ${key}: ${Date.now() - start}ms (not ok)`);
			return null;
		}

		const data: any = await response.json();
		console.log(`Redis GET ${key}: ${Date.now() - start}ms`);
		if (!data.result) return null;

		try {
			return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
		} catch {
			return data.result as T;
		}
	} catch (error) {
		console.error(`Redis GET failed for ${key} after ${Date.now() - start}ms:`, error);
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

function validateOrigin(origin: string | undefined): boolean {
	if (!origin) return false;
	if (origin.startsWith("chrome-extension://") || origin.startsWith("edge-extension://")) {
		return true;
	}
	if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
		return true;
	}
	return false;
}

function normalizePath(path: string): string {
	const withoutQuery = path.split("?")[0];
	const withoutTrailingSlash = withoutQuery === "/" ? "/" : withoutQuery.replace(/\/+$/, "");
	return withoutTrailingSlash.toLowerCase();
}

async function fetchAllAirtableFeedback(
	pagePath: string,
	env: ProxyEnv
): Promise<FeedbackResponse> {
	const normalizedPath = normalizePath(pagePath);
	const encodedTableName = encodeURIComponent(env.AIRTABLE_TABLE_NAME);
	const filterFormula = `LOWER({referrer})='${normalizedPath}'`;

	let allRecords: any[] = [];
	let offset: string | undefined;

	let requestCount = 0;
	const MAX_REQUESTS = 50;
	const startTime = Date.now();

	do {
		requestCount++;
		if (requestCount > MAX_REQUESTS) {
			console.warn(`Hit max requests limit for path: ${pagePath}`);
			break;
		}

		const url = new URL(
			`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodedTableName}`
		);
		url.searchParams.set("filterByFormula", filterFormula);
		url.searchParams.set("sort[0][field]", "submission_created");
		url.searchParams.set("sort[0][direction]", "desc");
		if (offset) {
			url.searchParams.set("offset", offset);
		}

		console.log(`Fetching page ${requestCount} from Airtable for ${normalizedPath}`);
		let timeoutId: NodeJS.Timeout;

		const fetchPromise = fetch(url.toString(), {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
			},
		});

		const timeoutPromise = new Promise<Response>((_, reject) => {
			timeoutId = setTimeout(() => reject(new Error("Request timed out")), 30000);
		});

		let response: Response;
		try {
			response = await Promise.race([fetchPromise, timeoutPromise]);
			clearTimeout(timeoutId!);
		} catch (e) {
			// @ts-ignore
			if (typeof timeoutId !== "undefined") clearTimeout(timeoutId);
			throw e;
		}

		if (!response.ok) {
			console.error(`Airtable error: ${response.status}`);
			throw new Error(`Airtable API error: ${response.status}`);
		}

		const data = await response.json() as AirtableResponse;
		allRecords = allRecords.concat(data.records);
		offset = data.offset;

	} while (offset);

	const duration = Date.now() - startTime;
	console.log(`Fetched ${allRecords.length} records from Airtable in ${duration}ms (${requestCount} requests)`);

	// calculate stats
	let helpful = 0;
	let notHelpful = 0;

	allRecords.forEach(record => {
		const wasHelpful = record.fields.wasTheLastPageYouViewedHelpful;
		if (wasHelpful) {
			const val = String(wasHelpful).toLowerCase();
			if (val === "yes" || val === "true") {
				helpful++;
			} else if (val === "no" || val === "false") {
				notHelpful++;
			}
		}
	});

	const total = allRecords.length;
	const helpfulPercent = total > 0 ? Math.round((helpful / total) * 100) : 0;
	const notHelpfulPercent = total > 0 ? Math.round((notHelpful / total) * 100) : 0;

	const stats: FeedbackStats = {
		total,
		helpful,
		notHelpful,
		helpfulPercent,
		notHelpfulPercent
	};

	// filter to records with text feedback
	const recordsWithDetails = allRecords.filter(record => record.fields.shareMoreDetails);
	const recentRecords: FeedbackRecord[] = recordsWithDetails.map(record => ({
		id: record.id,
		submissionId: record.fields.submission_id,
		submissionCreated: record.fields.submission_created,
		referrer: record.fields.referrer,
		wasHelpful: record.fields.wasTheLastPageYouViewedHelpful || null,
		issueCategory: record.fields.whatWasWrongWithThePage1 || null,
		whatWasHelpful: record.fields.whatWasHelpful || null,
		additionalDetails: record.fields.shareMoreDetails || null,
	}));

	return { stats, records: recentRecords };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const handlerStart = Date.now();
	const origin = req.headers.origin as string | undefined;
	const isValidOrigin = validateOrigin(origin);

	if (isValidOrigin && origin) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Wagtail-Session, X-SF-Gov-Extension");
		res.setHeader("Access-Control-Max-Age", "86400");
	}

	if (req.method === "OPTIONS") {
		return isValidOrigin ? res.status(200).end() : res.status(403).json({ error: "Invalid origin" });
	}

	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	if (!isValidOrigin) {
		return res.status(403).json({ error: "Invalid origin" });
	}

	try {
		const env = validateEnv();

		const sessionId = req.headers["x-wagtail-session"] as string | undefined;
		if (!sessionId) {
			return res.status(401).json({ error: "Missing session token" });
		}

		const pagePath = req.query.pagePath as string | undefined;
		if (!pagePath) {
			return res.status(400).json({ error: "Missing pagePath" });
		}

		const normalizedPath = normalizePath(pagePath);
		const cacheKey = `feedback:${normalizedPath}`;
		const sessionCacheKey = `session:${sessionId}`;

		// check both caches in parallel
		let cachedSession: boolean | null = null;
		let cachedFeedback: FeedbackResponse | null = null;

		if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
			[cachedSession, cachedFeedback] = await Promise.all([
				redisGet<boolean>(sessionCacheKey, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN),
				redisGet<FeedbackResponse>(cacheKey, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
			]);
		}

		// validate session
		let isValidSession = cachedSession === true;
		if (cachedSession !== null) {
			console.log(`Session cache hit for ${sessionId.substring(0, 8)}`);
		} else {
			console.log(`Session cache miss for ${sessionId.substring(0, 8)}`);
			isValidSession = await validateWagtailSession(sessionId, env.WAGTAIL_API_URL);
			if (isValidSession && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
				// don't await - fire and forget
				redisSet(sessionCacheKey, true, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN, SESSION_CACHE_TTL);
			}
		}

		if (!isValidSession) {
			return res.status(401).json({ error: "Invalid session" });
		}

		// return cached feedback if available
		if (cachedFeedback) {
			console.log(`Feedback cache hit for ${normalizedPath} - total handler time: ${Date.now() - handlerStart}ms`);
			return res.status(200).json(cachedFeedback);
		}

		const feedbackData = await fetchAllAirtableFeedback(pagePath, env);

		// cache the result
		if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
			await redisSet(cacheKey, feedbackData, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN, FEEDBACK_CACHE_TTL);
		}

		return res.status(200).json(feedbackData);

	} catch (error) {
		console.error("Feedback handler error:", error);
		return res.status(500).json({ error: "Internal server error" });
	}
}
