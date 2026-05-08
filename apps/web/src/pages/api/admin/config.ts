import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';
import { validateSiteConfig } from '@edgeform/shared/src/schema';

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
  if (!body.config) {
    return new Response(JSON.stringify({ error: 'Missing config' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate against the schema. Reject malformed configs before they hit KV
  // — protects the renderer from runtime crashes due to bad shape.
  const validated = validateSiteConfig(body.config);
  if (!validated.ok) {
    return new Response(JSON.stringify({
      error: 'Invalid config',
      issues: validated.errors,
    }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
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

// DELETE — remove a sub-site and clean up its data (D1 submissions + KV
// hooklog). Refuses to delete the main site (use PUT with default config).
export const DELETE: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const siteId = url.searchParams.get('siteId');
  if (!siteId || siteId === 'config') {
    return new Response(JSON.stringify({ error: 'Cannot delete the main site' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Remove site config from KV
  await env.FORM_KV.delete(kvKey(siteId));

  // 2. Remove webhook delivery log (best-effort; key may not exist)
  try { await env.FORM_KV.delete(`hooklog:${siteId}`); } catch {}

  // 3. Wipe submissions for this site (use the FK-aware delete order)
  let submissionsDeleted = 0;
  try {
    const res = await env.DB.prepare('DELETE FROM submissions WHERE site_id = ?').bind(siteId).run();
    submissionsDeleted = (res.meta as any)?.changes || 0;
  } catch {}

  return new Response(JSON.stringify({ ok: true, submissionsDeleted }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
