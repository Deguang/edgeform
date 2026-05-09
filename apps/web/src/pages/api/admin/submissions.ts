import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const formId = url.searchParams.get('formId') || '';
  const siteId = url.searchParams.get('siteId') || '';
  const offset = (page - 1) * limit;

  // Build WHERE clause based on filters
  const conditions: string[] = [];
  const queryBinds: any[] = [];
  if (siteId) { conditions.push('site_id = ?'); queryBinds.push(siteId); }
  if (formId) { conditions.push('form_id = ?'); queryBinds.push(formId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, countResult, formIds] = await Promise.all([
    env.DB.prepare(`SELECT id, form_id, site_id, data_json, meta_json, ip_hash, user_agent, latency_ms, created_at FROM submissions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...queryBinds, limit, offset)
      .all<{ id: string; form_id: string; site_id: string; data_json: string; meta_json: string | null; ip_hash: string; user_agent: string; latency_ms: number; created_at: string }>(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM submissions ${where}`)
      .bind(...queryBinds)
      .first<{ count: number }>(),
    env.DB.prepare(`SELECT DISTINCT form_id FROM submissions ${siteId ? 'WHERE site_id = ?' : ''} ORDER BY form_id`)
      .bind(...(siteId ? [siteId] : []))
      .all<{ form_id: string }>(),
  ]);

  // Parse data_json + meta_json and extract all unique keys across entries
  const entries = rows.results.map(r => {
    let meta: any = null;
    if (r.meta_json) { try { meta = JSON.parse(r.meta_json); } catch {} }
    return {
      id: r.id,
      form_id: r.form_id,
      data: JSON.parse(r.data_json || '{}'),
      meta,
      ip_hash: r.ip_hash,
      latency_ms: r.latency_ms,
      created_at: r.created_at,
    };
  });

  const dataKeys = new Set<string>();
  for (const entry of entries) {
    for (const key of Object.keys(entry.data)) {
      dataKeys.add(key);
    }
  }

  return new Response(JSON.stringify({
    entries,
    dataKeys: Array.from(dataKeys),
    formIds: formIds.results.map(r => r.form_id),
    total: countResult?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countResult?.count ?? 0) / limit),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
