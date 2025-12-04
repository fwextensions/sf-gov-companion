/**
 * Extracts the page ID from a Wagtail admin edit URL
 * @param url - The admin edit URL
 * @returns The page ID, or null if not found
 */
export function extractPageIdFromAdminUrl(url: string): number | null
{
	try {
		const urlObj = new URL(url);
		const match = urlObj.pathname.match(/\/admin\/pages\/(\d+)\/edit\//);
		return match ? parseInt(match[1], 10) : null;
	} catch (error) {
		return null;
	}
}

/**
 * Extracts the page slug from an SF.gov URL
 * @param url - The URL to extract the slug from
 * @returns The page slug, or empty string if not found
 */
export function extractPageSlug(url: string): string
{
	try {
		const urlObj = new URL(url);
		let pathname = urlObj.pathname;

		// Remove trailing slash
		if (pathname.endsWith("/")) {
			pathname = pathname.slice(0, -1);
		}

		// Remove leading slash
		if (pathname.startsWith("/")) {
			pathname = pathname.slice(1);
		}

		// Return the pathname as the slug
		return pathname;
	} catch (error) {
		return "";
	}
}
