import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyPassword, isPbkdf2Hash, hashPassword, timingSafeEqual } from '../../../lib/password';
import { createSession } from '../../../lib/sessions';

const RATE_LIMIT_MAX = 5;       // max attempts
const RATE_LIMIT_WINDOW = 300;  // 5 minutes in seconds
const KV_PASSWORD_KEY = 'admin:password_hash';

function getClientIP(request: Request): string {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate:login:${ip}`;
  const raw = await env.FORM_KV.get(key, 'text');
  if (!raw) return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  const data = JSON.parse(raw) as { count: number; firstAt: number };
  const elapsed = (Date.now() - data.firstAt) / 1000;
  if (elapsed > RATE_LIMIT_WINDOW) return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  if (data.count >= RATE_LIMIT_MAX) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: RATE_LIMIT_MAX - data.count - 1 };
}

async function recordFailure(ip: string): Promise<void> {
  const key = `rate:login:${ip}`;
  const raw = await env.FORM_KV.get(key, 'text');
  let data: { count: number; firstAt: number };
  if (raw) {
    data = JSON.parse(raw);
    const elapsed = (Date.now() - data.firstAt) / 1000;
    if (elapsed > RATE_LIMIT_WINDOW) {
      data = { count: 1, firstAt: Date.now() };
    } else {
      data.count++;
    }
  } else {
    data = { count: 1, firstAt: Date.now() };
  }
  await env.FORM_KV.put(key, JSON.stringify(data), { expirationTtl: RATE_LIMIT_WINDOW });
}

async function clearRateLimit(ip: string): Promise<void> {
  await env.FORM_KV.delete(`rate:login:${ip}`);
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json() as { password?: string };
  const ip = getClientIP(request);

  const rate = await checkRateLimit(ip);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Try again in 5 minutes.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(RATE_LIMIT_WINDOW) },
    });
  }

  if (!body.password) {
    return new Response(JSON.stringify({ error: 'Password required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify against the KV-stored hash (PBKDF2 or legacy SHA-256), or env fallback.
  let valid = false;
  const stored = await env.FORM_KV.get(KV_PASSWORD_KEY, 'text');
  if (stored) {
    valid = await verifyPassword(body.password, stored);
    if (valid && !isPbkdf2Hash(stored)) {
      // Legacy hash matched — silently upgrade.
      try { await env.FORM_KV.put(KV_PASSWORD_KEY, await hashPassword(body.password)); } catch {}
    }
  } else if (env.ADMIN_PASSWORD) {
    const a = new TextEncoder().encode(body.password);
    const b = new TextEncoder().encode(env.ADMIN_PASSWORD);
    valid = timingSafeEqual(a, b);
  } else {
    return new Response(JSON.stringify({ error: 'ADMIN_PASSWORD not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!valid) {
    await recordFailure(ip);
    return new Response(JSON.stringify({ error: 'Invalid password', remaining: rate.remaining }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  await clearRateLimit(ip);
  // Issue a fresh session token. The client should send this on every
  // subsequent request via Authorization: Bearer <token>.
  const session = await createSession();
  return new Response(JSON.stringify({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
