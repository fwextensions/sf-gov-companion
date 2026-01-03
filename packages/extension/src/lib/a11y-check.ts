export interface A11yResult {
	fullUrl: string;
	type: string;
	details: string;
	linkText: string;
	targetUrl: string;
	imageFilename: string;
}

export function runA11yCheck(): A11yResult[]
{
	const TRIGGER_PHRASES = [
		"click here",
		"read more",
		"learn more",
		"go here",
		"see more",
		"click",
		"details",
		"see details",
		"more",
		"see all",
		"view all",
	];
	const EXCLUDED_PHRASES = ["learn more about us"];
	const ALLOWED_OFFICE_EXTENSIONS = [
		".doc",
		".docx",
		".xls",
		".xlsx",
		".ppt",
		".pptx",
	];
	const RAW_URL_PATTERN = /(?<!@)\b(?:https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"\']*)?/g;

	function isValidUrl(url: string): boolean
	{
		if (url.includes("mailto:") || url.includes("@")) {
			return false;
		}
		const VALID_TLDS = [
			".com",
			".org",
			".net",
			".gov",
			".edu",
			".info",
			".io",
			".co",
			".us",
			".ca",
		];
		return VALID_TLDS.some((tld) => url.toLowerCase().endsWith(tld));
	}

	//@ts-ignore
	function analyzeTables(
		doc: Document,
		url: string): A11yResult[]
	{
		const results: A11yResult[] = [];
		try {
			const tables = doc.querySelectorAll("table");
			tables.forEach((table) => {
				const caption = table.querySelector("caption");
				const tableCaption = caption?.textContent?.trim() || "";

				const rows = Array.from(table.querySelectorAll("tr"));
				const rowHeaders = rows.some((tr) => {
					const ths = tr.querySelectorAll("th");
					const tds = tr.querySelectorAll("td");
					return ths.length > 0 && tds.length > 0;
				});

				let colHeaders = false;
				const thead = table.querySelector("thead");
				if (thead && thead.querySelectorAll("th").length > 0) {
					colHeaders = true;
				} else if (rows.length > 0) {
					const firstRow = rows[0];
					const cells = Array.from(firstRow.querySelectorAll("th, td"));
					if (cells.every((cell) => cell.tagName === "TH")) {
						colHeaders = true;
					}
				}

				results.push({
					fullUrl: url,
					type: "Table Info",
					details: `Caption: ${tableCaption}, Row headers: ${rowHeaders ?
						"yes" : "no"
					}, Column headers: ${colHeaders ? "yes" : "no"}`,
					linkText: "",
					targetUrl: "",
					imageFilename: "",
				});
			});
		} catch (e) {
			console.error(`[Table error] ${url}: ${e}`);
		}
		return results;
	}

	//@ts-ignore
	function findInaccessibleLinks(
		doc: Document,
		url: string
	): A11yResult[]
	{
		const results: A11yResult[] = [];
		try {
			// --- Inaccessible <a> tags ---
			const links = doc.querySelectorAll("a[href]");
			links.forEach((link) => {
				const aTag = link as HTMLAnchorElement;
				const linkText = aTag.textContent?.trim().toLowerCase() || "";
				if (TRIGGER_PHRASES.some((phrase) => linkText.includes(phrase))) {
					if (
						EXCLUDED_PHRASES.every((excluded) => !linkText.includes(excluded))
					) {
						results.push({
							fullUrl: url,
							type: "Inaccessible Link",
							details: "",
							linkText: aTag.textContent?.trim() || "",
							targetUrl: aTag.href,
							imageFilename: "",
						});
					}
				}
			});

			// --- Inaccessible <button> and <input> ---
			const buttons = Array.from(doc.querySelectorAll("button"));
			const inputs = Array.from(
				doc.querySelectorAll("input[type='submit'], input[type='button']")
			);
			const allButtons = [...buttons, ...inputs];

			allButtons.forEach((tag) => {
				const element = tag as HTMLElement;
				const label =
					element.getAttribute("aria-label") ||
					element.getAttribute("title") ||
					(element as HTMLInputElement).value ||
					element.textContent?.trim() ||
					"";

				const labelText = label.trim().toLowerCase();
				const hasLabel = !!labelText;

				const isIconOnly =
					!hasLabel &&
					(element.querySelector("svg") ||
						Array.from(element.classList).some((cls) => cls.includes("icon")));

				if (
					isIconOnly ||
					!hasLabel ||
					TRIGGER_PHRASES.some((phrase) => labelText.includes(phrase))
				) {
					if (
						EXCLUDED_PHRASES.every((excluded) => !labelText.includes(excluded))
					) {
						results.push({
							fullUrl: url,
							type: "Inaccessible Button",
							details: "Missing accessible label (icon-only)",
							linkText: label || "",
							targetUrl: "",
							imageFilename: "",
						});
					}
				}
			});

			// --- Raw URLs ---
			const visibleText = doc.body.innerText;
			const rawUrls = visibleText.match(RAW_URL_PATTERN) || [];
			rawUrls.forEach((rawUrl) => {
				let processedUrl = rawUrl;
				if (!processedUrl.startsWith("http://") &&
					!processedUrl.startsWith("https://")) {
					processedUrl = "https://" + processedUrl;
				}
				if (isValidUrl(processedUrl)) {
					results.push({
						fullUrl: url,
						type: "Inaccessible Link",
						details: "",
						linkText: "",
						targetUrl: processedUrl,
						imageFilename: "",
					});
				}
			});
		} catch (e) {
			console.error(`[Inaccessible link error] ${url}: ${e}`);
		}
		return results;
	}

	//@ts-ignore
	function extractPdfLinks(
		doc: Document,
		url: string): A11yResult[]
	{
		const results: A11yResult[] = [];
		try {
			const links = doc.querySelectorAll("a[href]");
			links.forEach((link) => {
				const aTag = link as HTMLAnchorElement;
				const href = aTag.href;
				if (href.toLowerCase().endsWith(".pdf")) {
					results.push({
						fullUrl: url,
						type: "PDF Link",
						details: "",
						linkText: aTag.textContent?.trim() || "",
						targetUrl: href,
						imageFilename: "",
					});
				}
			});
		} catch (e) {
			console.error(`[PDF link error] ${url}: ${e}`);
		}
		return results;
	}

	//@ts-ignore
	function findImagesWithAlt(
		doc: Document,
		url: string
	): A11yResult[]
	{
		const results: A11yResult[] = [];
		try {
			const images = doc.querySelectorAll("img");
			images.forEach((img) => {
				const altText = img.getAttribute("alt");
				const src = img.src;
				if (altText && altText.trim()) {
					const filename = src.split("/").pop() || "";
					results.push({
						fullUrl: url,
						type: "Image with alt text",
						details: `alt="${altText}"`,
						linkText: "",
						targetUrl: src,
						imageFilename: filename,
					});
				}
			});
		} catch (e) {
			console.error(`[Image alt text error] ${url}: ${e}`);
		}
		return results;
	}

	function findImagesMissingAlt(
		doc: Document,
		url: string
	): A11yResult[]
	{
		const results: A11yResult[] = [];
		try {
			const images = doc.querySelectorAll("img");
			images.forEach((img) => {
				const altText = img.getAttribute("alt");
				const src = img.src;
				if (!altText || altText.trim() === "") {
					const filename = src.split("/").pop() || "";
					results.push({
						fullUrl: url,
						type: "Image missing alt text",
						details: "",
						linkText: "",
						targetUrl: src,
						imageFilename: filename,
					});
				}
			});
		} catch (e) {
			console.error(`[Missing alt error] ${url}: ${e}`);
		}
		return results;
	}

	function checkHeadingHierarchy(
		doc: Document,
		url: string
	): A11yResult[]
	{
		const results: A11yResult[] = [];
		try {
			const headings = Array.from(
				doc.querySelectorAll("h1, h2, h3, h4, h5, h6")
			);
			const hierarchy = headings.map((h) => parseInt(h.tagName[1]));
			let prev = 0;
			for (const level of hierarchy) {
				if (prev && level > prev + 1) {
					results.push({
						fullUrl: url,
						type: "Heading hierarchy issue",
						details: `Improper heading sequence: ${hierarchy.join(", ")}`,
						linkText: "",
						targetUrl: "",
						imageFilename: "",
					});
					break;
				}
				prev = level;
			}
		} catch (e) {
			console.error(`[Heading hierarchy error] ${url}: ${e}`);
		}
		return results;
	}

	//@ts-ignore
	function findOfficeLinks(
		doc: Document,
		url: string): A11yResult[]
	{
		const results: A11yResult[] = [];
		try {
			const links = doc.querySelectorAll("a[href]");
			links.forEach((link) => {
				const aTag = link as HTMLAnchorElement;
				const href = aTag.href.split("?")[0].split("#")[0];
				for (const ext of ALLOWED_OFFICE_EXTENSIONS) {
					if (href.toLowerCase().endsWith(ext)) {
						results.push({
							fullUrl: url,
							type: "Office File Link",
							details: "",
							linkText: aTag.textContent?.trim() || "",
							targetUrl: aTag.href,
							imageFilename: "",
						});
						break;
					}
				}
			});
		} catch (e) {
			console.error(`[Office file link error] ${url}: ${e}`);
		}
		return results;
	}

	const url = window.location.href;
	const document = window.document;
	const results: A11yResult[] = [];

	// Only running checks that return actual issues/errors
	results.push(...analyzeTables(document, url)); // Info only
//	results.push(...findInaccessibleLinks(document, url));
//	results.push(...extractPdfLinks(document, url)); // Warning/Info
//	results.push(...findImagesWithAlt(document, url)); // Good info
	results.push(...findImagesMissingAlt(document, url));
	results.push(...checkHeadingHierarchy(document, url));
	results.push(...findOfficeLinks(document, url)); // Warning/Info

	return results;
}
