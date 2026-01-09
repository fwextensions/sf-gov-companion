/**
 * Authentication utilities for server-side API endpoints
 */

const WAGTAIL_VALIDATION_TIMEOUT = parseInt(process.env.WAGTAIL_VALIDATION_TIMEOUT || "5000", 10);

/**
 * Validates a Wagtail session by making a request to the Wagtail API
 * @param sessionId - The Wagtail session ID from the cookie
 * @param wagtailApiUrl - The base URL of the Wagtail API
 * @returns Promise<boolean> - True if the session is valid, false otherwise
 */
export async function validateWagtailSession(sessionId: string, wagtailApiUrl: string): Promise<boolean> {
	let timeoutId: NodeJS.Timeout;
	try {
		const baseUrl = wagtailApiUrl.replace(/\/$/, "");
		const validationUrl = `${baseUrl}/pages`;

		const fetchPromise = fetch(validationUrl, {
			method: "GET",
			headers: {
				"Cookie": `sessionid=${sessionId}`,
				"User-Agent": "SF-Gov-Companion-Extension/1.0",
				"X-SF-Gov-Extension": "companion",
			},
			redirect: "manual",
		});

		const timeoutPromise = new Promise<Response>((_, reject) => {
			timeoutId = setTimeout(() => reject(new Error("Request timed out")), WAGTAIL_VALIDATION_TIMEOUT);
		});

		const response = await Promise.race([fetchPromise, timeoutPromise]);
		clearTimeout(timeoutId!);

		return response.ok || (response.status >= 300 && response.status < 400);
	} catch (error) {
		console.error("Wagtail session validation failed:", error);
		return false;
	} finally {
		// @ts-ignore
		if (typeof timeoutId !== "undefined") clearTimeout(timeoutId);
	}
}
