import { env } from 'cloudflare:workers';

/**
 * URL-slug indirection for sub-sites.
 *
 *   /s/{slug}  →  KV slug:{slug}  →  id  →  KV site:{id}
 *
 * The id is the immutable primary key (also used as D1 site_id and
 * hooklog:{id}). The slug is mutable; users rename it freely. Old slugs
 * stay as forever-aliases — overwrite is allowed but we never auto-delete
 * the old mapping, so previously-shared URLs keep resolving.
 *
 * Backward-compat: when no slug:{x} mapping exists for a request, we fall
 * back to direct site:{x} lookup so legacy sites (created before this
 * indirection layer) keep working unchanged.
 */

const SLUG_PREFIX = 'slug:';
const SITE_PREFIX = 'site:';

/** Resolve a slug to a site id. Returns null if the slug doesn't map. */
export async function resolveSlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  try {
    const id = await env.FORM_KV.get(SLUG_PREFIX + slug, 'text');
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Load a site config by either slug OR direct id (legacy path).
 * Returns the parsed config + the resolved id, or null.
 */
export async function loadSiteByPathToken(token: string): Promise<{ id: string; config: any } | null> {
  // 1. Try slug indirection first.
  const id = await resolveSlug(token);
  if (id) {
    try {
      const raw = await env.FORM_KV.get(SITE_PREFIX + id, 'text');
      if (raw) return { id, config: JSON.parse(raw) };
    } catch {}
  }
  // 2. Legacy: token IS the id.
  try {
    const raw = await env.FORM_KV.get(SITE_PREFIX + token, 'text');
    if (raw) return { id: token, config: JSON.parse(raw) };
  } catch {}
  return null;
}

/** Write a slug → id mapping. Overwrites any existing mapping for the same slug. */
export async function setSlug(slug: string, id: string): Promise<void> {
  if (!slug || !id) return;
  await env.FORM_KV.put(SLUG_PREFIX + slug, id);
}

/** Remove a slug alias. Used for the manual "Remove old URL" admin action. */
export async function deleteSlug(slug: string): Promise<void> {
  if (!slug) return;
  await env.FORM_KV.delete(SLUG_PREFIX + slug);
}

/** Enumerate every slug → id mapping (for admin's "manage URL aliases" view). */
export async function listSlugs(): Promise<{ slug: string; id: string }[]> {
  const out: { slug: string; id: string }[] = [];
  let cursor: string | undefined;
  do {
    const list: any = await env.FORM_KV.list({ prefix: SLUG_PREFIX, cursor });
    for (const k of list.keys) {
      const slug = k.name.slice(SLUG_PREFIX.length);
      try {
        const id = await env.FORM_KV.get(k.name, 'text');
        if (id) out.push({ slug, id });
      } catch {}
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return out;
}
