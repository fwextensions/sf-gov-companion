# SF.gov API Package

This package contains serverless functions for the SF.gov Wagtail Extension, deployed on Vercel.

## Setup

### 1. Install Dependencies

From the repository root:

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the repository root with the following variables:

```bash
WAGTAIL_API_URL=https://api.sf.gov/admin/api/v2
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id
AIRTABLE_TABLE_NAME=your_table_name
```

For Vercel KV (optional for local development):
```bash
KV_REST_API_URL=your_kv_url
KV_REST_API_TOKEN=your_kv_token
```

## Development

### Start the Development Server

From the repository root:

```bash
npm run dev:api
```

This will start the Vercel dev server on `http://localhost:3001`.

**Note:** The first time you run this, Vercel CLI will prompt you to set up the project. Answer the prompts to link it to your Vercel account (or skip for local-only development).

### Type Checking

```bash
npm run type-check --workspace=@sf-gov/server
```

## API Endpoints

### GET /api/airtable-proxy

Proxies requests to Airtable with Wagtail session authentication.

**Headers:**
- `X-Wagtail-Session`: Session cookie value from api.sf.gov
- `Origin`: Extension origin (chrome-extension://... or edge-extension://...)

**Query Parameters:**
- `pagePath`: SF.gov page path (e.g., `/services/housing`)

**Response:**
```json
{
  "records": [
    {
      "id": "rec123",
      "submissionId": "sub456",
      "submissionCreated": "2025-11-08T10:30:00Z",
      "referrer": "/services/housing",
      "wasHelpful": "yes",
      "issueCategory": null,
      "whatWasHelpful": "Clear information",
      "additionalDetails": "Very helpful page"
    }
  ]
}
```

**Error Responses:**
- `401`: Invalid or missing session
- `403`: Invalid origin
- `429`: Rate limit exceeded
- `500`: Server error
- `502`: Airtable API error

## Testing Locally

You can test the endpoint using curl once the dev server is running:

```bash
curl -X GET "http://localhost:3001/api/airtable-proxy?pagePath=/services/housing" \
  -H "X-Wagtail-Session: your_session_cookie" \
  -H "Origin: http://localhost:5173"
```

## Deployment

### Deploy to Vercel

```bash
npm run deploy --workspace=@sf-gov/server
```

Or from the Vercel dashboard, connect your GitHub repository and Vercel will automatically deploy on push.

### Environment Variables in Production

Set the following environment variables in your Vercel project settings:

- `WAGTAIL_API_URL`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_NAME`

Vercel KV variables are automatically configured when you add a KV store to your project.

## Architecture

- **Session Validation**: Validates Wagtail admin sessions by making requests to the Wagtail API
- **Caching**: Uses Vercel KV to cache session validation results (5-minute TTL)
- **Rate Limiting**: Limits requests to 10 per 10 seconds per session using Vercel KV
- **Security**: Validates origin headers, never exposes Airtable API key to clients

## Dependencies

- `@vercel/node`: Vercel serverless function runtime
- `@vercel/kv`: Vercel KV for caching and rate limiting
- `@sf-gov/shared`: Shared TypeScript types
