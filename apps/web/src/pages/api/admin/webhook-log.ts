import type { APIRoute } from 'astro';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';
import { readHookLog } from '../../../lib/webhook-log';

/** GET /api/admin/webhook-log?siteId=... — last 20 webhook deliveries */
export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const siteId = url.searchParams.get('siteId') || 'config';
  const log = await readHookLog(siteId);
  return new Response(JSON.stringify({ log }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
