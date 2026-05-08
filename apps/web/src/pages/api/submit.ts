import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request, locals }) => {
  const start = Date.now();
  const body = await request.json() as { formId?: string; siteId?: string; data?: Record<string, any> };
  // Astro v6 (Cloudflare adapter): ExecutionContext lives at locals.cfContext.
  // Accessing the legacy locals.runtime.ctx path throws.
  const ctx = (locals as any)?.cfContext;

  if (!body.data || typeof body.data !== 'object') {
    return new Response(JSON.stringify({ error: 'Missing form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formId = body.formId || 'default';
  const siteId = body.siteId || 'config';
  const id = crypto.randomUUID();
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  const ipHash = await hashIP(ip);
  const ua = request.headers.get('user-agent') || '';

  try {
    // Ensure the form_id exists in forms table (FK constraint).
    // Form definitions live in KV; this row is only here to satisfy the legacy FK.
    await env.DB.prepare(
      'INSERT OR IGNORE INTO forms (id, title, status) VALUES (?, ?, ?)'
    ).bind(formId, formId, 'published').run();
    await env.DB.prepare(
      'INSERT INTO submissions (id, form_id, site_id, data_json, ip_hash, user_agent, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, formId, siteId, JSON.stringify(body.data), ipHash, ua, Date.now() - start).run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fire webhook if configured (non-blocking).
  // Read the SAME site's config the submission is for (sub-sites have their own webhook).
  try {
    const kvKey = siteId === 'config' ? 'site:config' : `site:${siteId}`;
    const configRaw = await env.FORM_KV.get(kvKey);
    if (configRaw) {
      const config = JSON.parse(configRaw);
      const webhook = config.webhook;
      if (webhook?.url && (!webhook.events || webhook.events.includes('submission'))) {
        const payload = { event: 'submission', siteId, formId, data: body.data, id, timestamp: new Date().toISOString() };
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (webhook.secret) headers['X-Webhook-Secret'] = webhook.secret;
        // Workers terminate the moment the response is returned; without
        // waitUntil the fetch promise is cancelled before it even connects.
        const fire = fetch(webhook.url, { method: 'POST', headers, body: JSON.stringify(payload) }).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(fire); else await fire;
      }
    }
  } catch {}

  return new Response(JSON.stringify({ ok: true, id, latency_ms: Date.now() - start }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + '_edgeform_salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const prerender = false;
