import { useSfGovPage } from "./hooks/useSfGovPage";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { PageHeader } from "./components/PageHeader";
import { EditLinkCard } from "./components/EditLinkCard";
import { MetadataCard } from "./components/MetadataCard";
import { TranslationsCard } from "./components/TranslationsCard";
import { MediaAssetsCard } from "./components/MediaAssetsCard";

const Container = ({ children }: { children: React.ReactNode }) => (
	<div className="min-h-screen p-4 bg-gray-50">
		{children}
	</div>
);

export default function App()
{
	const { pageData, error, isLoading, isOnSfGov, isAdminPage, retry } = useSfGovPage();

	if (isLoading) {
		return (
			<Container>
				<LoadingState />
			</Container>
		);
	}

	if (error) {
		return (
			<Container>
				<ErrorState error={error} onRetry={retry} />
			</Container>
		);
	}

	if (!isOnSfGov) {
		return (
			<Container>
				<div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
					<p className="text-gray-600 text-sm">
						Navigate to an SF.gov page to view CMS information
					</p>
				</div>
			</Container>
		);
	}

	if (!pageData) {
		return (
			<Container>
				<div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
					<p className="text-gray-600 text-sm">Page data is unavailable.</p>
				</div>
			</Container>
		);
	}

	// If on admin page, show only the iframe with the SF.gov page
	if (isAdminPage && pageData.meta.htmlUrl) {
		return (
			<iframe
				src={pageData.meta.htmlUrl}
				className="w-full h-screen border-0"
				title="SF.gov Page Preview"
			/>
		);
	}

	return (
		<Container>
			<div className="max-w-3xl mx-auto space-y-4">
				<PageHeader title={pageData.title} />
				<EditLinkCard pageId={pageData.id} />
				<MetadataCard
					primaryAgency={pageData.primaryAgency}
					contentType={pageData.contentType}
					pageId={pageData.id}
					schema={pageData.schema}
				/>
				<TranslationsCard translations={pageData.translations} />
				<MediaAssetsCard images={pageData.images} files={pageData.files} />
			</div>
		</Container>
	);
}
