# EdgeForm

Edge-native micro-site engine on Cloudflare free tier.

## Project Structure

- `apps/web/` — Astro SSR, all-in-one Cloudflare Pages deployment
  - `src/themes/` — Pluggable theme registry (glass, terminal, brutal, minimal, retro, light, soft)
  - `src/components/renderer/SiteEngine.astro` — Core block-based rendering engine
  - `src/schemas/` — JSON site configs
  - `src/pages/admin.astro` — Admin console
  - `src/pages/api/` — Server API endpoints (waitlist, admin)
  - `migrations/` — D1 SQL migrations
  - `wrangler.toml` — Cloudflare Pages config (D1/KV bindings)
- `packages/shared/` — Shared TypeScript types (Block, SiteConfig, ThemeDefinition)
- `docs/` — Architecture docs and Master Plan

## Tech Stack

- **Runtime**: Astro SSR + `@astrojs/cloudflare` adapter → Cloudflare Pages
- **Storage**: Cloudflare KV (config) + D1 (submissions)
- **Security**: Cloudflare Turnstile
- **AI**: Cloudflare Workers AI (Phase 2)

## Commands

- `npm install` — install all workspace dependencies
- `cd apps/web && npx astro dev` — start dev server (frontend + API)
- `cd apps/web && npx astro build` — build for production
- `cd apps/web && wrangler deploy` — deploy to Cloudflare

## Architecture

- **All-in-one**: static pages (prerender=true) + server API endpoints in a single Cloudflare Pages deployment
- **Schema-first**: site config is a JSON document with pages → blocks
- **Theme registry**: each theme is an independent module (index.ts + style.css), registered in registry.ts
- **SiteEngine**: thin orchestrator — navigation, theme switching, form submission. Zero theme code.
- **Block types**: hero, features, form, footer (Phase 0). text, image, pricing, countdown, links (Phase 1+)

## Change Principles

- **Minimal & controlled changes only.** Do not make speculative "optimizations" or refactors. Every change must be directly requested or required to fix a specific bug.
- **Schema is the source of truth.** All site configs, block rendering, and form handling must follow the JSON config schema exactly. When writing configs to KV, match the structure that existing renderers and templates actually consume — read the renderer code first.
- **Verify before changing existing working code.** If something works in production, do not touch it unless explicitly asked. Especially: animation system, navigation, theme rendering, form submission flow.
- **Test the full path.** After any renderer or config change, verify that all block types render correctly — not just the one being changed. Check both main site and sub-sites.
- **Multi-step forms support two formats:** (1) `steps[].fields` — fields nested in each step; (2) `steps[].fieldIds` + top-level `fields` — references by ID. Renderers must handle both.

## Conventions

- TypeScript strict mode
- Node >= 22 (see .node-version)
- Shared types in `packages/shared`
- D1 migrations in `apps/web/migrations/`
- Theme additions: create folder, register, import CSS — no engine changes
- Static pages use `export const prerender = true`
- API endpoints use `export const prerender = false`
- Env bindings accessed via `(locals as any).runtime.env as Env`
