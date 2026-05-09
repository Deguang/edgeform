import { describe, it, expect } from 'vitest';
import { validateSiteConfig } from '../../../packages/shared/src/schema';

const minimal = {
  title: 'My Site',
  theme: { name: 'glass' },
  pages: [{ id: 'p1', blocks: [] }],
};

describe('validateSiteConfig', () => {
  it('accepts a minimal valid config', () => {
    const r = validateSiteConfig(minimal);
    expect(r.ok).toBe(true);
  });

  it('rejects missing title', () => {
    const r = validateSiteConfig({ ...minimal, title: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes('title'))).toBe(true);
  });

  it('rejects missing theme', () => {
    const r = validateSiteConfig({ ...minimal, theme: undefined });
    expect(r.ok).toBe(false);
  });

  it('rejects missing pages array', () => {
    const r = validateSiteConfig({ ...minimal, pages: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some(e => e.includes('pages'))).toBe(true);
  });

  it('rejects pages with a missing id', () => {
    const r = validateSiteConfig({ ...minimal, pages: [{ blocks: [] }] });
    expect(r.ok).toBe(false);
  });

  it('rejects a page block missing the type', () => {
    const r = validateSiteConfig({
      ...minimal,
      pages: [{ id: 'p', blocks: [{ heading: 'no type' } as any] }],
    });
    expect(r.ok).toBe(false);
  });

  it('accepts unknown block fields via passthrough', () => {
    const r = validateSiteConfig({
      ...minimal,
      pages: [{ id: 'p', blocks: [{ type: 'hero', someFutureField: 'ok' } as any] }],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects malformed primaryColor', () => {
    const r = validateSiteConfig({
      ...minimal,
      theme: { name: 'glass', primaryColor: 'not-a-hex' },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts six-char hex primaryColor', () => {
    const r = validateSiteConfig({
      ...minimal,
      theme: { name: 'glass', primaryColor: '#3b82f6' },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects bad webhook url', () => {
    const r = validateSiteConfig({
      ...minimal,
      webhook: { url: 'not a url' },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts a complex form block with nested steps', () => {
    const r = validateSiteConfig({
      ...minimal,
      pages: [{
        id: 'survey',
        blocks: [{
          type: 'form',
          formId: 'survey',
          steps: [{
            title: 'Step 1',
            fields: [{ id: 'q1', type: 'select', options: ['a', 'b'], required: true }],
          }],
        }],
      }],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects form field with unknown type', () => {
    const r = validateSiteConfig({
      ...minimal,
      pages: [{
        id: 'p',
        blocks: [{
          type: 'form',
          fields: [{ id: 'q', type: 'wat' as any }],
        }],
      }],
    });
    expect(r.ok).toBe(false);
  });

  it('accepts a valid GA4 Measurement ID', () => {
    expect(validateSiteConfig({ ...minimal, analytics: { ga4Id: 'G-ABC123XYZ' } }).ok).toBe(true);
    expect(validateSiteConfig({ ...minimal, analytics: { ga4Id: 'g-abc123' } }).ok).toBe(true);  // case-insensitive
  });

  it('rejects malformed GA4 Measurement ID', () => {
    expect(validateSiteConfig({ ...minimal, analytics: { ga4Id: 'UA-12345-1' } }).ok).toBe(false);
    expect(validateSiteConfig({ ...minimal, analytics: { ga4Id: 'just-text' } }).ok).toBe(false);
    expect(validateSiteConfig({ ...minimal, analytics: { ga4Id: '' } }).ok).toBe(false);
  });

  it('accepts a valid slug', () => {
    expect(validateSiteConfig({ ...minimal, slug: 'my-site' }).ok).toBe(true);
    expect(validateSiteConfig({ ...minimal, slug: 'a-b-c-1-2-3' }).ok).toBe(true);
  });

  it('rejects slugs with uppercase / special chars / spaces', () => {
    expect(validateSiteConfig({ ...minimal, slug: 'My-Site' }).ok).toBe(false);
    expect(validateSiteConfig({ ...minimal, slug: 'my site' }).ok).toBe(false);
    expect(validateSiteConfig({ ...minimal, slug: 'my_site' }).ok).toBe(false);
    expect(validateSiteConfig({ ...minimal, slug: 'my.site' }).ok).toBe(false);
  });

  it('accepts internalName up to 120 chars; rejects longer', () => {
    expect(validateSiteConfig({ ...minimal, internalName: 'Uninstall Survey' }).ok).toBe(true);
    expect(validateSiteConfig({ ...minimal, internalName: 'x'.repeat(121) }).ok).toBe(false);
  });

  it('analytics is optional (omit altogether is fine)', () => {
    expect(validateSiteConfig({ ...minimal }).ok).toBe(true);
    expect(validateSiteConfig({ ...minimal, analytics: {} }).ok).toBe(true);
  });

  it('accepts collectMeta boolean (opt-out toggle)', () => {
    expect(validateSiteConfig({ ...minimal, collectMeta: false }).ok).toBe(true);
    expect(validateSiteConfig({ ...minimal, collectMeta: true }).ok).toBe(true);
    expect(validateSiteConfig({ ...minimal, collectMeta: 'no' as any }).ok).toBe(false);
  });

  it('preserves unknown top-level fields after parse', () => {
    const r = validateSiteConfig({ ...minimal, customField: { hello: 'world' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.data as any).customField?.hello).toBe('world');
  });

  it('reports multiple issues at once', () => {
    const r = validateSiteConfig({
      pages: 'not-an-array',
      theme: 'not-an-object',
    } as any);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});
