import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { AirtableResponse, FeedbackStats } from "@sf-gov/shared";

// cache TTL for feedback stats (2 hours in seconds)
const STATS_CACHE_TTL = 7200;
const WAGTAIL_VALIDATION_TIMEOUT = parseInt(process.env.WAGTAIL_VALIDATION_TIMEOUT || "5000", 10);

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

/**
 * Raw Redis Fetch Implementation to avoid @upstash/redis client crashes on Windows
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

    // Upstash REST API returns the stringified JSON if it was stored as JSON
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
        "Content-Type": "application/json" // Upstash expects raw body or text
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

async function validateWagtailSession(sessionId: string, wagtailApiUrl: string): Promise<boolean> {
  let timeoutId: NodeJS.Timeout;
  try {
    const baseUrl = wagtailApiUrl.replace(/\/$/, "");
    const validationUrl = `${baseUrl}/pages`;

    const fetchPromise = fetch(validationUrl, {
      method: "GET",
      headers: {
        "Cookie": `sessionid=${sessionId}`,
        "User-Agent": "SF-Gov-Companion-Extension/1.0",
        "X-SF-Gov-Extension": "companion",
      },
      redirect: "manual",
    });

    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Request timed out")), WAGTAIL_VALIDATION_TIMEOUT);
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId!);

    // Debug 301s
    if (response.status === 301 || response.status === 302) {
      console.log(`Wagtail validation redirect: ${response.status} to ${response.headers.get('location')}`);
    }

    return response.ok || (response.status >= 300 && response.status < 400);
  } catch (error) {
    console.error("Wagtail session validation failed:", error);
    return false;
  } finally {
    // @ts-ignore
    if (typeof timeoutId !== 'undefined') clearTimeout(timeoutId);
  }
}

// Helper to check session using raw fetch if Redis env vars are present
async function validateSession(sessionId: string, wagtailApiUrl: string, redisUrl?: string, redisToken?: string): Promise<boolean> {
  const cacheKey = `session:${sessionId}`;

  if (redisUrl && redisToken) {
    console.log(`Checking session cache for ${cacheKey}`);
    const cached = await redisGet<boolean>(cacheKey, redisUrl, redisToken);
    if (cached !== null) {
      console.log(`Session cache hit for ${sessionId}: ${cached}`);
      return cached;
    }
    console.log(`Session cache miss for ${sessionId}`);
  }

  const valid = await validateWagtailSession(sessionId, wagtailApiUrl);

  if (valid && redisUrl && redisToken) {
    console.log(`Caching valid session for ${sessionId}`);
    await redisSet(cacheKey, true, redisUrl, redisToken, 300);
  }
  return valid;
}

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0];
  const withoutTrailingSlash = withoutQuery === "/" ? "/" : withoutQuery.replace(/\/+$/, "");
  return withoutTrailingSlash.toLowerCase();
}

async function fetchAllAirtableFeedback(
  pagePath: string,
  env: ProxyEnv
): Promise<FeedbackStats> {
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
    url.searchParams.set("fields[]", "wasTheLastPageYouViewedHelpful");
    if (offset) {
      url.searchParams.set("offset", offset);
    }

    console.log(`Fetching page ${requestCount} from Airtable for ${normalizedPath}`);
    const pageStart = Date.now();
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
      if (typeof timeoutId !== 'undefined') clearTimeout(timeoutId);
      throw e;
    }

    if (!response.ok) {
      console.error(`Airtable error after ${Date.now() - pageStart}ms: ${response.status}`);
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const data = await response.json() as AirtableResponse;
    allRecords = allRecords.concat(data.records);
    offset = data.offset;

  } while (offset);

  const duration = Date.now() - startTime;
  console.log(`Fetched ${allRecords.length} records from Airtable in ${duration}ms (${requestCount} requests)`);

  let total = 0;
  let helpful = 0;
  let notHelpful = 0;

  allRecords.forEach(record => {
    const wasHelpful = record.fields.wasTheLastPageYouViewedHelpful;
    if (wasHelpful) {
      const val = String(wasHelpful).toLowerCase();
      if (val === 'yes' || val === 'true') {
        helpful++;
        total++;
      } else if (val === 'no' || val === 'false') {
        notHelpful++;
        total++;
      }
    }
  });

  total = allRecords.length;

  let helpfulPercent = 0;
  let notHelpfulPercent = 0;

  if (total > 0) {
    helpfulPercent = Math.round((helpful / total) * 100);
    notHelpfulPercent = Math.round((notHelpful / total) * 100);
  }

  return {
    total,
    helpful,
    notHelpful,
    helpfulPercent,
    notHelpfulPercent
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  const isValidOrigin = validateOrigin(origin);

  if (isValidOrigin && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Wagtail-Session, X-SF-Gov-Extension");
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

    const isValidSession = await validateSession(
      sessionId,
      env.WAGTAIL_API_URL,
      env.UPSTASH_REDIS_REST_URL,
      env.UPSTASH_REDIS_REST_TOKEN
    );
    if (!isValidSession) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const pagePath = req.query.pagePath as string | undefined;
    if (!pagePath) {
      return res.status(400).json({ error: "Missing pagePath" });
    }

    const normalizedPath = normalizePath(pagePath);
    const cacheKey = `feedback_stats:${normalizedPath}`;

    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      const cachedStats = await redisGet<FeedbackStats>(cacheKey, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
      if (cachedStats) {
        console.log(`Stats cache hit for ${normalizedPath}`);
        return res.status(200).json(cachedStats);
      }
    }

    const stats = await fetchAllAirtableFeedback(pagePath, env);

    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      await redisSet(cacheKey, stats, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN, STATS_CACHE_TTL);
    }

    return res.status(200).json(stats);

  } catch (error) {
    console.error("Stats handler error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
