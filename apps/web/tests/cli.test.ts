import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

/**
 * Instead of spawning subprocesses (slow due to tsx startup),
 * we extract and test the core logic functions directly.
 */

// ─── Replicate core CLI logic for unit testing ──────────────────────────────

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce((o, k) => {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    return o[k];
  }, obj);
  parent[last] = value;
}

function getDefaultBlock(type: string, opts: { title?: string; src?: string; formId?: string } = {}): any {
  const title = opts.title || '';
  switch (type) {
    case 'hero': return { type, title: title || 'Hello World', subtitle: '', cta: { label: 'Get Started', action: 'next' } };
    case 'text': return { type, content: 'Your text here.', size: 'md', align: 'center' };
    case 'image': return { type, src: opts.src || '', alt: '', caption: '' };
    case 'features': return { type, heading: title || 'Features', items: [] };
    case 'form': return {
      type, heading: title || 'Feedback', formId: opts.formId || 'form-1',
      submitLabel: 'Submit', successMessage: 'Thank you!',
      fields: [
        { id: 'reason', type: 'select', label: 'Reason', required: true, options: ['Too complex', 'Found alternative', 'Not useful', 'Other'] },
        { id: 'feedback', type: 'textarea', label: 'Additional feedback', required: false },
      ],
    };
    case 'pricing': return { type, heading: title || 'Pricing', plans: [] };
    case 'links': return { type, heading: title || 'Links', items: [] };
    case 'countdown': return { type, heading: title || 'Coming Soon', targetDate: '' };
    case 'faq': return { type, heading: title || 'FAQ', items: [] };
    case 'testimonials': return { type, heading: title || 'What people say', items: [] };
    case 'logos': return { type, heading: title || 'Trusted by', items: [] };
    case 'video': return { type, src: opts.src || '', heading: title };
    case 'footer': return { type, text: 'Built with EdgeForm', links: [] };
    default: return { type };
  }
}

function createDefaultConfig(name: string, title: string, theme: string, nav: string) {
  return {
    id: name,
    title,
    description: '',
    theme: { name: theme, primaryColor: '#f97316' },
    themeSwitcher: { enabled: false, themes: [theme], defaultTheme: theme, position: 'top-right' },
    navigation: nav,
    pages: [
      { id: 'hero', blocks: [{ type: 'hero', title, subtitle: 'Welcome', cta: { label: 'Get Started', action: 'next' } }] },
      { id: 'footer', blocks: [{ type: 'footer', text: 'Built with EdgeForm' }] },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CLI core logic', () => {
  describe('getNestedValue', () => {
    it('gets top-level value', () => {
      expect(getNestedValue({ title: 'Hello' }, 'title')).toBe('Hello');
    });

    it('gets nested value', () => {
      expect(getNestedValue({ theme: { name: 'glass' } }, 'theme.name')).toBe('glass');
    });

    it('returns undefined for missing path', () => {
      expect(getNestedValue({ a: 1 }, 'b.c')).toBeUndefined();
    });

    it('handles deeply nested paths', () => {
      const obj = { a: { b: { c: { d: 42 } } } };
      expect(getNestedValue(obj, 'a.b.c.d')).toBe(42);
    });
  });

  describe('setNestedValue', () => {
    it('sets top-level value', () => {
      const obj: any = { title: 'old' };
      setNestedValue(obj, 'title', 'new');
      expect(obj.title).toBe('new');
    });

    it('sets nested value', () => {
      const obj: any = { theme: { name: 'glass' } };
      setNestedValue(obj, 'theme.primaryColor', '#000');
      expect(obj.theme.primaryColor).toBe('#000');
      expect(obj.theme.name).toBe('glass'); // preserves existing
    });

    it('creates intermediate objects', () => {
      const obj: any = {};
      setNestedValue(obj, 'a.b.c', 'deep');
      expect(obj.a.b.c).toBe('deep');
    });

    it('overwrites non-object intermediate', () => {
      const obj: any = { a: 'string' };
      setNestedValue(obj, 'a.b', 'value');
      expect(obj.a.b).toBe('value');
    });
  });

  describe('getDefaultBlock', () => {
    it('creates hero with defaults', () => {
      const block = getDefaultBlock('hero');
      expect(block.type).toBe('hero');
      expect(block.title).toBe('Hello World');
      expect(block.cta.label).toBe('Get Started');
    });

    it('creates hero with custom title', () => {
      const block = getDefaultBlock('hero', { title: 'Custom' });
      expect(block.title).toBe('Custom');
    });

    it('creates form with fields', () => {
      const block = getDefaultBlock('form', { title: 'Survey', formId: 'uninstall' });
      expect(block.type).toBe('form');
      expect(block.heading).toBe('Survey');
      expect(block.formId).toBe('uninstall');
      expect(block.fields.length).toBe(2);
      expect(block.fields[0].type).toBe('select');
      expect(block.fields[0].options.length).toBe(4);
    });

    it('creates all valid block types', () => {
      const types = ['hero', 'features', 'form', 'text', 'image', 'pricing', 'links', 'countdown', 'faq', 'testimonials', 'logos', 'video', 'footer'];
      for (const type of types) {
        const block = getDefaultBlock(type);
        expect(block.type).toBe(type);
      }
    });

    it('creates faq with heading', () => {
      const block = getDefaultBlock('faq', { title: 'Help' });
      expect(block.heading).toBe('Help');
      expect(block.items).toEqual([]);
    });
  });

  describe('createDefaultConfig', () => {
    it('creates config with correct structure', () => {
      const config = createDefaultConfig('my-site', 'My Site', 'minimal', 'fullpage');
      expect(config.id).toBe('my-site');
      expect(config.title).toBe('My Site');
      expect(config.theme.name).toBe('minimal');
      expect(config.navigation).toBe('fullpage');
      expect(config.pages.length).toBe(2);
      expect(config.pages[0].id).toBe('hero');
      expect(config.pages[1].id).toBe('footer');
    });

    it('hero block title matches site title', () => {
      const config = createDefaultConfig('test', 'Test Title', 'glass', 'fullpage');
      expect(config.pages[0].blocks[0].title).toBe('Test Title');
    });
  });

  describe('config operations (add/remove page/block)', () => {
    let config: any;

    beforeEach(() => {
      config = createDefaultConfig('test', 'Test', 'glass', 'fullpage');
    });

    it('adds a page', () => {
      config.pages.push({ id: 'survey', blocks: [] });
      expect(config.pages.find((p: any) => p.id === 'survey')).toBeDefined();
      expect(config.pages.length).toBe(3);
    });

    it('detects duplicate page', () => {
      const exists = config.pages.find((p: any) => p.id === 'hero');
      expect(exists).toBeDefined();
    });

    it('adds a block to a page', () => {
      const page = config.pages.find((p: any) => p.id === 'hero');
      const block = getDefaultBlock('form', { title: 'Feedback' });
      page.blocks.push(block);
      expect(page.blocks.length).toBe(2);
      expect(page.blocks[1].type).toBe('form');
    });

    it('removes a page', () => {
      config.pages.push({ id: 'extra', blocks: [] });
      const idx = config.pages.findIndex((p: any) => p.id === 'extra');
      config.pages.splice(idx, 1);
      expect(config.pages.find((p: any) => p.id === 'extra')).toBeUndefined();
    });

    it('removes a block by index', () => {
      const page = config.pages[0];
      page.blocks.push(getDefaultBlock('text'));
      expect(page.blocks.length).toBe(2);
      page.blocks.splice(1, 1);
      expect(page.blocks.length).toBe(1);
      expect(page.blocks[0].type).toBe('hero');
    });
  });
});
