import { useState } from "react";
import { runA11yCheck, type A11yResult } from "../../lib/a11y-check";
import { Button } from "./Button";
import { Card } from "@/sidepanel/components/Card.tsx";

const RunningLabel = () => (
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
		Running Check...
	</>
);

const Results = ({ results }: { results: A11yResult[] }) => (
	<div className="mt-4 space-y-3">
		<div className="text-sm text-gray-500 font-medium">
			Found {results.length} issue{results.length === 1 ? "" : "s"}:
		</div>
		<div className="space-y-2 pr-1">
			{results.map((result, index) => (
				<div
					key={index}
					className="p-3 bg-gray-50 rounded border border-gray-100 text-sm"
				>
					<div className="font-medium text-gray-900 mb-1">
						{result.type}
					</div>
					{result.details && (
						<div className="text-gray-600 mb-1">{result.details}</div>
					)}
					{result.linkText && (
						<div className="text-gray-600">
							<span className="font-medium">Text:</span>{" "}
							{result.linkText}
						</div>
					)}
					{result.targetUrl && (
						<div className="text-gray-600 break-all">
							<span className="font-medium">Target:</span>{" "}
							{result.targetUrl}
						</div>
					)}
					{result.imageFilename && (
						<div className="text-gray-600 break-all">
							<span className="font-medium">File:</span>{" "}
							{result.imageFilename}
						</div>
					)}
				</div>
			))}
		</div>
	</div>
);

export function A11yCheckCard()
{
	const [results, setResults] = useState<A11yResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hasRun, setHasRun] = useState(false);

	const handleRunCheck = async () => {
		setIsLoading(true);
		setError(null);
		setResults([]);
		setHasRun(false);

		try {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (!tab?.id) {
				throw new Error("No active tab found");
			}

			const injectionResults = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				func: runA11yCheck,
			});

			const result = injectionResults[0]?.result;
			if (result) {
				setResults(result as A11yResult[]);
			}
			setHasRun(true);
		} catch (err) {
			console.error("A11y check failed:", err);
			setError(err instanceof Error ? err.message : "Unknown error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card title="Accessibility Check" collapsible={hasRun}>
			<Button
				onClick={handleRunCheck}
				disabled={isLoading}
				className="self-start"
			>
				{isLoading ? <RunningLabel /> : "Run Check"}
			</Button>

			{error && (
				<div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100">
					{error}
				</div>
			)}

			{hasRun &&
				<div className="mt-4 text-sm">
					Remember to <a href="https://sfdigitalservices.gitbook.io/digital-accessibility-for-sf.gov-editors/page-content" target="_blank">perform manual tests</a> to confirm accessibility.
				</div>
			}

			{hasRun && results.length === 0 && !error && (
				<div className="mt-4 p-3 bg-green-50 text-green-700 text-sm rounded border border-green-100">
					No accessibility issues found!
				</div>
			)}

			{results.length > 0 && <Results results={results} />}
		</Card>
	);
}
