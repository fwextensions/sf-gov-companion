import React, { useState, useEffect } from "react";
import { Card } from "./Card";
import type { FeedbackRecord, AirtableApiError } from "@/types/airtable";
import { getFeedbackByPath, getAccessToken, setAccessToken, clearCache } from "@/api/airtable-client";

interface FeedbackCardProps {
	pagePath: string;
}

interface FeedbackItemProps {
	record: FeedbackRecord;
}

const FeedbackItem: React.FC<FeedbackItemProps> = ({ record }) => {
	// format date to readable format
	const formatDate = (dateString: string): string => {
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		} catch {
			return dateString;
		}
	};

	return (
		<div className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
			{/* header: date and helpfulness */}
			<div className="flex items-center justify-between mb-2">
				<div className="text-xs text-gray-500">
					{formatDate(record.submissionCreated)}
				</div>
				{record.wasHelpful && (
					<div
						className={`text-xs font-medium px-2 py-1 rounded ${
							record.wasHelpful === "yes"
								? "bg-green-100 text-green-800"
								: "bg-orange-100 text-orange-800"
						}`}
					>
						{record.wasHelpful === "yes" ? "👍 Helpful" : "👎 Not Helpful"}
					</div>
				)}
			</div>

			{/* issue category (if not helpful) */}
			{record.wasHelpful === "no" && record.issueCategory && (
				<div className="text-sm mb-2">
					<span className="font-medium text-gray-700">Issue: </span>
					<span className="text-gray-900">{record.issueCategory}</span>
				</div>
			)}

			{/* what was helpful (if helpful) */}
			{record.wasHelpful === "yes" && record.whatWasHelpful && (
				<div className="text-sm mb-2">
					<span className="font-medium text-gray-700">What was helpful: </span>
					<span className="text-gray-900">{record.whatWasHelpful}</span>
				</div>
			)}

			{/* additional details */}
			{record.additionalDetails && (
				<div className="text-sm mb-2">
					<span className="font-medium text-gray-700">Details: </span>
					<span className="text-gray-900">{record.additionalDetails}</span>
				</div>
			)}

			{/* submission ID (small, at bottom) */}
			<div className="text-xs text-gray-400 mt-2">
				ID: {record.submissionId}
			</div>
		</div>
	);
};

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ pagePath }) => {
	const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
	const [error, setError] = useState<AirtableApiError | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [hasToken, setHasToken] = useState<boolean>(false);
	const [tokenInput, setTokenInput] = useState<string>("");
	const [isSavingToken, setIsSavingToken] = useState<boolean>(false);

	// fetch feedback when pagePath changes
	useEffect(() => {
		loadFeedback();
	}, [pagePath]);

	const loadFeedback = async () => {
		setIsLoading(true);
		setError(null);

		try {
			// check if token exists
			const token = await getAccessToken();
			setHasToken(!!token);

			if (!token) {
				setIsLoading(false);
				return;
			}

			// fetch feedback
			const records = await getFeedbackByPath(pagePath);
			setFeedback(records);
		} catch (err) {
			setError(err as AirtableApiError);
		} finally {
			setIsLoading(false);
		}
	};

	const handleRetry = () => {
		// clear cache and refetch
		clearCache(pagePath);
		loadFeedback();
	};

	const handleSaveToken = async () => {
		if (!tokenInput.trim()) {
			return;
		}

		setIsSavingToken(true);
		try {
			await setAccessToken(tokenInput);
			setHasToken(true);
			setTokenInput("");
			// reload feedback after saving token
			loadFeedback();
		} catch (err) {
			console.error("Failed to save token:", err);
		} finally {
			setIsSavingToken(false);
		}
	};

	// loading state
	if (isLoading) {
		return (
			<Card title="User Feedback">
				<div className="flex items-center justify-center py-8">
					<div className="text-sm text-gray-500">Loading feedback...</div>
				</div>
			</Card>
		);
	}

	// no token configured
	if (!hasToken) {
		return (
			<Card title="User Feedback">
				<div className="space-y-3">
					<p className="text-sm text-gray-600">
						Enter your Airtable Personal Access Token to view user feedback.
					</p>
					<input
						type="password"
						value={tokenInput}
						onChange={(e) => setTokenInput(e.target.value)}
						placeholder="pat..."
						className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
					/>
					<button
						onClick={handleSaveToken}
						disabled={!tokenInput.trim() || isSavingToken}
						className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
					>
						{isSavingToken ? "Saving..." : "Save Token"}
					</button>
				</div>
			</Card>
		);
	}

	// error state
	if (error) {
		return (
			<Card title="User Feedback">
				<div className="text-sm text-red-600">
					<p>{error.message}</p>
					{error.retryable && (
						<button
							onClick={handleRetry}
							className="mt-2 text-blue-600 hover:underline"
						>
							Retry
						</button>
					)}
				</div>
			</Card>
		);
	}

	// no feedback available
	if (feedback.length === 0) {
		return (
			<Card title="User Feedback">
				<div className="text-sm text-gray-500 italic">
					No feedback submitted for this page yet.
				</div>
			</Card>
		);
	}

	// display feedback
	return (
		<Card title="User Feedback">
			<div className="space-y-4">
				{feedback.map((record) => (
					<FeedbackItem key={record.id} record={record} />
				))}
			</div>
		</Card>
	);
};
