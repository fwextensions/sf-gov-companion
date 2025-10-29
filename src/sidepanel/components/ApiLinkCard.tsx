import { Card } from "./Card";

interface ApiLinkCardProps {
	pageId: number;
}

export function ApiLinkCard({ pageId }: ApiLinkCardProps)
{
	const apiUrl = `https://api.sf.gov/api/v2/pages/${pageId}/`;

	return (
		<Card title="API Information">
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium text-gray-700">Page ID:</span>
				<span className="text-sm text-gray-900 font-mono">{pageId}</span>
			</div>
			<div className="flex items-start gap-2">
				<span className="text-sm font-medium text-gray-700 shrink-0">Page ID:</span>
				<a
					href={apiUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all font-mono"
				>
					{pageId}
				</a>
			</div>
		</Card>
	);
}
