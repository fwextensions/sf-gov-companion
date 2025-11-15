import React, { useState, useEffect } from "react";
import { Card } from "./Card";
import type { FeedbackRecord, AirtableApiError } from "@sf-gov/shared";
import { getFeedbackByPath, clearCache } from "@/api/airtable-client";

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
				ID:{" "}
				<a
					href={`https://airtable.com/appo4SjothLkSxmbG/tblbhivrMRm5X8eSU/viwgRjwYR6z9CsRc2/${record.id}`}
					target="_blank"
					rel="noopener noreferrer"
					title="View record in Airtable"
					className="text-blue-600 hover:text-blue-800 hover:underline"
				>
					{record.submissionId}
				</a>
			</div>
		</div>
	);
};

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ pagePath }) => {
	const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
	const [error, setError] = useState<AirtableApiError | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	// fetch feedback when pagePath changes
	useEffect(() => {
		loadFeedback();
	}, [pagePath]);

	const loadFeedback = async () => {
		setIsLoading(true);
		setError(null);

		try {
			// fetch feedback via proxy (uses Wagtail session cookie)
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

	// error state
	if (error) {
		return (
			<Card title="User Feedback">
				<div className="space-y-3">
					<div className="text-sm text-red-600">
						<p className="font-medium">{error.message}</p>
					</div>
					{error.type === "auth" && (
						<div className="text-sm text-gray-600">
							<p>To view user feedback, you need to be logged in to Karl.</p>
						</div>
					)}
					{error.retryable && (
						<button
							onClick={handleRetry}
							className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
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
