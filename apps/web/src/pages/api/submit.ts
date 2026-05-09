import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { checkRateLimit, tooManyRequests } from '../../lib/rate-limit';
import { fireAndLog } from '../../lib/webhook-log';
import { parseUA } from '../../lib/ua-parse';

const MAX_BODY_BYTES = 64 * 1024;

export const POST: APIRoute = async ({ request, locals }) => {
  const start = Date.now();
  const ctx = (locals as any)?.cfContext;
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';

  // Rate limit: 10 submissions / minute per IP.
  const rl = await checkRateLimit({ scope: 'submit', ip, windowMs: 60_000, max: 10 });
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec ?? 60);

  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength && contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as {
    formId?: string;
    siteId?: string;
    data?: Record<string, any>;
    _client_meta?: Record<string, any>;
  };

  if (!body.data || typeof body.data !== 'object') {
    return new Response(JSON.stringify({ error: 'Missing form data' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const formId = body.formId || 'default';
  const siteId = body.siteId || 'config';
  const id = crypto.randomUUID();
  const ipHash = await hashIP(ip);
  const ua = request.headers.get('user-agent') || '';

  // Read site config once — used for the collectMeta flag and the webhook below.
  const kvKey = siteId === 'config' ? 'site:config' : `site:${siteId}`;
  let config: any = null;
  try {
    const raw = await env.FORM_KV.get(kvKey);
    if (raw) config = JSON.parse(raw);
  } catch {}

  // Collect non-PII metadata when enabled (default ON; per-site opt-out).
  // Cloudflare populates request.cf at the edge with country / region / tz / ASN.
  let metaJson: string | null = null;
  const collectMeta = config?.collectMeta !== false;
  if (collectMeta) {
    const cf = (request as any).cf || {};
    const parsed = parseUA(ua);
    const referer = request.headers.get('referer') || '';
    const acceptLang = request.headers.get('accept-language') || '';

    // Whitelist what we keep from client meta. Drops anything unknown.
    const cm = body._client_meta || {};
    const clientMeta: Record<string, any> = {};
    if (typeof cm.tz === 'string') clientMeta.tz = String(cm.tz).slice(0, 64);
    if (typeof cm.lang === 'string') clientMeta.lang = String(cm.lang).slice(0, 32);
    if (typeof cm.viewport === 'string') clientMeta.viewport = String(cm.viewport).slice(0, 24);
    if (typeof cm.screen === 'string') clientMeta.screen = String(cm.screen).slice(0, 24);
    if (typeof cm.referrer === 'string') clientMeta.referrer = String(cm.referrer).slice(0, 512);

    metaJson = JSON.stringify({
      country: cf.country || null,           // 2-letter code (CN, US, JP)
      region: cf.region || null,             // sub-region (California, Tokyo)
      timezone: cf.timezone || null,         // IANA tz (Asia/Shanghai)
      asn: cf.asn ?? null,
      asOrg: cf.asOrganization || null,
      browser: parsed.browser,
      os: parsed.os,
      device: parsed.device,
      ua,                                     // raw, capped at 1KB by parseUA
      referer: referer.slice(0, 512),
      acceptLang: acceptLang.slice(0, 64),
      ...(Object.keys(clientMeta).length ? { client: clientMeta } : {}),
    });
  }

  try {
    // FK guard for legacy `forms` table.
    await env.DB.prepare(
      'INSERT OR IGNORE INTO forms (id, title, status) VALUES (?, ?, ?)'
    ).bind(formId, formId, 'published').run();
    await env.DB.prepare(
      'INSERT INTO submissions (id, form_id, site_id, data_json, meta_json, ip_hash, user_agent, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, formId, siteId, JSON.stringify(body.data), metaJson, ipHash, ua, Date.now() - start).run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fire webhook if configured.
  try {
    const webhook = config?.webhook;
    const eventOk = !webhook?.events || webhook.events.includes('submission');
    // formIds allowlist: empty/missing means "all forms"; otherwise strict membership.
    const formIdOk = !webhook?.formIds?.length || webhook.formIds.includes(formId);
    if (webhook?.url && eventOk && formIdOk) {
      const payload: any = { event: 'submission', siteId, formId, data: body.data, id, timestamp: new Date().toISOString() };
      if (metaJson) payload.meta = JSON.parse(metaJson);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webhook.secret) headers['X-Webhook-Secret'] = webhook.secret;
      const fire = fireAndLog(siteId, 'submission', webhook.url, {
        method: 'POST', headers, body: JSON.stringify(payload),
      }, formId);
      if (ctx?.waitUntil) ctx.waitUntil(fire); else await fire;
    }
  } catch {}

  return new Response(JSON.stringify({ ok: true, id, latency_ms: Date.now() - start }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  });
};

async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + '_edgeform_salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const prerender = false;
