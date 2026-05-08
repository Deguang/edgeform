/**
 * Pure rate-limit logic — no `cloudflare:workers` import, safe for tests.
 * The env-bound wrapper lives in rate-limit.ts.
 */

export interface RateLimitOptions {
  scope: string;
  ip: string;
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec?: number;
}

export interface KVNamespaceLike {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export async function ipKey(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + '_rl');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function checkRateLimitWith(
  kv: KVNamespaceLike,
  opts: RateLimitOptions,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const cutoff = now - opts.windowMs;
  const key = `rl:${opts.scope}:${await ipKey(opts.ip)}`;
  let hits: number[] = [];
  try {
    const raw = await kv.get(key, 'text');
    if (raw) hits = (JSON.parse(raw) as { hits: number[] }).hits || [];
  } catch {}

  hits = hits.filter(t => t > cutoff);

  if (hits.length >= opts.max) {
    const oldest = hits[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000)),
    };
  }

  hits.push(now);
  try {
    await kv.put(key, JSON.stringify({ hits }), {
      expirationTtl: Math.max(60, Math.ceil(opts.windowMs / 1000) + 60),
    });
  } catch {}

  return { ok: true, remaining: opts.max - hits.length };
}
