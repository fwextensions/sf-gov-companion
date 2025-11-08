import React from "react";

interface PreviewBannerProps {
	timestamp: number;
}

export const PreviewBanner: React.FC<PreviewBannerProps> = ({ timestamp }) => {
	// Format timestamp to readable date/time
	const formatTimestamp = (ts: number): string => {
		const date = new Date(ts);
		return date.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			second: "2-digit",
			hour12: true
		});
	};

	return (
		<div className="bg-amber-50 border border-amber-200 rounded-lg shadow-sm p-4 mb-4">
			<div className="flex items-center gap-2">
				<svg
					className="w-5 h-5 text-amber-600 shrink-0"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
					/>
				</svg>
				<div className="flex-1">
					<p className="text-sm font-medium text-amber-900">
						Viewing draft preview
					</p>
					<p className="text-xs text-amber-700 mt-0.5">
						Last updated: {formatTimestamp(timestamp)}
					</p>
				</div>
			</div>
		</div>
	);
};
