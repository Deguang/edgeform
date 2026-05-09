/**
 * Runtime validation for SiteConfig (Zod).
 *
 * Philosophy: validate the shape we care about (top-level fields, page/block
 * structure) without freezing the schema. Each block type carries arbitrary
 * extra fields that themes rely on, so block bodies use .passthrough() —
 * future block additions don't break existing configs.
 */

import { z } from 'zod';

// ── Form fields ──────────────────────────────────────────────────────────────

const FieldType = z.enum([
  'text', 'email', 'select', 'textarea', 'number', 'radio', 'checkbox', 'url', 'tel', 'date',
]);

const FormField = z.object({
  id: z.string().min(1),
  type: FieldType,
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  width: z.enum(['full', 'half']).optional(),
}).passthrough();

const FormStep = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  label: z.string().optional(),
  fields: z.array(FormField).optional(),
  fieldIds: z.array(z.string()).optional(),
}).passthrough();

// ── Block ────────────────────────────────────────────────────────────────────

const KnownBlockTypes = [
  'hero', 'features', 'form', 'text', 'image', 'pricing', 'links',
  'countdown', 'faq', 'testimonials', 'logos', 'video', 'footer',
] as const;

const Block = z.object({
  type: z.string().min(1),
  pageWidth: z.enum(['auto', 'narrow', 'normal', 'wide', 'full']).optional(),
  spacing: z.enum(['normal', 'compact', 'loose']).optional(),
  animation: z.object({
    type: z.string(),
  }).passthrough().optional(),
  // Form-specific (validated when type === 'form')
  fields: z.array(FormField).optional(),
  steps: z.array(FormStep).optional(),
}).passthrough();

// ── Page ─────────────────────────────────────────────────────────────────────

const Page = z.object({
  id: z.string().min(1),
  blocks: z.array(Block),
}).passthrough();

// ── Theme ────────────────────────────────────────────────────────────────────

const Theme = z.object({
  name: z.string().min(1),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  brandName: z.string().optional(),
  logoUrl: z.string().optional(),
}).passthrough();

const ThemeSwitcher = z.object({
  enabled: z.boolean(),
  themes: z.array(z.string()).optional(),
  defaultTheme: z.string().optional(),
  position: z.enum(['top-right', 'top-left', 'bottom-right', 'bottom-left']).optional(),
}).passthrough();

// ── Webhook / translation ────────────────────────────────────────────────────

const Webhook = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.enum(['submission', 'waitlist'])).optional(),
}).passthrough();

const TranslateProvider = z.object({
  provider: z.string(),
  enabled: z.boolean().optional(),
  apiKey: z.string().optional(),
  endpoint: z.string().optional(),
  botId: z.string().optional(),
  model: z.string().optional(),
}).passthrough();

// ── Analytics ────────────────────────────────────────────────────────────────

const Analytics = z.object({
  // Google Analytics 4 Measurement ID. Format: G-XXXXXXXXXX.
  // Empty / missing means GA is disabled for this site.
  ga4Id: z.string().regex(/^G-[A-Z0-9]+$/i, 'Must look like G-XXXXXXXXXX').optional(),
}).passthrough();

const TranslateSettings = z.object({
  providers: z.array(TranslateProvider).optional(),
  sourceLang: z.string().optional(),
  targetLangs: z.array(z.string()).optional(),
}).passthrough();

// ── SiteConfig (the root) ────────────────────────────────────────────────────

export const SiteConfigSchema = z.object({
  // Immutable primary key. Used as the KV key (site:{id}), the D1 site_id,
  // and the hooklog key. Never changes after site creation.
  id: z.string().optional(),
  // Mutable URL slug. The site is reachable at /s/{slug}. Free to change;
  // a `slug:{slug}` → id mapping in KV resolves the indirection. Old slugs
  // remain as forever-aliases so external links don't break.
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only').max(64).optional(),
  // Short label shown only inside the admin dropdown / site list. Lets users
  // give a concise internal name (e.g. "Uninstall Survey") without affecting
  // the public-facing browser title.
  internalName: z.string().max(120).optional(),
  title: z.string(),
  description: z.string().optional(),
  theme: Theme,
  themeSwitcher: ThemeSwitcher.optional(),
  navigation: z.enum(['fullpage', 'scroll', 'none']).optional(),
  showPageDots: z.boolean().optional(),
  favicon: z.string().optional(),
  collectMeta: z.boolean().optional(),
  pages: z.array(Page),
  webhook: Webhook.optional(),
  analytics: Analytics.optional(),
  translate_settings: TranslateSettings.optional(),
  i18n_map: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  version: z.number().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

export type SiteConfigParsed = z.infer<typeof SiteConfigSchema>;

/**
 * Validate a SiteConfig. Returns either the parsed config or a list of human
 * error messages (from Zod's `path.join('.') + message` formatting).
 */
export function validateSiteConfig(input: unknown):
  | { ok: true; data: SiteConfigParsed }
  | { ok: false; errors: string[] }
{
  const result = SiteConfigSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors = result.error.issues.map(i => {
    const path = i.path.join('.') || '<root>';
    return `${path}: ${i.message}`;
  });
  return { ok: false, errors };
}

export { KnownBlockTypes };
