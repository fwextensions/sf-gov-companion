import React from "react";
import { Card } from "./Card";
import type { Agency, FormSchema } from "@sf-gov/shared";

interface MetadataCardProps {
	primaryAgency: Agency | undefined;
	contentType: string;
	pageId: number;
	schema?: FormSchema;
}

function formatContentType(contentType: string): string
{
	// Extract the last part after the dot (e.g., "ServicePage" from "services.ServicePage")
	const typeName = contentType.split(".").pop() || contentType;

	// Add spaces before capital letters and capitalize first letter
	return typeName
		.replace(/([A-Z])/g, " $1")
		.trim()
		.replace(/^./, (str) => str.toUpperCase());
}

export const MetadataCard: React.FC<MetadataCardProps> = ({
	primaryAgency,
	contentType,
	pageId,
	schema
}) => {
	const apiUrl = `https://api.sf.gov/api/v2/pages/${pageId}/`;
	const formEditUrl = schema
		? `https://formio.dev.sf.gov/#/project/${schema.project}/form/${schema._id}/edit`
		: null;

	return (
		<Card title="Metadata">
			<div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
				<div className="text-sm text-gray-600">Content Type:</div>
				<div className="text-sm font-medium text-gray-900">{formatContentType(
					contentType)}</div>

				<div className="text-sm text-gray-600">Primary Agency:</div>
				<div className="text-sm font-medium text-gray-900">
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

				{schema && formEditUrl && (
					<>
						<div className="text-sm text-gray-600">Form Name:</div>
						<div className="text-sm font-medium text-gray-900">
							<a
								href={formEditUrl}
								target="_blank"
								rel="noopener noreferrer"
								title="View form in form.io"
								className="text-blue-600 hover:text-blue-800 hover:underline"
							>
								{schema.title}
							</a>
						</div>
					</>
				)}

				<div className="text-sm text-gray-600 shrink-0">Page ID:</div>
				<div className="text-sm font-medium text-gray-900">
					<a
						href={apiUrl}
						target="_blank"
						rel="noopener noreferrer"
						title="View page data from SF.gov API"
						className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
					>
						{pageId}
					</a>
				</div>
			</div>
		</Card>
	);
};
