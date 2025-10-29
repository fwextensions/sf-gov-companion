import React from "react";

interface CardProps {
	title?: string;
	children: React.ReactNode;
	className?: string;
}

export const Card: React.FC<CardProps> = ({
	title,
	children,
	className = ""
}) => {
	return (
		<div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 ${className}`}>
			{title && (
				<h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
			)}
			<div className="flex flex-col gap-2">{children}</div>
		</div>
	);
};
