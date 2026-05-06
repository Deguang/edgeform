import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  if (!secret) return true;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = await res.json() as { success: boolean };
  return data.success;
}

export const POST: APIRoute = async ({ request }) => {
  const start = Date.now();

  const body = await request.json() as { email?: string; turnstile_token?: string };

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  if (body.turnstile_token) {
    const valid = await verifyTurnstile(body.turnstile_token, env.TURNSTILE_SECRET, ip);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Bot detected' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    await env.DB.prepare('INSERT INTO waitlist (email) VALUES (?)').bind(email).run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) {
      return new Response(JSON.stringify({ error: 'Already registered', latency_ms: Date.now() - start }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw e;
  }

  // Fire webhook if configured (non-blocking)
  try {
    const configRaw = await env.FORM_KV.get('site:config');
    if (configRaw) {
      const config = JSON.parse(configRaw);
      const webhook = config.webhook;
      if (webhook?.url && (!webhook.events || webhook.events.includes('waitlist'))) {
        const payload = { event: 'waitlist', email, timestamp: new Date().toISOString() };
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (webhook.secret) headers['X-Webhook-Secret'] = webhook.secret;
        fetch(webhook.url, { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => {});
      }
    }
  } catch {}

  return new Response(JSON.stringify({ ok: true, latency_ms: Date.now() - start }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
