import React, { useState } from "react";

interface CardProps {
	title?: string;
	children: React.ReactNode;
	className?: string;
	collapsible?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
}

const getStorageKey = (title: string) => `card_${title.replace(/\s+/g, "_")}_expanded`;

export const Card: React.FC<CardProps> = ({
	title,
	children,
	className = "",
	collapsible = false,
	onExpandedChange,
}) => {
	const [isExpanded, setIsExpanded] = useState<boolean>(() => {
		if (!collapsible || !title) return true;
		return localStorage.getItem(getStorageKey(title)) === "true";
	});

	const toggleExpanded = () => {
		if (!collapsible || !title) return;
		const newExpanded = !isExpanded;
		setIsExpanded(newExpanded);
		localStorage.setItem(getStorageKey(title), String(newExpanded));
		onExpandedChange?.(newExpanded);
	};

	const showContent = !collapsible || isExpanded;

	return (
		<div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 ${className}`}>
			{title && (
				collapsible ? (
					<button
						onClick={toggleExpanded}
						className="flex items-center justify-between w-full text-left cursor-pointer"
					>
						<h2 className="text-lg font-semibold text-gray-900">{title}</h2>
						<svg
							className={`w-5 h-5 text-gray-500 hover:text-gray-700 transition-all duration-200 ${isExpanded ? "rotate-180" : ""}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
						</svg>
					</button>
				) : (
					<h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
				)
			)}
			{showContent && (
				<div className={`flex flex-col gap-2 ${collapsible && title ? "mt-3" : ""}`}>{children}</div>
			)}
		</div>
	);
};
