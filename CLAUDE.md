# EdgeForm

Edge-native micro-site engine on Cloudflare free tier.

## Project Structure

- `apps/web/` — Astro SSR, deployed as a single Cloudflare Worker
  - `src/themes/` — Pluggable theme registry (glass, terminal, brutal, minimal, retro, light, soft)
  - `src/components/renderer/SiteEngine.astro` — Core block-based rendering engine
  - `src/schemas/` — JSON site configs and starter templates
  - `src/pages/admin.astro` — Admin console (single-page app, login + auth gated)
  - `src/pages/api/` — Server API endpoints (submit, waitlist, img, admin/*)
  - `src/lib/` — Pure server modules (admin-auth, password, sessions, slug-map, rate-limit-core, image-detect, ua-parse, webhook-log, translate, i18n-extract, icons)
  - `migrations/` — D1 SQL migrations (0001 init → 0004 add meta_json)
  - `wrangler.toml` — Cloudflare Workers config (KV + D1 + Images bindings)
  - `tests/` — vitest tests (run with `npx vitest run`)
- `packages/shared/`
  - `src/types.ts` — TypeScript types
  - `src/schema.ts` — Zod runtime validation for SiteConfig
- `docs/` — Architecture docs

## Tech Stack

- **Runtime**: Astro v6 SSR + `@astrojs/cloudflare` adapter → Cloudflare **Workers** (not Pages)
- **KV namespaces** (single binding `FORM_KV`):
  - `site:{id}` — full site config blob (canonical)
  - `slug:{slug}` → `id` — mutable URL slug → immutable id mapping
  - `admin:password_hash` — PBKDF2 hash of admin password
  - `session:{token}` — `{ createdAt, lastUsedAt }`, sliding TTL
  - `hooklog:{id}` — last 20 webhook deliveries per site
  - `img:{uuid}.{ext}` — uploaded image blobs
  - `rl:{scope}:{ipHash}` — sliding-window rate limit hits
  - `rate:login:{ip}` — login attempt counter
- **D1**: form submissions + minimal `forms` table to satisfy a legacy FK constraint
- **Security**: PBKDF2 password hashing, server-side session tokens, KV-backed rate limiting, image magic-number validation, Cloudflare Turnstile (waitlist)
- **AI / Translation**: 12 providers including Cloudflare Workers AI

## Commands

- `npm install` — install all workspace dependencies
- `cd apps/web && npx astro dev` — start dev server (frontend + API)
- `cd apps/web && npx astro build` — build for production
- `cd apps/web && npx wrangler deploy` — deploy to Cloudflare Workers
- `cd apps/web && npx vitest run` — run the test suite
- `cd apps/web && npx tsx scripts/cli.ts <cmd>` — local CLI (init / push / pull / translate / deploy …)

## Architecture

- **All-in-one Worker**: SSR pages + server API endpoints + admin console all served from a single Cloudflare Worker.
- **Schema-first**: site config is a JSON document with `pages → blocks`, validated by Zod on every PUT to `/api/admin/config`.
- **Theme registry**: each theme is an independent module (`index.ts` + `style.css`), registered in `themes/registry.ts`. No engine changes when adding a theme.
- **SiteEngine**: thin orchestrator — navigation, theme switching, form submission, runtime translation. Zero theme code.
- **Block types** (13 live): hero, features, form, text, image, pricing, links, countdown, faq, testimonials, logos, video, footer.
- **Brand-accent token system**: `theme.primaryColor` → JS derives `--accent`, `--accent-dark`, `--accent-deep`, `--accent-light`, `--accent-soft`, `--accent-glow`, `--accent-rgb` and applies them to `:root`. All 7 themes consume `var(--accent, <fallback>)` so brand color flows through CTAs, gradients, glows, focus rings without per-theme work.
- **id vs slug**: `id` is the immutable primary key (KV `site:{id}`, D1 `site_id`, hooklog key). `slug` is the mutable URL component used at `/s/{slug}` — resolves via `slug:{slug}` mapping with a fallback to direct `site:{token}` for legacy sites. Old slugs stay as forever-aliases on rename.
- **internalName vs title vs brandName**: `internalName` is admin-only (dropdown label). `title` is the public browser tab / OG title. `theme.brandName` is the header text next to the logo. Each serves a different audience.
- **Submission metadata**: when `siteConfig.collectMeta` is true (default), `/api/submit` captures non-PII metadata (country, region, timezone, parsed UA, ASN, referer, accept-language, optional client tz/viewport) into `submissions.meta_json`. Per-site opt-out toggle in admin.

## Change Principles

- **Minimal & controlled changes only.** Do not make speculative "optimizations" or refactors. Every change must be directly requested or required to fix a specific bug.
- **Schema is the source of truth.** All site configs, block rendering, and form handling must follow the JSON config schema exactly. When writing configs to KV, match the structure that existing renderers and templates actually consume — read the renderer code first.
- **Verify before changing existing working code.** If something works in production, do not touch it unless explicitly asked. Especially: animation system, navigation, theme rendering, form submission flow.
- **Test the full path.** After any renderer or config change, verify that all block types render correctly — not just the one being changed. Check both main site and sub-sites. Run `npx vitest run` to catch logic regressions.
- **Multi-step forms support two formats:** (1) `steps[].fields` — fields nested in each step; (2) `steps[].fieldIds` + top-level `fields` — references by ID. Renderers must handle both.
- **Provide objective, neutral, rational feedback.** Don't agree just to be agreeable. If a request is misconceived, ambiguous, or has a better alternative, say so plainly with reasoning. When the user is correct, acknowledge it without flourish. When the user is wrong, push back. Avoid sycophancy, hedging, and unprompted praise. The goal is the right answer, not a comfortable one.
- **Pure modules where possible.** Anything that can be lifted out of `cloudflare:workers`-bound code into a pure module belongs in `src/lib/` so it can be unit-tested. Existing extractions: `password.ts`, `image-detect.ts`, `rate-limit-core.ts`, `ua-parse.ts`.

## Conventions

- TypeScript strict mode
- Node >= 22 (see `.node-version`)
- Shared types + Zod schemas in `packages/shared`
- D1 migrations in `apps/web/migrations/` — apply with `npx wrangler d1 execute edgeform-db --remote --file=migrations/000X_*.sql`
- Theme additions: create folder, register in `registry.ts`, import CSS — no engine changes
- API endpoints: `export const prerender = false`
- Static / SPA pages (`/admin`): `export const prerender = true`
- Env access: `import { env } from 'cloudflare:workers'`. The Astro v6 adapter exposes `ExecutionContext` at `locals.cfContext` (not the legacy `locals.runtime.ctx` — that path now throws).
- For background work (webhook delivery), wrap unawaited fetches in `ctx.waitUntil(...)` or the worker terminates and cancels them.
- Admin auth: send `Authorization: Bearer <session-token>`. Session tokens are 64-hex-char opaque ids (KV `session:{token}` with sliding 7-day TTL). The validator falls back to verifying the raw password against the KV hash for backward compat.
