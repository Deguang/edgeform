import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';

/**
 * GET /api/admin/stats?siteId=&formId=&since=
 *
 *   siteId  — restrict to one site (omit = all sites)
 *   formId  — restrict to one form_id (omit = all forms)
 *   since   — ISO date or relative keyword: '24h' | '7d' | '30d' | '90d' | 'all'.
 *             Default 'all'.
 *
 * Returns { total, today, range, byForm } where:
 *   total   — lifetime total within the (siteId, formId, since) window
 *   today   — count today (UTC) within the same filters
 *   range   — count in the `since` window when since != 'all', else null
 *   byForm  — [{ formId, count }] top-10 forms within the filtered window,
 *             so the dashboard can render a tiny breakdown without an extra round-trip
 */

function sinceCutoff(since: string | null): string | null {
  if (!since || since === 'all') return null;
  const m = since.match(/^(\d+)([hdwm])$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const ms = (
    unit === 'h' ? n * 3600_000 :
    unit === 'd' ? n * 86_400_000 :
    unit === 'w' ? n * 604_800_000 :
    n * 30 * 86_400_000
  );
  return new Date(Date.now() - ms).toISOString();
}

export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const siteId = url.searchParams.get('siteId') || '';
  const formId = url.searchParams.get('formId') || '';
  const since = url.searchParams.get('since') || 'all';
  const cutoff = sinceCutoff(since);

  const conds: string[] = [];
  const binds: any[] = [];
  if (siteId) { conds.push('site_id = ?'); binds.push(siteId); }
  if (formId) { conds.push('form_id = ?'); binds.push(formId); }

  const baseWhere = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const todayWhere = conds.length
    ? `WHERE ${conds.join(' AND ')} AND created_at >= date('now')`
    : `WHERE created_at >= date('now')`;
  const rangeBinds = cutoff ? [...binds, cutoff] : binds;
  const rangeWhere = cutoff
    ? `WHERE ${[...conds, 'created_at >= ?'].join(' AND ')}`
    : baseWhere;

  // 30-day daily series, scoped to siteId+formId. Always 30 days even when
  // `since` is something else, so the sparkline stays consistent.
  const seriesCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const seriesConds = [...conds, 'created_at >= ?'];
  const seriesWhere = `WHERE ${seriesConds.join(' AND ')}`;
  const seriesBinds = [...binds, seriesCutoff];

  const [totalRow, todayRow, rangeRow, byFormRows, seriesRows] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as c FROM submissions ${baseWhere}`).bind(...binds).first<{ c: number }>(),
    env.DB.prepare(`SELECT COUNT(*) as c FROM submissions ${todayWhere}`).bind(...binds).first<{ c: number }>(),
    cutoff
      ? env.DB.prepare(`SELECT COUNT(*) as c FROM submissions ${rangeWhere}`).bind(...rangeBinds).first<{ c: number }>()
      : Promise.resolve(null),
    env.DB.prepare(
      `SELECT form_id, COUNT(*) as c FROM submissions ${rangeWhere} GROUP BY form_id ORDER BY c DESC LIMIT 10`
    ).bind(...rangeBinds).all<{ form_id: string; c: number }>(),
    env.DB.prepare(
      `SELECT date(created_at) as d, COUNT(*) as c FROM submissions ${seriesWhere} GROUP BY date(created_at) ORDER BY d ASC`
    ).bind(...seriesBinds).all<{ d: string; c: number }>(),
  ]);

  // Densify the daily series — fill zero-days so the sparkline x-axis is even.
  const seriesMap = new Map<string, number>();
  for (const r of seriesRows.results || []) seriesMap.set(r.d, r.c);
  const series: { d: string; c: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ d, c: seriesMap.get(d) || 0 });
  }

  return new Response(JSON.stringify({
    total: totalRow?.c ?? 0,
    today: todayRow?.c ?? 0,
    range: rangeRow ? rangeRow.c : null,
    since,
    byForm: (byFormRows.results || []).map(r => ({ formId: r.form_id, count: r.c })),
    series, // last 30 days, dense, [{ d: 'YYYY-MM-DD', c: number }]
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
