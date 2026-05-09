import { env } from 'cloudflare:workers';
import {
  hashPassword as pwHash,
  verifyPassword,
  isPbkdf2Hash,
  timingSafeEqual,
} from './password';
import { validateSession, looksLikeSessionToken } from './sessions';

const KV_PASSWORD_KEY = 'admin:password_hash';

export const hashPassword = pwHash;

export function getAuth(request: Request, url: URL): string | null {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return url.searchParams.get('token');
}

/**
 * Validate a token (raw password) against the KV-stored hash, or fall back to
 * the env-provided ADMIN_PASSWORD for first-run / dev. On a successful match
 * against a legacy SHA-256 hash, transparently migrate to PBKDF2.
 */
export async function validateToken(token: string | null): Promise<boolean> {
  if (!token) return false;

  // Preferred path: opaque session token. Fast path — if it doesn't even look
  // like one (length / charset), skip the KV lookup entirely.
  if (looksLikeSessionToken(token)) {
    if (await validateSession(token)) return true;
    // Fall through: a 64-hex-char string could in theory match someone's
    // actual password, so we still try password verification below.
  }

  // Backward-compat path: password used directly as bearer (pre-session-token
  // clients, or env-only setups). Will be retired once all live clients are
  // re-logged in.
  const stored = await env.FORM_KV.get(KV_PASSWORD_KEY, 'text');
  if (stored) {
    const ok = await verifyPassword(token, stored);
    if (ok && !isPbkdf2Hash(stored)) {
      try { await env.FORM_KV.put(KV_PASSWORD_KEY, await pwHash(token)); } catch {}
    }
    return ok;
  }

  if (env.ADMIN_PASSWORD) {
    const a = new TextEncoder().encode(token);
    const b = new TextEncoder().encode(env.ADMIN_PASSWORD);
    return timingSafeEqual(a, b);
  }

  return false;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
