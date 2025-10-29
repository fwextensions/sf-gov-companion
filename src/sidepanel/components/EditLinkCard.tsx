import React from "react";

interface EditIconProps {
	className?: string;
}

const EditIcon: React.FC<EditIconProps> = ({ className = "" }) => (
	<svg
		className={className}
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M12 3.99997H6C4.89543 3.99997 4 4.8954 4 5.99997V18C4 19.1045 4.89543 20 6 20H18C19.1046 20 20 19.1045 20 18V12M18.4142 8.41417L19.5 7.32842C20.281 6.54737 20.281 5.28104 19.5 4.5C18.7189 3.71895 17.4526 3.71895 16.6715 4.50001L15.5858 5.58575M18.4142 8.41417L12.3779 14.4505C12.0987 14.7297 11.7431 14.9201 11.356 14.9975L8.41422 15.5858L9.00257 12.6441C9.08001 12.2569 9.27032 11.9013 9.54951 11.6221L15.5858 5.58575M18.4142 8.41417L15.5858 5.58575"
		/>
	</svg>
);

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
