import type { LinkCheckResultEvent } from "@sf-gov/shared";

/**
 * Extended result type that includes link text
 */
export interface LinkCheckResult extends LinkCheckResultEvent {
	text: string;
}

interface LinkCheckerCacheEntry {
	results: LinkCheckResult[];
	timestamp: number;
}

const linkCheckerCache = new Map<string, LinkCheckerCacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function getCachedResults(pageUrl: string): LinkCheckResult[] | null {
	const entry = linkCheckerCache.get(pageUrl);
	if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
		return entry.results;
	}
	return null;
}

export function setCachedResults(pageUrl: string, results: LinkCheckResult[]): void {
	linkCheckerCache.set(pageUrl, {
		results,
		timestamp: Date.now(),
	});
}

export function clearLinkCheckerCache(pageUrl?: string): void {
	if (pageUrl) {
		linkCheckerCache.delete(pageUrl);
	} else {
		linkCheckerCache.clear();
	}
}
