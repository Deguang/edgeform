import { env } from 'cloudflare:workers';

/**
 * Webhook delivery log — circular buffer (last N entries) per site, stored
 * in KV at hooklog:{siteId}. Used by admin UI to surface failures.
 */

const MAX_ENTRIES = 20;

export interface HookLogEntry {
  ts: number;          // epoch ms
  event: string;       // 'submission' | 'waitlist' | 'test'
  url: string;
  status: number | null;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

function logKey(siteId: string) {
  return `hooklog:${siteId === 'config' ? 'main' : siteId}`;
}

export async function appendHookLog(siteId: string, entry: HookLogEntry): Promise<void> {
  const key = logKey(siteId);
  let list: HookLogEntry[] = [];
  try {
    const raw = await env.FORM_KV.get(key, 'text');
    if (raw) list = JSON.parse(raw);
  } catch {}
  list.unshift(entry);
  if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
  try {
    await env.FORM_KV.put(key, JSON.stringify(list), {
      // 30 days retention; admin can also clear manually if added later.
      expirationTtl: 30 * 24 * 60 * 60,
    });
  } catch {}
}

export async function readHookLog(siteId: string): Promise<HookLogEntry[]> {
  try {
    const raw = await env.FORM_KV.get(logKey(siteId), 'text');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Wrap a fetch in timing + result logging. Suitable for use inside
 * ctx.waitUntil(...). Always resolves (never throws).
 */
export async function fireAndLog(
  siteId: string,
  event: string,
  url: string,
  init: RequestInit,
): Promise<void> {
  const start = Date.now();
  let status: number | null = null;
  let ok = false;
  let error: string | undefined;
  try {
    const res = await fetch(url, init);
    status = res.status;
    ok = res.ok;
    if (!ok) error = `HTTP ${res.status}`;
  } catch (e: any) {
    error = e?.message || String(e);
  }
  await appendHookLog(siteId, {
    ts: start,
    event,
    url,
    status,
    latencyMs: Date.now() - start,
    ok,
    ...(error ? { error } : {}),
  });
}
