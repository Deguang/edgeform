import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

/**
 * /sitemap.xml — enumerates the main site + every sub-site KV entry.
 * Each site gets two URLs: the page itself and its /llms.txt.
 */
export const GET: APIRoute = async ({ url }) => {
  const origin = new URL(url).origin;
  const urls: { loc: string; lastmod?: string }[] = [];

  // Helper: pull updatedAt out of a KV-stored config (best-effort).
  async function siteEntry(kvKey: string, path: string) {
    try {
      const raw = await env.FORM_KV.get(kvKey, 'text');
      const cfg = raw ? JSON.parse(raw) : null;
      const lastmod = cfg?.updatedAt;
      urls.push({ loc: `${origin}${path}`, lastmod });
      urls.push({ loc: `${origin}${path === '/' ? '' : path}/llms.txt`, lastmod });
    } catch {
      urls.push({ loc: `${origin}${path}` });
    }
  }

  await siteEntry('site:config', '/');

  // Enumerate sub-sites by scanning KV for site:* keys.
  try {
    let cursor: string | undefined;
    do {
      const list: any = await env.FORM_KV.list({ prefix: 'site:', cursor });
      for (const k of list.keys) {
        if (k.name === 'site:config') continue;
        const id = k.name.slice('site:'.length);
        if (!/^[a-z0-9-]+$/.test(id)) continue;
        await siteEntry(k.name, `/s/${id}`);
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
  } catch {}

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

export const prerender = false;
