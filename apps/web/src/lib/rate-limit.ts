import { env } from 'cloudflare:workers';
import { checkRateLimitWith, type KVNamespaceLike, type RateLimitOptions, type RateLimitResult } from './rate-limit-core';

export type { RateLimitOptions, RateLimitResult } from './rate-limit-core';

/** Convenience wrapper that uses the runtime KV binding. */
export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  return checkRateLimitWith(env.FORM_KV as unknown as KVNamespaceLike, opts);
}

export function tooManyRequests(retryAfterSec: number) {
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
    },
  });
}
