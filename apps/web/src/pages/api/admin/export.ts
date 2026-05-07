import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken } from '../../../lib/admin-auth';

function csvEsc(val: any): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);

  if (!await validateToken(token)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formId = url.searchParams.get('formId') || '';
  const siteId = url.searchParams.get('siteId') || '';

  // Build WHERE
  const conditions: string[] = [];
  const binds: any[] = [];
  if (formId) { conditions.push('form_id = ?'); binds.push(formId); }
  if (siteId) { conditions.push('site_id = ?'); binds.push(siteId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await env.DB.prepare(
    `SELECT id, form_id, data_json, ip_hash, latency_ms, created_at FROM submissions ${where} ORDER BY created_at ASC`
  ).bind(...binds).all<{ id: string; form_id: string; data_json: string; ip_hash: string; latency_ms: number; created_at: string }>();

  // Collect all unique data keys
  const allKeys = new Set<string>();
  const parsed = rows.results.map(r => {
    const data = JSON.parse(r.data_json || '{}');
    for (const k of Object.keys(data)) allKeys.add(k);
    return { ...r, data };
  });

  const dataKeys = Array.from(allKeys);
  const headers = ['id', 'form_id', ...dataKeys, 'ip_hash', 'latency_ms', 'created_at'];
  let csv = headers.map(csvEsc).join(',') + '\n';
  for (const row of parsed) {
    const vals = [row.id, row.form_id, ...dataKeys.map(k => {
      const v = row.data[k];
      return Array.isArray(v) ? v.join('; ') : (v ?? '');
    }), row.ip_hash, row.latency_ms, row.created_at];
    csv += vals.map(csvEsc).join(',') + '\n';
  }

  const filename = formId ? `submissions-${formId}.csv` : 'submissions.csv';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};

export const prerender = false;
