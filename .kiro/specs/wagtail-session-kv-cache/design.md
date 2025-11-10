# Design Document

## Overview

This design extends the existing Vercel KV caching infrastructure in the Airtable proxy endpoint to cache Wagtail session validation results. The current implementation already includes a `validateSessionWithCache` function that performs session validation caching, but this design document formalizes the approach and ensures all requirements are met with proper error handling, logging, and observability.

The caching layer sits between the proxy endpoint's authentication logic and the Wagtail admin validation, reducing latency and server load by avoiding redundant HTTP requests for recently validated sessions.

## Architecture

### Current State

The Airtable proxy endpoint (`packages/server/api/airtable-proxy.ts`) currently implements:
- Session validation via HTTP requests to Wagtail admin
- Basic KV caching with a 5-minute TTL
- Fallback to direct validation on cache failures
- Rate limiting using Vercel KV

### Proposed Enhancements

The design enhances the existing implementation with:
- Comprehensive logging for cache operations (hits, misses, errors)
- Performance monitoring with operation duration tracking
- Explicit error handling for all KV operations
- Consistent cache key formatting
- Named constants for configuration values

### System Flow

```
Extension Request
    ↓
Proxy Endpoint
    ↓
Origin Validation
    ↓
Rate Limit Check (KV)
    ↓
Session Validation with Cache
    ├─→ Cache Hit → Return cached result
    └─→ Cache Miss → Validate with Wagtail
                   → Cache result (if valid)
                   → Return result
    ↓
Fetch Airtable Data
    ↓
Return Response
```

## Components and Interfaces

### Environment Variables

The proxy endpoint requires the following environment variables:

**Required:**
- `WAGTAIL_API_URL`: Base URL for Wagtail admin (e.g., `https://api.sf.gov/admin`)
- `AIRTABLE_API_KEY`: API key for Airtable access
- `AIRTABLE_BASE_ID`: Airtable base identifier
- `AIRTABLE_TABLE_NAME`: Name of the feedback table

**Optional (with defaults):**
- `SESSION_CACHE_TTL`: Cache TTL in seconds (default: `300`)
- `WAGTAIL_VALIDATION_TIMEOUT`: Validation timeout in milliseconds (default: `5000`)

The optional variables allow operators to tune cache behavior and timeout values without code changes.

### Cache Key Format

All session validation cache entries use a consistent key format:

```typescript
const cacheKey = `session:${sessionId}`;
```

This format:
- Namespaces session validation entries separately from rate limiting entries
- Allows for easy identification and debugging
- Supports future cache invalidation strategies

### Configuration via Environment Variables

```typescript
const SESSION_CACHE_TTL = parseInt(process.env.SESSION_CACHE_TTL || '300', 10); // default: 5 minutes in seconds
const WAGTAIL_VALIDATION_TIMEOUT = parseInt(process.env.WAGTAIL_VALIDATION_TIMEOUT || '5000', 10); // default: 5 seconds in milliseconds
```

These environment variables:
- Allow runtime configuration without code changes
- Support different values per environment (dev, staging, production)
- Provide sensible defaults if not configured
- Improve operational flexibility

### Enhanced validateSessionWithCache Function

The function signature remains unchanged but includes enhanced logging:

```typescript
async function validateSessionWithCache(
  sessionId: string, 
  wagtailApiUrl: string
): Promise<boolean>
```

**Behavior:**
1. Generate cache key from session ID
2. Attempt to read from KV cache
3. On cache hit: Log hit and return cached value
4. On cache miss: Log miss, validate with Wagtail, cache result (if valid), return result
5. On KV error: Log error, fall back to direct validation

### Logging Interface

All cache operations emit structured log messages:

```typescript
interface CacheLogEntry {
  operation: 'hit' | 'miss' | 'write' | 'error';
  sessionId: string; // truncated for privacy (first 8 chars)
  duration?: number; // milliseconds
  error?: string;
}
```

Example log outputs:
- `"Session cache hit for session:abc12345 (2ms)"`
- `"Session cache miss for session:abc12345, validating with Wagtail"`
- `"Session validation result cached for session:abc12345 (150ms)"`
- `"Session cache error: Connection timeout"`

## Data Models

### Cache Entry Structure

