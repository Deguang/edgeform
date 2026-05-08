/**
 * Pure password hashing primitives. No env imports — safe to import from tests.
 * Format: "pbkdf2$<iterations>$<saltB64>$<hashB64>" (self-describing).
 *
 * Legacy hex SHA-256 hashes can be detected with `isLegacyHash` and verified
 * with `verifyLegacyHash`; the upgrade path is the caller's responsibility
 * (see admin-auth.ts).
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const LEGACY_SALT = '_edgeform_admin_salt_v1';

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

export function isPbkdf2Hash(stored: string): boolean {
  return stored.startsWith('pbkdf2$');
}

export function isLegacyHash(stored: string): boolean {
  return /^[0-9a-f]{64}$/.test(stored);
}

export async function legacyHash(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + LEGACY_SALT);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (isPbkdf2Hash(stored)) {
    const [, iterStr, saltB64, hashB64] = stored.split('$');
    const iterations = parseInt(iterStr, 10);
    if (!iterations || !saltB64 || !hashB64) return false;
    const salt = b64ToBytes(saltB64);
    const expected = b64ToBytes(hashB64);
    const got = await pbkdf2(password, salt, iterations);
    return timingSafeEqual(got, expected);
  }
  if (isLegacyHash(stored)) {
    const got = await legacyHash(password);
    return got === stored;
  }
  return false;
}
