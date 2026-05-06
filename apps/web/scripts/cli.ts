#!/usr/bin/env npx tsx
/**
 * EdgeForm CLI — manage site config from the command line.
 *
 * Usage:
 *   npx tsx scripts/cli.ts <command> [options]
 *
 * Commands:
 *   init                       Create a new site.config.json
 *   add-page <id>              Add a page
 *   add-block <pageId> <type>  Add a block to a page
 *   set <path> <value>         Set a config value (dot notation)
 *   get [path]                 Print config or a sub-path
 *   remove-page <id>           Remove a page
 *   remove-block <pageId> <i>  Remove block at index from page
 *   translate [--langs] [--provider] [--force]  Translate via remote API
 *   push [--url] [--token]     Upload config to remote KV
 *   pull [--url] [--token]     Download config from remote KV
 *   preview                    Open local dev server
 *   deploy                     Build + wrangler deploy
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CONFIG_FILE = resolve(process.cwd(), 'site.config.json');

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadConfig(): any {
  if (!existsSync(CONFIG_FILE)) {
    console.error(`❌ No site.config.json found. Run: npx tsx scripts/cli.ts init`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(config: any) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
  console.log(`✅ Saved ${CONFIG_FILE}`);
}

function getEnv(key: string): string {
  if (existsSync('.dev.vars')) {
    const vars = readFileSync('.dev.vars', 'utf-8');
    const match = vars.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (match) return match[1].trim();
  }
  return process.env[key] || '';
}

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

// ─── Commands ───────────────────────────────────────────────────────────────

function cmdInit(args: string[]) {
  if (existsSync(CONFIG_FILE) && !args.includes('--force')) {
    console.error('⚠️  site.config.json already exists. Use --force to overwrite.');
    process.exit(1);
  }

  const name = getArg(args, '--name') || 'my-site';
  const title = getArg(args, '--title') || 'My Site';
  const theme = getArg(args, '--theme') || 'glass';
  const nav = getArg(args, '--nav') || 'fullpage';

  const config = {
    id: name,
    title,
    description: '',
    theme: { name: theme, primaryColor: '#f97316' },
    themeSwitcher: { enabled: false, themes: [theme], defaultTheme: theme, position: 'top-right' },
    navigation: nav,
    pages: [
      { id: 'hero', blocks: [{ type: 'hero', title, subtitle: 'Welcome', cta: { label: 'Get Started', action: 'next' } }] },
      { id: 'footer', blocks: [{ type: 'footer', text: `Built with EdgeForm` }] },
    ],
  };

  saveConfig(config);
  console.log(`\n🚀 Created ${title} with theme "${theme}".`);
  console.log(`   Next: npx tsx scripts/cli.ts add-page form`);
}

function cmdAddPage(args: string[]) {
  const id = args[0];
  if (!id) { console.error('Usage: add-page <id>'); process.exit(1); }

  const config = loadConfig();
  if (config.pages.find((p: any) => p.id === id)) {
    console.error(`❌ Page "${id}" already exists.`);
    process.exit(1);
  }

  config.pages.push({ id, blocks: [] });
  saveConfig(config);
  console.log(`📄 Added page "${id}". Add blocks with: add-block ${id} hero`);
}

function cmdAddBlock(args: string[]) {
  const pageId = args[0];
  const type = args[1];
  if (!pageId || !type) { console.error('Usage: add-block <pageId> <type>'); process.exit(1); }

  const validTypes = ['hero', 'features', 'form', 'text', 'image', 'pricing', 'links', 'countdown', 'faq', 'testimonials', 'logos', 'video', 'footer'];
  if (!validTypes.includes(type)) {
    console.error(`❌ Invalid block type "${type}". Valid: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  const config = loadConfig();
  const page = config.pages.find((p: any) => p.id === pageId);
  if (!page) {
    console.error(`❌ Page "${pageId}" not found. Pages: ${config.pages.map((p: any) => p.id).join(', ')}`);
    process.exit(1);
  }

  const block = getDefaultBlock(type, args);
  page.blocks.push(block);
  saveConfig(config);
  console.log(`🧱 Added "${type}" block to page "${pageId}".`);
}

function cmdRemovePage(args: string[]) {
  const id = args[0];
  if (!id) { console.error('Usage: remove-page <id>'); process.exit(1); }
  const config = loadConfig();
  const idx = config.pages.findIndex((p: any) => p.id === id);
  if (idx === -1) { console.error(`❌ Page "${id}" not found.`); process.exit(1); }
  config.pages.splice(idx, 1);
  saveConfig(config);
  console.log(`🗑️  Removed page "${id}".`);
}

function cmdRemoveBlock(args: string[]) {
  const pageId = args[0];
  const idx = parseInt(args[1]);
  if (!pageId || isNaN(idx)) { console.error('Usage: remove-block <pageId> <index>'); process.exit(1); }
  const config = loadConfig();
  const page = config.pages.find((p: any) => p.id === pageId);
  if (!page) { console.error(`❌ Page "${pageId}" not found.`); process.exit(1); }
  if (idx < 0 || idx >= page.blocks.length) { console.error(`❌ Block index ${idx} out of range (0-${page.blocks.length - 1}).`); process.exit(1); }
  const removed = page.blocks.splice(idx, 1)[0];
  saveConfig(config);
  console.log(`🗑️  Removed block ${idx} (${removed.type}) from page "${pageId}".`);
}

function cmdSet(args: string[]) {
  const path = args[0];
  const value = args.slice(1).join(' ');
  if (!path || !value) { console.error('Usage: set <path> <value>'); process.exit(1); }

  const config = loadConfig();
  // Try to parse as JSON, otherwise treat as string
  let parsed: any;
  try { parsed = JSON.parse(value); } catch { parsed = value; }
  setNestedValue(config, path, parsed);
  saveConfig(config);
  console.log(`✏️  Set ${path} = ${JSON.stringify(parsed)}`);
}

function cmdGet(args: string[]) {
  const config = loadConfig();
  const path = args[0];
  const value = path ? getNestedValue(config, path) : config;
  if (value === undefined) { console.error(`❌ Path "${path}" not found.`); process.exit(1); }
  console.log(JSON.stringify(value, null, 2));
}

async function cmdTranslate(args: string[]) {
  const config = loadConfig();
  const langs = (getArg(args, '--langs') || '').split(',').filter(Boolean);
  const provider = getArg(args, '--provider') || 'microsoft-edge';
  const force = args.includes('--force');
  const url = getArg(args, '--url') || 'https://edgeform.better-li.workers.dev';
  const token = getArg(args, '--token') || getEnv('ADMIN_PASSWORD');

  if (!langs.length) { console.error('Usage: translate --langs zh,ja,ko [--provider microsoft-edge] [--force]'); process.exit(1); }
  if (!token) { console.error('❌ No token. Set ADMIN_PASSWORD in .dev.vars or use --token.'); process.exit(1); }

  // First push config so remote has latest texts
  console.log('📤 Pushing config to remote...');
  const pushRes = await fetch(`${url}/api/admin/config`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!pushRes.ok) { console.error(`❌ Push failed: ${pushRes.status}`); process.exit(1); }

  for (const lang of langs) {
    console.log(`🌐 Translating to ${lang} via ${provider}...`);
    const res = await fetch(`${url}/api/admin/translate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetLang: lang, provider, force, saveToConfig: true }),
    });
    const data = await res.json() as any;
    if (!res.ok) {
      console.error(`   ❌ ${lang}: ${data.error}`);
    } else {
      console.log(`   ✅ ${lang}: ${data.count} strings translated via ${data.provider}`);
      // Update local config with translations
      if (!config.i18n_map) config.i18n_map = {};
      config.i18n_map[lang] = data.translations;
    }
  }

  // Save updated config locally
  saveConfig(config);
  console.log('✅ Translations saved locally and remotely.');
}

async function cmdPush(args: string[]) {
  const config = loadConfig();
  const url = getArg(args, '--url') || 'https://edgeform.better-li.workers.dev';
  const token = getArg(args, '--token') || getEnv('ADMIN_PASSWORD');
  if (!token) { console.error('❌ No token. Set ADMIN_PASSWORD in .dev.vars or use --token.'); process.exit(1); }

  console.log(`📤 Pushing to ${url}...`);
  const res = await fetch(`${url}/api/admin/config`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Push failed: ${res.status} ${err}`);
    process.exit(1);
  }
  console.log('✅ Config pushed to remote KV.');
}

async function cmdPull(args: string[]) {
  const url = getArg(args, '--url') || 'https://edgeform.better-li.workers.dev';
  const token = getArg(args, '--token') || getEnv('ADMIN_PASSWORD');
  if (!token) { console.error('❌ No token. Set ADMIN_PASSWORD in .dev.vars or use --token.'); process.exit(1); }

  console.log(`📥 Pulling from ${url}...`);
  const res = await fetch(`${url}/api/admin/config`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) { console.error(`❌ Pull failed: ${res.status}`); process.exit(1); }
  const data = await res.json() as any;
  saveConfig(data.config);
  console.log('✅ Config pulled from remote KV.');
}

function cmdPreview() {
  console.log('🚀 Starting dev server...');
  execSync('npx astro dev --port 4321', { stdio: 'inherit' });
}

function cmdDeploy() {
  console.log('🚀 Building and deploying...');
  execSync('npx astro build && npx wrangler deploy', { stdio: 'inherit' });
}

// ─── Block Defaults ─────────────────────────────────────────────────────────

function getDefaultBlock(type: string, args: string[]): any {
  const title = getArg(args, '--title') || '';
  switch (type) {
    case 'hero': return { type, title: title || 'Hello World', subtitle: getArg(args, '--subtitle') || '', cta: { label: 'Get Started', action: 'next' } };
    case 'text': return { type, content: getArg(args, '--content') || 'Your text here.', size: 'md', align: 'center' };
    case 'image': return { type, src: getArg(args, '--src') || '', alt: getArg(args, '--alt') || '', caption: '' };
    case 'features': return { type, heading: title || 'Features', items: [] };
    case 'form': return {
      type, heading: title || 'Feedback', formId: getArg(args, '--form-id') || 'form-1',
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
    case 'video': return { type, src: getArg(args, '--src') || '', heading: title };
    case 'footer': return { type, text: 'Built with EdgeForm', links: [] };
    default: return { type };
  }
}

// ─── Arg Parsing ────────────────────────────────────────────────────────────

function getArg(args: string[], flag: string): string {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return '';
  return args[idx + 1];
}

// ─── Main ───────────────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

const commands: Record<string, (args: string[]) => void | Promise<void>> = {
  init: cmdInit,
  'add-page': cmdAddPage,
  'add-block': cmdAddBlock,
  'remove-page': cmdRemovePage,
  'remove-block': cmdRemoveBlock,
  set: cmdSet,
  get: cmdGet,
  translate: cmdTranslate,
  push: cmdPush,
  pull: cmdPull,
  preview: cmdPreview,
  deploy: cmdDeploy,
};

if (!command || command === '--help' || command === '-h') {
  console.log(`
EdgeForm CLI

Commands:
  init [--name] [--title] [--theme] [--nav]     Create site.config.json
  add-page <id>                                  Add a page
  add-block <pageId> <type> [--title]            Add a block to a page
  remove-page <id>                               Remove a page
  remove-block <pageId> <index>                  Remove block at index
  set <path> <value>                             Set config value (dot notation)
  get [path]                                     Print config or sub-path
  translate --langs zh,ja [--provider] [--force] Translate via API
  push [--url] [--token]                         Upload config to remote
  pull [--url] [--token]                         Download config from remote
  preview                                        Start dev server
  deploy                                         Build + deploy

Block types: hero, features, form, text, image, pricing, links, countdown, faq, testimonials, logos, video, footer

Examples:
  npx tsx scripts/cli.ts init --name "uninstall-survey" --title "We're sorry to see you go" --theme minimal
  npx tsx scripts/cli.ts add-block hero form --title "Quick survey"
  npx tsx scripts/cli.ts set theme.primaryColor "#3b82f6"
  npx tsx scripts/cli.ts translate --langs zh,ja,ko --provider microsoft-edge
  npx tsx scripts/cli.ts push
  npx tsx scripts/cli.ts deploy
`);
  process.exit(0);
}

const handler = commands[command];
if (!handler) {
  console.error(`❌ Unknown command: "${command}". Run with --help to see available commands.`);
  process.exit(1);
}

Promise.resolve(handler(args)).catch(e => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