```typescript
interface SessionCacheEntry {
  value: boolean; // true if session is valid
  // TTL is managed by KV, not stored in the entry
}
```

The cache stores a simple boolean value indicating session validity. Invalid sessions are not cached, so the presence of a cache entry implies validity.

### KV Operations

```typescript
// Read operation
const cached = await kv.get<boolean>(cacheKey);

// Write operation with TTL
await kv.setex(cacheKey, SESSION_CACHE_TTL, true);

// No explicit delete operation needed (TTL handles expiration)
```

## Error Handling

### KV Operation Failures

All KV operations are wrapped in try-catch blocks:

```typescript
try {
  const cached = await kv.get<boolean>(cacheKey);
  // ... use cached value
} catch (error) {
  console.error("Session cache read failed:", error);
  // Fall back to direct validation
  return await validateWagtailSession(sessionId, wagtailApiUrl);
}
```

**Error Handling Strategy:**
- **Cache Read Failure**: Fall back to direct Wagtail validation
- **Cache Write Failure**: Log error but continue processing (request succeeds)
- **Wagtail Validation Failure**: Return false (invalid session), do not cache

### Timeout Handling

Wagtail validation requests use AbortSignal.timeout:

```typescript
const response = await fetch(validationUrl, {
  signal: AbortSignal.timeout(WAGTAIL_VALIDATION_TIMEOUT),
  // ... other options
});
```

If the timeout is exceeded, the validation fails and returns false.

### Graceful Degradation

The system degrades gracefully:
1. **KV Unavailable**: Direct validation (slower but functional)
2. **Wagtail Unavailable**: Return 401 (expected behavior)
3. **Both Unavailable**: Return 401 (cannot validate)

## Testing Strategy

### Unit Testing Approach

Test the `validateSessionWithCache` function in isolation:

1. **Cache Hit Test**: Mock KV to return cached value, verify no Wagtail request
2. **Cache Miss Test**: Mock KV to return null, verify Wagtail request and cache write
3. **KV Read Error Test**: Mock KV to throw error, verify fallback to direct validation
4. **KV Write Error Test**: Mock KV write to throw error, verify request still succeeds
5. **Invalid Session Test**: Mock Wagtail to return 401, verify no cache write

### Integration Testing Approach

Test the full proxy endpoint flow:

1. **Valid Session Flow**: Send request with valid session, verify 200 response
2. **Invalid Session Flow**: Send request with invalid session, verify 401 response
3. **Cache Performance**: Send multiple requests with same session, verify second request is faster
4. **Cache Expiration**: Wait for TTL to expire, verify re-validation occurs

### Manual Testing

1. Load extension and trigger Airtable feedback fetch
2. Check Vercel logs for cache hit/miss messages
3. Trigger multiple requests rapidly, verify rate limiting works
4. Wait 5+ minutes, verify session is re-validated

## Performance Considerations

### Expected Performance Improvements

- **Cache Hit Latency**: ~10-50ms (KV read)
- **Cache Miss Latency**: ~200-500ms (Wagtail validation + KV write)
- **Improvement**: 4-10x faster for cached sessions

### Cache Hit Rate Estimation

Assuming a content manager makes 10 requests per session:
- First request: Cache miss (validate + cache)
- Next 9 requests: Cache hits (within 5-minute TTL)
- **Expected hit rate**: ~90%

### Memory Usage

Each cache entry stores:
- Key: ~20 bytes (`session:` + 32-char session ID)
- Value: ~1 byte (boolean)
- Metadata: ~50 bytes (TTL, timestamps)
- **Total per entry**: ~71 bytes

With 1000 concurrent users: ~71 KB total cache size (negligible)

## Security Considerations

### Session ID Privacy

Session IDs are sensitive credentials. Logging strategy:
- **Log**: Truncated session ID (first 8 characters) for debugging
- **Do Not Log**: Full session ID in production logs
- **Cache Key**: Full session ID (required for cache lookup)

### Cache Poisoning Prevention

The cache cannot be poisoned because:
- Cache keys are derived from session IDs (not user input)
- Cache values are booleans (not complex objects)
- Invalid sessions are not cached
- TTL ensures stale entries expire

### Rate Limiting Interaction

