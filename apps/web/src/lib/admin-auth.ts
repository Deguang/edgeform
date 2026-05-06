import { env } from 'cloudflare:workers';

const KV_PASSWORD_KEY = 'admin:password_hash';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + '_edgeform_admin_salt_v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getAuth(request: Request, url: URL): string | null {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return url.searchParams.get('token');
}

/**
 * Validate a token (raw password) against KV hash or env fallback.
 */
export async function validateToken(token: string | null): Promise<boolean> {
  if (!token) return false;

  // KV hash takes priority
  const kvHash = await env.FORM_KV.get(KV_PASSWORD_KEY, 'text');
  if (kvHash) {
    const inputHash = await hashPassword(token);
    return inputHash === kvHash;
  }

  // Fallback to env
  if (env.ADMIN_PASSWORD) {
    return token === env.ADMIN_PASSWORD;
  }

  return false;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
