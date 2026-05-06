import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const siteId = url.searchParams.get('siteId') || '';
  const offset = (page - 1) * limit;

  const siteWhere = siteId ? 'WHERE site_id = ?' : '';
  const siteBinds = siteId ? [siteId] : [];

  const [rows, countResult] = await Promise.all([
    env.DB.prepare(`SELECT id, email, created_at FROM waitlist ${siteWhere} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .bind(...siteBinds, limit, offset)
      .all<{ id: number; email: string; created_at: string }>(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM waitlist ${siteWhere}`)
      .bind(...siteBinds)
      .first<{ count: number }>(),
  ]);

  return new Response(JSON.stringify({
    entries: rows.results,
    total: countResult?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countResult?.count ?? 0) / limit),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