Rate limiting occurs before session validation:
1. Check rate limit (KV)
2. If rate limited, return 429 (no session validation)
3. If not rate limited, validate session (with cache)

This prevents cache-based rate limit bypass.

## Monitoring and Observability

### Key Metrics to Monitor

1. **Cache Hit Rate**: Percentage of requests served from cache
2. **Cache Operation Duration**: Time spent on KV reads/writes
3. **Validation Duration**: Time spent on Wagtail HTTP requests
4. **Error Rate**: Frequency of KV operation failures

### Log Analysis Queries

Example queries for Vercel logs:

```
// Cache hit rate
"Session cache hit" OR "Session cache miss"

// KV errors
"Session cache error" OR "cache check failed"

// Slow validations
"validating with Wagtail" AND duration > 1000
```

### Alerting Thresholds

Recommended alerts:
- **KV Error Rate > 5%**: Investigate KV service health
- **Cache Hit Rate < 50%**: Review TTL configuration
- **Validation Duration > 2s**: Check Wagtail server performance

## Vercel KV Setup

### Prerequisites

Vercel KV must be provisioned and connected to your Vercel project before the caching functionality will work.

### Setup Steps

1. **Create a Vercel KV Database**
   - Navigate to your Vercel project dashboard
   - Go to the "Storage" tab
   - Click "Create Database"
   - Select "KV" (Redis-compatible key-value store)
   - Choose a database name (e.g., "sf-gov-cache")
   - Select a region (choose closest to your serverless functions)
   - Click "Create"

2. **Connect KV to Your Project**
   - After creation, Vercel will prompt you to connect the database
   - Select your project from the list
   - Choose the environment(s) to connect (Production, Preview, Development)
   - Click "Connect"

3. **Verify Environment Variables**
   - Vercel automatically adds KV connection variables to your project:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
     - `KV_REST_API_READ_ONLY_TOKEN`
   - These are injected automatically at runtime (no manual configuration needed)
   - Verify in Project Settings → Environment Variables

4. **Install @vercel/kv Package**
   - The package is already installed in `packages/server/package.json`
   - If not present, run: `npm install @vercel/kv --workspace=@sf-gov/server`

5. **Deploy to Vercel**
   - Push your code to trigger a deployment
   - Vercel will automatically inject KV credentials
   - The proxy endpoint will have access to `kv` from `@vercel/kv`

### Local Development

For local testing with KV:

1. **Pull Environment Variables**
   ```bash
   cd packages/server
   vercel env pull .env.local
   ```
   This downloads KV credentials to `.env.local`

2. **Run Development Server**
   ```bash
   vercel dev
   ```
   The `vercel dev` command automatically loads KV credentials

**Note**: Standard `npm run dev` will not have KV access locally. Use `vercel dev` for full KV functionality during development.

### Cost Considerations

Vercel KV pricing (as of 2024):
- **Hobby Plan**: 256 MB storage, 3,000 commands/day (free)
- **Pro Plan**: 512 MB storage, 10,000 commands/day (included)
- **Enterprise**: Custom limits

For this use case:
- Each cache entry: ~71 bytes
- Expected usage: ~1,000-5,000 commands/day (well within free tier)
- Storage: <1 MB for typical usage

### Monitoring KV Usage

Monitor KV usage in Vercel dashboard:
- Navigate to Storage → Your KV Database
- View metrics: Commands/day, Storage used, Response time
- Set up alerts for approaching limits

## Migration and Rollout

### Deployment Strategy

The feature is already partially implemented. Enhancements include:
1. Add comprehensive logging statements
2. Add performance timing measurements
3. Add environment variable configuration
4. Update error messages for clarity

**Deployment Steps:**
1. Ensure Vercel KV is provisioned and connected (see "Vercel KV Setup" above)
2. Deploy code changes to Vercel
3. Monitor logs for cache hit/miss messages
4. Verify performance improvements in response times

### Rollback Plan

If issues arise:
1. Remove caching logic (revert to direct validation)
2. Keep rate limiting intact (separate KV usage)
3. Monitor error rates and latency
4. KV database can remain provisioned (no cost impact if unused)

### Backward Compatibility

No breaking changes:
- API interface remains unchanged
- Extension code requires no updates
- Existing sessions continue to work
- If KV is not provisioned, code falls back to direct validation
