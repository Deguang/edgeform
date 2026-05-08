import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  isPbkdf2Hash,
  isLegacyHash,
  legacyHash,
  timingSafeEqual,
} from '../src/lib/password';

describe('password / PBKDF2', () => {
  it('hashPassword returns the expected self-describing format', async () => {
    const stored = await hashPassword('hunter2');
    expect(stored.startsWith('pbkdf2$')).toBe(true);
    const parts = stored.split('$');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('pbkdf2');
    expect(parts[1]).toBe('100000');
    // base64-encoded salt (16 bytes → 24 chars with padding)
    expect(parts[2].length).toBeGreaterThanOrEqual(20);
    // base64-encoded hash (32 bytes → 44 chars with padding)
    expect(parts[3].length).toBeGreaterThanOrEqual(40);
  });

  it('two hashes of the same password differ (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('verifyPassword accepts the original and rejects a tweak', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('correct horse battery stapler', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('isPbkdf2Hash / isLegacyHash discriminate correctly', () => {
    expect(isPbkdf2Hash('pbkdf2$100000$abc$xyz')).toBe(true);
    expect(isPbkdf2Hash('a'.repeat(64))).toBe(false);
    expect(isLegacyHash('a'.repeat(64))).toBe(true);
    expect(isLegacyHash('pbkdf2$100000$abc$xyz')).toBe(false);
    expect(isLegacyHash('not-a-hash')).toBe(false);
  });

  it('legacyHash is deterministic and matches verifyPassword in legacy mode', async () => {
    const first = await legacyHash('hello');
    const second = await legacyHash('hello');
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyPassword('hello', first)).toBe(true);
    expect(await verifyPassword('world', first)).toBe(false);
  });

  it('verifyPassword returns false for unrecognised stored format', async () => {
    expect(await verifyPassword('anything', '')).toBe(false);
    expect(await verifyPassword('anything', 'plain-text-not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', 'pbkdf2$$$$')).toBe(false);
  });

  it('timingSafeEqual: equal-length identical bytes match, anything else does not', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    const c = new Uint8Array([1, 2, 3, 5]);
    const d = new Uint8Array([1, 2, 3]);
    expect(timingSafeEqual(a, b)).toBe(true);
    expect(timingSafeEqual(a, c)).toBe(false);
    expect(timingSafeEqual(a, d)).toBe(false);
  });
});
