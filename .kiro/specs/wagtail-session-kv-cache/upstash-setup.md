# Upstash Redis Setup Guide

This document provides comprehensive instructions for setting up and using Upstash Redis for session caching and rate limiting in the SF.gov Wagtail Extension API.

## Overview

The API uses Upstash Redis for:
- **Session Caching**: Cache Wagtail session validation results (5-minute TTL)
- **Rate Limiting**: Limit requests to 10 per 10 seconds per session

## Production Setup (Vercel)

### Step 1: Connect Upstash Redis via Vercel Marketplace

1. Navigate to your Vercel project dashboard
2. Go to the "Storage" tab
3. Click "Create Database" or "Browse Marketplace"
4. Select "Upstash Redis" from the Marketplace integrations
5. Click "Add Integration" or "Connect"
6. Follow the prompts to authorize Upstash with your Vercel account

### Step 2: Create an Upstash Redis Database

1. After connecting the integration, you'll be redirected to Upstash
2. Click "Create Database"
3. Choose a database name (e.g., "sf-gov-cache")
4. Select a region (choose closest to your Vercel deployment region for lowest latency)
5. Select a plan (Free tier is sufficient for this use case)
6. Click "Create"

### Step 3: Connect Database to Your Vercel Project

1. Upstash will prompt you to connect the database to your Vercel project
2. Select your project from the list
3. Choose the environment(s) to connect (Production, Preview, Development)
4. Click "Connect"

### Step 4: Verify Environment Variables

Vercel automatically adds Upstash connection variables to your project:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

These are injected automatically at runtime (no manual configuration needed).

To verify:
1. Go to Project Settings → Environment Variables
2. Confirm both variables are present

### Step 5: Deploy

Push your code to trigger a deployment. Vercel will automatically inject Upstash credentials, and the proxy endpoint will have access to Redis via `Redis.fromEnv()`.

## Local Development Setup

### Option 1: Using Vercel Dev (Recommended)

This is the easiest way to test with Upstash Redis locally:

```bash
# Pull environment variables from Vercel (includes Upstash credentials)
vercel env pull .env.development.local

# Start the development server with Upstash access
vercel dev
```

The `vercel dev` command automatically loads Upstash credentials from environment variables.

### Option 2: Manual Configuration

If you prefer not to use `vercel dev`, you can manually configure the environment variables:

1. Copy `.env.example` to `.env`:
   ```bash
   cd packages/server
   cp .env.example .env
   ```

2. Get your Upstash credentials from the Upstash console:
   - Navigate to console.upstash.com
   - Select your database
   - Copy the REST URL and REST Token

3. Add the credentials to your `.env` file:
   ```bash
   UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ```

4. Start the development server:
   ```bash
   npm run dev:server
   ```

## Environment Variables

### Required (Set in Vercel Project Settings)

- `WAGTAIL_API_URL`: Base URL for Wagtail admin (e.g., `https://api.sf.gov/admin`)
- `AIRTABLE_API_KEY`: API key for Airtable access
- `AIRTABLE_BASE_ID`: Airtable base identifier
- `AIRTABLE_TABLE_NAME`: Name of the feedback table

### Automatically Set by Vercel (when Upstash is connected)

- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST API token

### Optional (with defaults)

- `SESSION_CACHE_TTL`: Cache TTL in seconds (default: `300`)
- `WAGTAIL_VALIDATION_TIMEOUT`: Validation timeout in milliseconds (default: `5000`)

## How It Works

### Session Caching

The API caches Wagtail session validation results to reduce latency and load on the Wagtail server:

1. **Cache Key Format**: `session:{sessionId}`
2. **Cache TTL**: 5 minutes (configurable via `SESSION_CACHE_TTL`)
3. **Cache Hit**: Returns cached result (~10-50ms)
4. **Cache Miss**: Validates with Wagtail and caches result (~200-500ms)

### Rate Limiting

The API limits requests to prevent abuse:

