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

For Upstash Redis (automatically set by Vercel when connected via Marketplace):
```bash
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

Optional configuration:
```bash
SESSION_CACHE_TTL=300  # cache TTL in seconds (default: 300)
WAGTAIL_VALIDATION_TIMEOUT=5000  # validation timeout in milliseconds (default: 5000)
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

**Required:**
- `WAGTAIL_API_URL`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_NAME`

**Automatically Set by Vercel (when Upstash Redis is connected):**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Optional (with defaults):**
- `SESSION_CACHE_TTL` (default: 300 seconds)
- `WAGTAIL_VALIDATION_TIMEOUT` (default: 5000 milliseconds)

## Architecture

- **Session Validation**: Validates Wagtail admin sessions by making requests to the Wagtail API
- **Caching**: Uses Upstash Redis to cache session validation results (5-minute TTL, configurable via `SESSION_CACHE_TTL`)
- **Rate Limiting**: Limits requests to 10 per 10 seconds per session using Upstash Redis
- **Security**: Validates origin headers, never exposes Airtable API key to clients

## Upstash Redis Setup

The API uses Upstash Redis for session caching and rate limiting. To set up Upstash Redis:

### Production (Vercel)

1. Navigate to your Vercel project dashboard
2. Go to the "Storage" tab
3. Click "Create Database" or "Browse Marketplace"
4. Select "Upstash Redis" from the Marketplace integrations
5. Click "Add Integration" and follow the prompts
6. Create a database (Free tier is sufficient for this use case)
7. Connect the database to your Vercel project

Vercel automatically injects the following environment variables:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Local Development

To test with Upstash Redis locally:

```bash
# Pull environment variables from Vercel (includes Upstash credentials)
vercel env pull .env.development.local

# Start the development server with Upstash access
vercel dev
```

**Note:** Standard `npm run dev:server` will not have Upstash access locally unless you manually copy the environment variables. Use `vercel dev` for full Redis functionality during development.

## Dependencies

- `@vercel/node`: Vercel serverless function runtime
- `@upstash/redis`: Upstash Redis SDK for caching and rate limiting
- `@sf-gov/shared`: Shared TypeScript types
