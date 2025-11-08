import React from "react";
import { EditIcon } from "@/sidepanel/components/EditIcon.tsx";

interface EditLinkCardProps {
	pageId: number;
}

export const EditLinkCard: React.FC<EditLinkCardProps> = ({ pageId }) => {
	const editUrl = `https://api.sf.gov/admin/pages/${pageId}/edit/`;

	return (
		<a
			href={editUrl}
			target="_blank"
			rel="noopener noreferrer"
			className="mb-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
		>
			<EditIcon className="h-4 w-4" aria-hidden="true" />
			Edit on Karl
		</a>
	);
};
