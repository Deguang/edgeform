import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';
import { validateSiteConfig } from '@edgeform/shared/src/schema';
import { setSlug, deleteSlug } from '../../../lib/slug-map';

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
    const sites: { id: string; title: string; internalName: string; slug: string; url: string }[] = [];
    for (const key of listed.keys) {
      const name = key.name;
      // Skip non-config keys (e.g. site:config:i18n)
      if (name.includes(':i18n') || name.includes(':meta')) continue;
      const id = name === 'site:config' ? 'config' : name.slice(5);
      try {
        const raw = await env.FORM_KV.get(name, 'text');
        const cfg = raw ? JSON.parse(raw) : {};
        const slug = cfg.slug || id;
        sites.push({
          id,
          title: cfg.title || id,
          internalName: cfg.internalName || cfg.title || id,
          slug,
          url: id === 'config' ? '/' : `/s/${slug}`,
        });
      } catch {
        sites.push({ id, title: id, internalName: id, slug: id, url: id === 'config' ? '/' : `/s/${id}` });
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

  const siteId = body.siteId || url.searchParams.get('siteId') || 'config';
  const key = kvKey(siteId);

  // Slug mapping: only relevant for sub-sites. The id is immutable (the KV key
  // itself), but the slug is mutable. When the user changes slug, we install
  // the new slug → id mapping. Old slugs stay as forever-aliases — overwriting
  // them would silently break links anyone shared.
  let slugChanged = false;
  if (siteId !== 'config') {
    // Default slug = id when first introduced (for sites created before this
    // indirection layer existed).
    const newSlug = (body.config.slug || siteId).toString();
    if (!/^[a-z0-9-]+$/.test(newSlug)) {
      return new Response(JSON.stringify({
        error: 'Invalid slug',
        issues: ['slug: lowercase letters, numbers, hyphens only'],
      }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    body.config.slug = newSlug;
    // Record the mapping. Cheap: KV put for one short string.
    try { await setSlug(newSlug, siteId); } catch {}
    // Track whether the visible URL changed for the response.
    try {
      const raw = await env.FORM_KV.get(key, 'text');
      if (raw) {
        const prev = JSON.parse(raw);
        slugChanged = (prev?.slug || siteId) !== newSlug;
      }
    } catch {}
  }

  await env.FORM_KV.put(key, JSON.stringify(body.config));

  return new Response(JSON.stringify({
    ok: true,
    version: body.config.version,
    slug: body.config.slug,
    slugChanged,
  }), {
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

  // 1. Read current config so we know its slug, then remove it from KV.
  let slug: string | null = null;
  try {
    const raw = await env.FORM_KV.get(kvKey(siteId), 'text');
    if (raw) slug = JSON.parse(raw)?.slug || null;
  } catch {}
  await env.FORM_KV.delete(kvKey(siteId));

  // 2. Remove the canonical slug mapping. Old aliases stay (point at a
  // now-missing site → 404). User can curate aliases via /admin/slug-aliases
  // (todo) if needed.
  if (slug && slug !== siteId) {
    try { await deleteSlug(slug); } catch {}
  }
  try { await deleteSlug(siteId); } catch {}

  // 3. Remove webhook delivery log (best-effort; key may not exist)
  try { await env.FORM_KV.delete(`hooklog:${siteId}`); } catch {}

  // 4. Wipe submissions for this site (use the FK-aware delete order)
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
