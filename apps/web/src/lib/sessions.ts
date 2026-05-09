import { env } from 'cloudflare:workers';

/**
 * Server-side admin sessions backed by KV.
 *
 * Each session is a random 32-byte token issued at login. The token never
 * carries the password — losing it leaks only that session, not the master
 * credential. Sessions auto-expire via KV TTL; a sliding refresh extends
 * lifetime as long as the session is actively used.
 */

const SESSION_PREFIX = 'session:';
const DEFAULT_TTL_SECS = 7 * 24 * 60 * 60;        // 7 days from creation
const REFRESH_THRESHOLD_SECS = 60 * 60;            // bump TTL if last refresh > 1h ago
const TOKEN_BYTES = 32;

export interface SessionRecord {
  createdAt: number;
  lastUsedAt: number;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Tokens are 64-char hex; rejects everything else fast (avoids KV lookup). */
export function looksLikeSessionToken(s: string): boolean {
  return /^[0-9a-f]{64}$/.test(s);
}

export async function createSession(): Promise<{ token: string; expiresAt: number }> {
  const token = randomToken();
  const now = Date.now();
  const record: SessionRecord = { createdAt: now, lastUsedAt: now };
  await env.FORM_KV.put(SESSION_PREFIX + token, JSON.stringify(record), {
    expirationTtl: DEFAULT_TTL_SECS,
  });
  return { token, expiresAt: now + DEFAULT_TTL_SECS * 1000 };
}

/**
 * Look up a session and refresh its TTL if it's been > 1h since last use.
 * Returns true if the token corresponds to a live session.
 */
export async function validateSession(token: string): Promise<boolean> {
  if (!looksLikeSessionToken(token)) return false;
  const key = SESSION_PREFIX + token;
  const raw = await env.FORM_KV.get(key, 'text');
  if (!raw) return false;

  let record: SessionRecord;
  try { record = JSON.parse(raw); } catch { return false; }

  // Sliding refresh: amortise writes — only re-put if it's been a while.
  const now = Date.now();
  if (now - record.lastUsedAt > REFRESH_THRESHOLD_SECS * 1000) {
    record.lastUsedAt = now;
    try {
      await env.FORM_KV.put(key, JSON.stringify(record), {
        expirationTtl: DEFAULT_TTL_SECS,
      });
    } catch {}
  }
  return true;
}

export async function deleteSession(token: string): Promise<void> {
  if (!looksLikeSessionToken(token)) return;
  await env.FORM_KV.delete(SESSION_PREFIX + token);
}

/**
 * Invalidate every active session. Called when the admin password changes
 * or when the user clicks "Logout everywhere". Cursor-paginated so a worker
 * with thousands of sessions still completes.
 */
export async function deleteAllSessions(): Promise<number> {
  let cursor: string | undefined;
  let count = 0;
  do {
    const list: any = await env.FORM_KV.list({ prefix: SESSION_PREFIX, cursor });
    for (const k of list.keys) {
      try { await env.FORM_KV.delete(k.name); count++; } catch {}
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return count;
}
