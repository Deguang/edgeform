import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const siteId = url.searchParams.get('siteId') || '';

  // Build conditions
  const baseConds: string[] = [];
  const baseBinds: any[] = [];
  if (siteId) { baseConds.push('site_id = ?'); baseBinds.push(siteId); }

  const wlConds = [...baseConds, "form_id = 'waitlist'"];
  const subConds = [...baseConds, "form_id != 'waitlist'"];
  const wlWhere = `WHERE ${wlConds.join(' AND ')}`;
  const subWhere = `WHERE ${subConds.join(' AND ')}`;
  const wlWhereToday = `${wlWhere} AND created_at >= date('now')`;
  const subWhereToday = `${subWhere} AND created_at >= date('now')`;

  const [waitlistCount, waitlistToday, submissionsCount, submissionsToday] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as count FROM submissions ${wlWhere}`).bind(...baseBinds).first<{ count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM submissions ${wlWhereToday}`).bind(...baseBinds).first<{ count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM submissions ${subWhere}`).bind(...baseBinds).first<{ count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM submissions ${subWhereToday}`).bind(...baseBinds).first<{ count: number }>(),
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
