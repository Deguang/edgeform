import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

const RATE_LIMIT_MAX = 5;       // max attempts
const RATE_LIMIT_WINDOW = 300;  // 5 minutes in seconds
const KV_PASSWORD_KEY = 'admin:password_hash';

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + '_edgeform_admin_salt_v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

  // Rate limit check
  const rate = await checkRateLimit(ip);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Try again in 5 minutes.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(RATE_LIMIT_WINDOW) },
    });
  }

  if (!body.password) {
    return new Response(JSON.stringify({ error: 'Password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check KV password first, then fallback to env
  let valid = false;
  const kvHash = await env.FORM_KV.get(KV_PASSWORD_KEY, 'text');
  if (kvHash) {
    const inputHash = await hashPassword(body.password);
    valid = inputHash === kvHash;
  } else if (env.ADMIN_PASSWORD) {
    valid = body.password === env.ADMIN_PASSWORD;
  } else {
    return new Response(JSON.stringify({ error: 'ADMIN_PASSWORD not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!valid) {
    await recordFailure(ip);
    return new Response(JSON.stringify({ error: 'Invalid password', remaining: rate.remaining }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await clearRateLimit(ip);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
