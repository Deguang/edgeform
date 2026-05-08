import type { APIRoute } from 'astro';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';

/**
 * POST /api/admin/webhook-test
 * Body: { url: string, secret?: string, siteId?: string }
 * Sends a test payload to the URL and returns its status. Caller should send
 * the URL/secret currently in the editor (might not be saved yet).
 */
export const POST: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const body = await request.json() as { url?: string; secret?: string; siteId?: string };
  if (!body.url || !/^https?:\/\//i.test(body.url)) {
    return new Response(JSON.stringify({ error: 'Provide a valid http(s) URL' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = {
    event: 'test',
    siteId: body.siteId || 'config',
    message: 'EdgeForm webhook test',
    timestamp: new Date().toISOString(),
  };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (body.secret) headers['X-Webhook-Secret'] = body.secret;

  const start = Date.now();
  try {
    const res = await fetch(body.url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const latency = Date.now() - start;
    const text = await res.text().catch(() => '');
    return new Response(JSON.stringify({
      ok: res.ok,
      status: res.status,
      latency_ms: latency,
      response: text.slice(0, 400),
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: e?.message || String(e),
      latency_ms: Date.now() - start,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const prerender = false;
