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

// Stable order for the meta columns we emit. Anything outside this set is
// dropped from CSV (raw UA strings would blow column counts; the JSON column
// preserves the full record for users who need it).
const META_COLS: { key: string; header: string }[] = [
  { key: 'country',     header: 'meta_country' },
  { key: 'region',      header: 'meta_region' },
  { key: 'timezone',    header: 'meta_timezone' },
  { key: 'browser',     header: 'meta_browser' },
  { key: 'os',          header: 'meta_os' },
  { key: 'device',      header: 'meta_device' },
  { key: 'asOrg',       header: 'meta_isp' },
  { key: 'referer',     header: 'meta_referer' },
  { key: 'acceptLang',  header: 'meta_accept_lang' },
];
const CLIENT_META_COLS: { key: string; header: string }[] = [
  { key: 'tz',         header: 'client_tz' },
  { key: 'lang',       header: 'client_lang' },
  { key: 'viewport',   header: 'client_viewport' },
  { key: 'screen',     header: 'client_screen' },
  { key: 'referrer',   header: 'client_referrer' },
];

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
    `SELECT id, form_id, data_json, meta_json, ip_hash, latency_ms, created_at FROM submissions ${where} ORDER BY created_at ASC`
  ).bind(...binds).all<{ id: string; form_id: string; data_json: string; meta_json: string | null; ip_hash: string; latency_ms: number; created_at: string }>();

  // Parse data + meta and collect unique form-data keys
  const allKeys = new Set<string>();
  const parsed = rows.results.map(r => {
    const data = JSON.parse(r.data_json || '{}');
    for (const k of Object.keys(data)) allKeys.add(k);
    let meta: any = null;
    if (r.meta_json) { try { meta = JSON.parse(r.meta_json); } catch {} }
    return { ...r, data, meta };
  });

  const dataKeys = Array.from(allKeys);
  // Header layout: form-defined columns first (most useful), then non-PII meta,
  // then bookkeeping columns. Stable column count so spreadsheet imports work.
  const headers = [
    'id', 'form_id', ...dataKeys,
    ...META_COLS.map(c => c.header),
    ...CLIENT_META_COLS.map(c => c.header),
    'ip_hash', 'latency_ms', 'created_at',
  ];
  let csv = headers.map(csvEsc).join(',') + '\n';
  for (const row of parsed) {
    const meta = row.meta || {};
    const client = meta.client || {};
    const vals = [
      row.id,
      row.form_id,
      ...dataKeys.map(k => {
        const v = row.data[k];
        return Array.isArray(v) ? v.join('; ') : (v ?? '');
      }),
      ...META_COLS.map(c => meta[c.key] ?? ''),
      ...CLIENT_META_COLS.map(c => client[c.key] ?? ''),
      row.ip_hash,
      row.latency_ms,
      row.created_at,
    ];
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
