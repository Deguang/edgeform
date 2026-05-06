import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const siteId = url.searchParams.get('siteId') || '';
  const siteWhere = siteId ? 'WHERE site_id = ?' : '';
  const siteWhereAnd = siteId ? "WHERE site_id = ? AND created_at >= date('now')" : "WHERE created_at >= date('now')";
  const siteBinds = siteId ? [siteId] : [];

  const [waitlistCount, waitlistToday, submissionsCount, submissionsToday] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as count FROM waitlist ${siteWhere}`).bind(...siteBinds).first<{ count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM waitlist ${siteWhereAnd}`).bind(...siteBinds).first<{ count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM submissions ${siteWhere}`).bind(...siteBinds).first<{ count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM submissions ${siteWhereAnd}`).bind(...siteBinds).first<{ count: number }>(),
  ]);

  return new Response(JSON.stringify({
    waitlist: {
      total: waitlistCount?.count ?? 0,
      today: waitlistToday?.count ?? 0,
    },
    submissions: {
      total: submissionsCount?.count ?? 0,
      today: submissionsToday?.count ?? 0,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
