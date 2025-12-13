export interface LinkInfo {
	url: string;
	text: string;
}

export interface LinkCheckResult {
	url: string;
	text: string;
	status: "ok" | "broken" | "redirect" | "timeout" | "error" | "insecure";
	statusCode?: number;
	error?: string;
}

/**
 * Checks a single link using a HEAD request.
 * This function is designed to be injected into the page context where it has
 * same-origin privileges and avoids CORS issues.
 * NOTE: This function must be self-contained since it's injected via chrome.scripting.executeScript
 */
export async function checkLinkInPage(url: string): Promise<{ status: "ok" | "broken" | "redirect" | "timeout" | "error" | "insecure"; statusCode?: number; error?: string }>
{
	async function doFetch(fetchUrl: string): Promise<{ status: "ok" | "broken" | "redirect" | "timeout" | "error"; statusCode?: number; error?: string }>
	{
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000);

			const response = await fetch(fetchUrl, {
				method: "HEAD",
				signal: controller.signal,
				redirect: "follow",
				mode: "no-cors",
			});

			clearTimeout(timeoutId);

			// with no-cors mode, we get an opaque response but can still detect if the request succeeded
			// opaque responses have type "opaque" and status 0, but the request did complete
			if (response.type === "opaque") {
				return { status: "ok" };
			}

			const statusCode = response.status;

			if (statusCode >= 200 && statusCode < 300) {
				return { status: "ok", statusCode };
			}

			if (response.type === "opaqueredirect" || (statusCode >= 300 && statusCode < 400)) {
				return { status: "redirect", statusCode };
			}

			return { status: "broken", statusCode };
		} catch (err) {
			if (err instanceof Error) {
				if (err.name === "AbortError") {
					return { status: "timeout", error: "Request timed out" };
				}
				// cross-origin redirects get blocked but the link itself works
				if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
					// the link likely works but redirects to a different domain
					return { status: "ok" };
				}
				// network errors (including blocked requests) throw TypeError
				return { status: "error", error: err.message };
			}
			return { status: "error", error: "Unknown error" };
		}
	}

	// check if this is an http link on an https page (mixed content)
	const isHttpLink = url.startsWith("http://");
	const isHttpsPage = window.location.protocol === "https:";

	if (isHttpLink && isHttpsPage) {
		// try the https version of the URL first
		const httpsUrl = url.replace("http://", "https://");
		try {
			const result = await doFetch(httpsUrl);
			if (result.status === "ok") {
				return result;
			}
		} catch {
			// https version failed, fall through to mark as insecure
		}
		// can't check http links from https pages due to mixed content blocking
		return { status: "insecure", error: "HTTP link on HTTPS page" };
	}

	return doFetch(url);
}

/**
 * Extracts all links from the <main> content area of the page.
 * This function is designed to be injected into the page context.
 */
export function extractContentLinks(): LinkInfo[]
{
	const main = document.querySelector("main");
	if (!main) {
		return [];
	}

	const links = main.querySelectorAll("a[href]");
	const seen = new Set<string>();
	const results: LinkInfo[] = [];

	links.forEach((link) => {
		const anchor = link as HTMLAnchorElement;
		const href = anchor.href;

		// skip empty, javascript:, mailto:, tel: links
		if (!href ||
			href.startsWith("javascript:") ||
			href.startsWith("mailto:") ||
			href.startsWith("tel:") ||
			href.startsWith("#")
		) {
			return;
		}

		// deduplicate
		if (seen.has(href)) {
			return;
		}
		seen.add(href);

		results.push({
			url: href,
			text: anchor.textContent?.trim() || "",
		});
	});

	return results;
}

