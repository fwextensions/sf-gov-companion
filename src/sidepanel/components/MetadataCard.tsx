import React from "react";
import { Card } from "./Card";
import type { Agency } from "../../types/wagtail";

interface MetadataCardProps {
	primaryAgency: Agency | undefined;
	contentType: string;
}

export const MetadataCard: React.FC<MetadataCardProps> = ({ primaryAgency, contentType }) => {
	return (
		<Card title="Metadata">
			<div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
				<div className="text-sm font-medium text-gray-600">Content Type:</div>
				<div className="text-sm text-gray-900">{contentType}</div>
				
				<div className="text-sm font-medium text-gray-600">Primary Agency:</div>
				<div className="text-sm text-gray-900">
					{primaryAgency ? (
						<a
							href={primaryAgency.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-600 hover:text-blue-800 hover:underline"
						>
							{primaryAgency.title}
						</a>
					) : (
						<span className="text-gray-400 italic">None</span>
					)}
				</div>
			</div>
		</Card>
	);
};
