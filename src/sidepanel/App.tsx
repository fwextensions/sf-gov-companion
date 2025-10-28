import { useSfGovPage } from "./hooks/useSfGovPage";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { PageHeader } from "./components/PageHeader";
import { EditLinkCard } from "./components/EditLinkCard";
import { MetadataCard } from "./components/MetadataCard";
import { TranslationsCard } from "./components/TranslationsCard";
import { MediaAssetsCard } from "./components/MediaAssetsCard";

function App()
{
	const { pageData, error, isLoading, isOnSfGov, retry } = useSfGovPage();

	return (
		<div className="min-h-screen p-4 bg-gray-50">
			{/* Loading State */}
			{isLoading && <LoadingState />}

			{/* Error State */}
			{!isLoading && error && <ErrorState error={error} onRetry={retry} />}

			{/* Not on SF.gov State */}
			{!isLoading && !error && !isOnSfGov && (
				<div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
					<p className="text-gray-600 text-sm">
						Navigate to an SF.gov page to view CMS information
					</p>
				</div>
			)}

			{/* Content State - Display page data */}
			{!isLoading && !error && pageData && (
				<div className="max-w-3xl mx-auto space-y-4">
					<PageHeader title={pageData.title} contentType={pageData.contentType} />
					<EditLinkCard pageId={pageData.id} />
					<MetadataCard
						partnerAgency={pageData.partnerAgency}
						contentType={pageData.contentType}
					/>
					<TranslationsCard translations={pageData.translations} />
					<MediaAssetsCard images={pageData.images} files={pageData.files} />
				</div>
			)}
		</div>
	);
}

export default App;
