import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';

function kvKey(siteId?: string | null): string {
  return siteId && siteId !== 'config' ? `site:${siteId}` : 'site:config';
}

// GET — read site config from KV. ?siteId=xxx for sub-sites, omit for main.
//        ?list=1 returns all site IDs.
export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  // List all sites
  if (url.searchParams.get('list') === '1') {
    const listed = await env.FORM_KV.list({ prefix: 'site:' });
    const sites: { id: string; title: string; url: string }[] = [];
    for (const key of listed.keys) {
      const name = key.name;
      // Skip non-config keys (e.g. site:config:i18n)
      if (name.includes(':i18n') || name.includes(':meta')) continue;
      const id = name === 'site:config' ? 'config' : name.slice(5);
      try {
        const raw = await env.FORM_KV.get(name, 'text');
        const cfg = raw ? JSON.parse(raw) : {};
        sites.push({
          id,
          title: cfg.title || id,
          url: id === 'config' ? '/' : `/s/${id}`,
        });
      } catch {
        sites.push({ id, title: id, url: id === 'config' ? '/' : `/s/${id}` });
      }
    }
    return new Response(JSON.stringify({ sites }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const siteId = url.searchParams.get('siteId');
  const config = await env.FORM_KV.get(kvKey(siteId), 'text');

  return new Response(JSON.stringify({
    config: config ? JSON.parse(config) : null,
    hasConfig: !!config,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// PUT — save site config to KV
export const PUT: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const body = await request.json() as { config: any; siteId?: string };
  if (!body.config || !body.config.pages) {
    return new Response(JSON.stringify({ error: 'Invalid config: must have pages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Add metadata
  body.config.updatedAt = new Date().toISOString();
  body.config.version = (body.config.version || 0) + 1;

  const key = kvKey(body.siteId || url.searchParams.get('siteId'));
  await env.FORM_KV.put(key, JSON.stringify(body.config));

  return new Response(JSON.stringify({ ok: true, version: body.config.version }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// DELETE — remove config from KV
export const DELETE: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const siteId = url.searchParams.get('siteId');
  await env.FORM_KV.delete(kvKey(siteId));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
