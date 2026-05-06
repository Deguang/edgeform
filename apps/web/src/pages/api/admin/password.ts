import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getAuth, validateToken, hashPassword } from '../../../lib/admin-auth';

const KV_PASSWORD_KEY = 'admin:password_hash';

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

function validateStrength(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

/**
 * POST /api/admin/password
 * Body: { currentPassword: string, newPassword: string }
 */
export const POST: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) {
    return jsonRes({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json() as { currentPassword?: string; newPassword?: string };

  if (!body.currentPassword || !body.newPassword) {
    return jsonRes({ error: 'currentPassword and newPassword are required' }, 400);
  }

  // Verify current password
  if (!await validateToken(body.currentPassword)) {
    return jsonRes({ error: 'Current password is incorrect' }, 403);
  }

  // Validate new password strength
  const strengthError = validateStrength(body.newPassword);
  if (strengthError) {
    return jsonRes({ error: strengthError }, 400);
  }

  // Hash and store in KV
  const hash = await hashPassword(body.newPassword);
  await env.FORM_KV.put(KV_PASSWORD_KEY, hash);

  return jsonRes({ ok: true, message: 'Password updated successfully' });
};

export const prerender = false;
