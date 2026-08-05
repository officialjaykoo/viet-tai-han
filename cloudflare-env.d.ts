/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Worker bindings for this project.
 * Keep this slim and hand-maintained. Full runtime stubs come from
 * `@cloudflare/workers-types` — do not commit a 500KB `wrangler types` dump.
 *
 * Optional: `npm run cf-typegen` writes a full dump under /tmp for exploration.
 */

interface CloudflareEnv {
	DB: D1Database;
	CACHE?: KVNamespace;
	POST_OBJECT: DurableObjectNamespace;
	MEDIA_BUCKET: R2Bucket;
	AI: Ai;
	VECTORIZE: VectorizeIndex;
	ASSETS: Fetcher;
	EDGE_IP_RATE_LIMITER: RateLimit;
	TUNNEL_IP_RATE_LIMITER: RateLimit;
	EXPENSIVE_IP_RATE_LIMITER: RateLimit;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	TURNSTILE_SECRET_KEY: string;
	NEXT_PUBLIC_TURNSTILE_SITE_KEY: string;
	NEXTJS_ENV?: string;
}

declare namespace NodeJS {
	interface ProcessEnv {
		BETTER_AUTH_SECRET?: string;
		BETTER_AUTH_URL?: string;
		TURNSTILE_SECRET_KEY?: string;
		NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
		NEXTJS_ENV?: string;
	}
}
