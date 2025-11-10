# Implementation Plan: Migrate from Vercel KV to Upstash Redis

## Overview
This plan migrates the existing Vercel KV implementation to Upstash Redis. The current implementation already has session caching, rate limiting, logging, and error handling in place using `@vercel/kv`. We need to replace it with `@upstash/redis`.

## Tasks

- [x] 1. Install Upstash Redis SDK and update dependencies





	- Install `@upstash/redis` package in the server workspace
	- Remove `@vercel/kv` dependency from package.json
	- Update package-lock.json by running npm install
	- _Requirements: 4.3_

- [x] 2. Replace Vercel KV imports with Upstash Redis




	- Replace `import { kv } from "@vercel/kv"` with `import { Redis } from "@upstash/redis"`
	- Initialize Redis client using `const redis = Redis.fromEnv()` at the top of the file
	- Update all references from `kv` to `redis` throughout the file
	- _Requirements: 4.3_

- [x] 3. Update Redis API method calls for compatibility





	- [x] 3.1 Update session cache read operation

		- Change `kv.get<boolean>(cacheKey)` to `redis.get<boolean>(cacheKey)`
		- Verify the return type and null handling remain the same
		- _Requirements: 1.3, 4.1_
	


	- [x] 3.2 Update session cache write operation

		- Change `kv.setex(cacheKey, SESSION_CACHE_TTL, true)` to `redis.set(cacheKey, true, { ex: SESSION_CACHE_TTL })`
		- Verify TTL is set correctly using the `ex` option (seconds)

		- _Requirements: 1.4, 3.1, 4.2_
	
	- [x] 3.3 Update rate limiting operations

		- Change `kv.incr(key)` to `redis.incr(key)`
		- Change `kv.expire(key, window)` to `redis.expire(key, window)`
		- Verify rate limiting logic continues to work correctly
		- _Requirements: 2.1, 2.2_

- [x] 4. Update environment variable references in ProxyEnv interface




	- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not required in ProxyEnv (automatically read by Redis.fromEnv())
	- Keep existing `SESSION_CACHE_TTL` and `WAGTAIL_VALIDATION_TIMEOUT` optional fields
	- Update comments to reference Upstash Redis instead of Vercel KV
	- _Requirements: 4.2_

-

- [x] 5. Update error messages and logging references



	- Update error log messages to reference "Redis" instead of "KV"
	- Update comments in `checkRateLimit` function to reference Redis
	- Update comments in `validateSessionWithCache` function to reference Upstash Redis
	- Ensure all log messages are consistent with the new Redis implementation
	- _Requirements: 2.5, 5.4_

- [x] 6. Test the migration locally with Upstash credentials






	- Run `vercel env pull .env.development.local` to get Upstash credentials
	- Start the development server with `vercel dev`
	- Test session validation caching with the extension
	- Verify rate limiting still works correctly
	- Check logs for proper cache hit/miss messages
	- _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

- [ ] 7. Update documentation to reflect Upstash Redis usage
	- Update any inline comments referencing Vercel KV
	- Update README if it mentions the caching implementation
	- Add notes about Upstash Redis setup requirements
	- Document the environment variables needed (automatically set by Vercel)
	- _Requirements: 4.2, 4.5_
