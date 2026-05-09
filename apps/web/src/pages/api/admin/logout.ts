import type { APIRoute } from 'astro';
import { getAuth } from '../../../lib/admin-auth';
import { deleteSession, deleteAllSessions, looksLikeSessionToken } from '../../../lib/sessions';

/**
 * POST /api/admin/logout         — invalidates the caller's session
 * POST /api/admin/logout?all=1   — invalidates EVERY active session (use this
 *                                  when changing the password or when you
 *                                  suspect a leaked session)
 *
 * Always returns 200, even when the token is unknown — prevents token-existence
 * probing.
 */
export const POST: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  const all = url.searchParams.get('all') === '1';

  let count = 0;
  if (all) {
    count = await deleteAllSessions();
  } else if (token && looksLikeSessionToken(token)) {
    await deleteSession(token);
    count = 1;
  }

  return new Response(JSON.stringify({ ok: true, deleted: count }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
