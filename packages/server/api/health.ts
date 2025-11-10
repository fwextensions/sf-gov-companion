import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Simple health check endpoint to verify the API is running
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
	return res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
		environment: {
			hasWagtailUrl: !!process.env.WAGTAIL_API_URL,
			hasAirtableKey: !!process.env.AIRTABLE_API_KEY,
			hasAirtableBase: !!process.env.AIRTABLE_BASE_ID,
			hasAirtableTable: !!process.env.AIRTABLE_TABLE_NAME,
			hasKvUrl: !!process.env.KV_REST_API_URL,
			hasKvToken: !!process.env.KV_REST_API_TOKEN,
		},
	});
}
