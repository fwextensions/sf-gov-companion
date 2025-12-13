import { useState, useEffect } from "react";
import { extractContentLinks, checkLinkInPage, type LinkInfo, type LinkCheckResult } from "../../lib/link-check";
import { Button } from "./Button";
import { Card } from "./Card";

interface LinkCheckerCacheEntry {
	results: LinkCheckResult[];
	timestamp: number;
}

const linkCheckerCache = new Map<string, LinkCheckerCacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCachedResults(pageUrl: string): LinkCheckResult[] | null
{
	const entry = linkCheckerCache.get(pageUrl);
	if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
		return entry.results;
	}
	return null;
}

function setCachedResults(pageUrl: string, results: LinkCheckResult[]): void
{
	linkCheckerCache.set(pageUrl, {
		results,
		timestamp: Date.now(),
	});
}

export function clearLinkCheckerCache(pageUrl?: string): void
{
	if (pageUrl) {
		linkCheckerCache.delete(pageUrl);
	} else {
		linkCheckerCache.clear();
	}
}

async function checkLinkViaPageContext(tabId: number, url: string): Promise<LinkCheckResult>
{
	const results = await chrome.scripting.executeScript({
		target: { tabId },
		func: checkLinkInPage,
		args: [url],
	});
	const response = results[0]?.result || { status: "error", error: "Script execution failed" };
	return { url, text: "", ...response };
}

const RunningLabel = ({ checked, total }: { checked: number; total: number }) => (
	<>
		<svg
			className="animate-spin h-4 w-4 text-white"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			></circle>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
		Checking {checked}/{total}...
	</>
);

const IssueItem = ({ result }: { result: LinkCheckResult }) => (
	<div className="p-3 bg-gray-50 rounded border border-gray-100 text-sm">
		<div className="font-medium text-gray-900 mb-1 flex items-center gap-2">
			<span className={
				result.status === "broken" ? "text-red-600" :
				result.status === "timeout" ? "text-yellow-600" :
				result.status === "insecure" ? "text-amber-600" :
				"text-orange-600"
			}>
				{result.status === "broken" && `${result.statusCode || "Error"}`}
				{result.status === "timeout" && "Timeout"}
				{result.status === "error" && "Error"}
				{result.status === "insecure" && "Insecure"}
			</span>
		</div>
		{result.text && (
			<div className="text-gray-600 mb-1">
				<span className="font-medium">Text:</span> {result.text}
			</div>
		)}
		<div className="text-gray-600 break-all">
			<span className="font-medium">URL:</span>{" "}
			<a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sfgov-blue hover:underline">
				{result.url}
			</a>
		</div>
		{result.error && (
			<div className="text-gray-500 text-xs mt-1">{result.error}</div>
		)}
	</div>
);

const Results = ({ results, totalChecked }: { results: LinkCheckResult[]; totalChecked: number }) => {
	const brokenLinks = results.filter(r => r.status === "broken" || r.status === "timeout" || r.status === "error");
	const insecureLinks = results.filter(r => r.status === "insecure");
	const issueCount = brokenLinks.length + insecureLinks.length;

	return (
		<div className="mt-4 space-y-3">
			<div className="text-sm text-gray-500 font-medium">
				Checked {totalChecked} link{totalChecked === 1 ? "" : "s"}, found {issueCount} issue{issueCount === 1 ? "" : "s"}
			</div>
			{brokenLinks.length > 0 && (
				<div className="space-y-2 pr-1">
					{brokenLinks.map((result, index) => (
						<IssueItem key={index} result={result} />
					))}
				</div>
			)}
			{insecureLinks.length > 0 && (
				<>
					<div className="text-sm text-amber-600 font-medium mt-3">
						{insecureLinks.length} insecure (HTTP) link{insecureLinks.length === 1 ? "" : "s"}
					</div>
					<div className="space-y-2 pr-1">
						{insecureLinks.map((result, index) => (
							<IssueItem key={`insecure-${index}`} result={result} />
						))}
					</div>
				</>
			)}
		</div>
	);
};

interface LinkCheckerCardProps {
	pageUrl: string;
}

export function LinkCheckerCard({ pageUrl }: LinkCheckerCardProps)
{
	const [results, setResults] = useState<LinkCheckResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hasRun, setHasRun] = useState(false);
	const [progress, setProgress] = useState({ checked: 0, total: 0 });

	// restore cached results when pageUrl changes
	useEffect(() => {
		const cached = getCachedResults(pageUrl);
		if (cached) {
			setResults(cached);
			setHasRun(true);
		} else {
			setResults([]);
			setHasRun(false);
		}
		setError(null);
	}, [pageUrl]);

	const handleRunCheck = async () => {
		setIsLoading(true);
		setError(null);
		setResults([]);
		setHasRun(false);
		setProgress({ checked: 0, total: 0 });

		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab?.id) {
				throw new Error("No active tab found");
			}

			// extract links from the page
			const injectionResults = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				func: extractContentLinks,
			});

			const links = injectionResults[0]?.result as LinkInfo[] | undefined;
			if (!links || links.length === 0) {
				setHasRun(true);
				setIsLoading(false);
				return;
			}

			setProgress({ checked: 0, total: links.length });

			// check each link
			const checkResults: LinkCheckResult[] = [];
			for (let i = 0; i < links.length; i++) {
				const link = links[i];
				const result = await checkLinkViaPageContext(tab.id, link.url);
				result.text = link.text;
				checkResults.push(result);
				setProgress({ checked: i + 1, total: links.length });
				setResults([...checkResults]);
			}

			setCachedResults(pageUrl, checkResults);
			setHasRun(true);
		} catch (err) {
			console.error("Link check failed:", err);
			setError(err instanceof Error ? err.message : "Unknown error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const brokenCount = results.filter(r => r.status === "broken" || r.status === "timeout" || r.status === "error").length;
	const insecureCount = results.filter(r => r.status === "insecure").length;
	const issueCount = brokenCount + insecureCount;

	return (
		<Card title="Link Checker">
			<Button
				onClick={handleRunCheck}
				disabled={isLoading}
				className="self-start"
			>
				{isLoading ? <RunningLabel checked={progress.checked} total={progress.total} /> : "Check Links"}
			</Button>

			{error && (
				<div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100">
					{error}
				</div>
			)}

			{hasRun && results.length === 0 && !error && (
				<div className="mt-4 p-3 bg-gray-50 text-gray-600 text-sm rounded border border-gray-100">
					No links found in the main content area.
				</div>
			)}

			{hasRun && results.length > 0 && issueCount === 0 && !error && (
				<div className="mt-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-100">
					All {results.length} link{results.length === 1 ? "" : "s"} are working!
				</div>
			)}

			{results.length > 0 && issueCount > 0 && (
				<Results results={results} totalChecked={results.length} />
			)}
		</Card>
	);
}