1. **Rate Limit Key Format**: `ratelimit:{sessionId}`
2. **Limit**: 10 requests per 10 seconds per session
3. **Implementation**: Uses Redis INCR and EXPIRE commands

### Error Handling

The system degrades gracefully:
- **Redis Unavailable**: Falls back to direct Wagtail validation (slower but functional)
- **Cache Read Error**: Logs error and validates directly
- **Cache Write Error**: Logs error but continues processing (request succeeds)

## Monitoring

### Upstash Dashboard

Monitor Redis usage in the Upstash dashboard:
1. Navigate to console.upstash.com
2. Select your database
3. View metrics:
   - Commands/day
   - Storage used
   - Response time
   - Hit rate
4. Access detailed logs and analytics

### Vercel Logs

The API logs all cache operations for observability:

- **Cache Hit**: `"Session cache hit for session:abc12345 (2ms)"`
- **Cache Miss**: `"Session cache miss for session:abc12345, validating with Wagtail"`
- **Cache Write**: `"Session validation result cached for session:abc12345 (150ms)"`
- **Cache Error**: `"Redis cache read failed for session:abc12345: Connection timeout"`

### Key Metrics to Monitor

1. **Cache Hit Rate**: Percentage of requests served from cache (target: >80%)
2. **Cache Operation Duration**: Time spent on Redis reads/writes (target: <50ms)
3. **Redis Error Rate**: Frequency of Redis operation failures (target: <1%)
4. **Validation Duration**: Time spent on Wagtail HTTP requests (target: <500ms)

## Cost Considerations

### Upstash Redis Pricing (as of 2024)

- **Free Tier**: 10,000 commands/day, 256 MB storage, global replication
- **Pay-as-you-go**: $0.2 per 100K commands
- **Pro Plans**: Starting at $280/month for higher limits

### Expected Usage

- Each cache entry: ~71 bytes
- Expected usage: ~1,000-5,000 commands/day
- Storage: <1 MB for typical usage
- **Recommendation**: Free tier is sufficient

## Troubleshooting

### Redis Connection Errors

If you see errors like "Redis cache read failed":

1. **Check Environment Variables**: Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
2. **Check Upstash Status**: Visit status.upstash.com
3. **Check Vercel Logs**: Look for detailed error messages
4. **Verify Integration**: Ensure Upstash is connected to your Vercel project

### Cache Not Working

If caching doesn't seem to be working:

1. **Check Logs**: Look for "Session cache hit" and "Session cache miss" messages
2. **Verify TTL**: Ensure `SESSION_CACHE_TTL` is set correctly (default: 300 seconds)
3. **Test Locally**: Use `vercel dev` to test with Upstash credentials
4. **Check Redis Dashboard**: Verify commands are being executed in Upstash console

### Rate Limiting Issues

If rate limiting is too aggressive or not working:

1. **Check Rate Limit Logic**: Review `checkRateLimit` function in `airtable-proxy.ts`
2. **Adjust Limits**: Modify the `limit` and `window` constants if needed
3. **Check Redis Keys**: Verify rate limit keys are being created in Upstash console
4. **Test with Different Sessions**: Rate limiting is per-session, not per-IP

## Migration from Vercel KV

If you're migrating from Vercel KV to Upstash Redis:

1. **Install Upstash SDK**: `npm install @upstash/redis --workspace=@sf-gov/server`
2. **Remove Vercel KV**: `npm uninstall @vercel/kv --workspace=@sf-gov/server`
3. **Update Imports**: Replace `@vercel/kv` with `@upstash/redis`
4. **Update API Calls**: Change `kv.setex()` to `redis.set(key, value, { ex: ttl })`
5. **Connect Upstash**: Follow the production setup steps above
6. **Deploy**: Push changes to trigger deployment

## Additional Resources

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Upstash Vercel Integration Guide](https://docs.upstash.com/redis/howto/vercelintegration)
- [Vercel Storage Documentation](https://vercel.com/docs/storage)
- [Redis Commands Reference](https://redis.io/commands)
