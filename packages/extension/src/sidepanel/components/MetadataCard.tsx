import React from "react";
import { Card } from "./Card";
import type { Agency, FormSchema } from "@sf-gov/shared";
import { EditIcon } from "@/sidepanel/components/EditIcon.tsx";

interface MetadataCardProps {
	primaryAgency: Agency | undefined;
	contentType: string;
	pageId: number;
	schema?: FormSchema;
}

const CreateNewLink = ({ contentType }: { contentType: string }) => (
	<a
		href={`https://api.sf.gov/admin/pages/add/sf/${contentType}/2`}
		className="ml-4 inline-flex items-center gap-1 align-bottom"
		title="Create a new page of this type"
		target="_blank"
	>
		<EditIcon /> Create New
	</a>
);

function formatContentType(contentType: string): string
{
	// Add spaces before capital letters and capitalize first letter
	return contentType
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
	// Extract the last part after the dot (e.g., "ResourceCollection" from "sf.ResourceCollection")
	const contentTypeName = contentType.split(".").pop() || contentType;
	const contentTypeParam = contentTypeName.toLowerCase();

	return (
		<Card
			title="Metadata"
			subtitle="About this page"
		>
			<div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
				<div className="text-sm text-gray-600">Content Type:</div>
				<div className="text-sm font-medium text-gray-900">
					{formatContentType(contentTypeName)}
					<CreateNewLink contentType={contentTypeParam} />
				</div>

				<div className="text-sm text-gray-600">Primary Agency:</div>
				<div className="text-sm font-medium text-gray-900">
					{primaryAgency ? (
						<a
							href={primaryAgency.url}
							target="_blank"
							rel="noopener noreferrer"
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
						className="text-sm break-all"
					>
						{pageId}
					</a>
				</div>
			</div>
		</Card>
	);
};
