# EdgeForm Master Plan v2

> Edge-native micro-site engine — zero cost, millisecond response, AI translation, multi-theme rendering.

---

## 1. Core Vision

EdgeForm is an **edge-native micro-site engine**. One JSON config, multiple themes, zero-cost deployment on Cloudflare.

**Core capabilities**:
- **Forms** — surveys, waitlists, contact forms, polls
- **Landing Pages** — fullpage scroll, product launches, event pages
- **Link-in-Bio** — personal pages, developer profiles
- **Lightweight Sites** — portfolios, resumes, small business homepages

**Key advantages**:
- **Zero cost** under 100K PV/month (entire Cloudflare free tier)
- **Millisecond-level response** via global edge distribution
- **AI-powered translation** with multi-provider support
- **Multi-theme rendering** — one schema, many visual styles, real-time switching
- **Block-based schema** — compose pages from typed building blocks

---

## 2. Edge-First Architecture

### 2.1 Tech Stack (Cloudflare Ecosystem)

| Layer | Service | Role | Free Tier Limits |
|-------|---------|------|------------------|
| **Frontend** | Cloudflare Pages (Astro) | SSR/SSG rendering, unlimited bandwidth | Unlimited bandwidth, 500 builds/month |
| **Compute** | Cloudflare Workers | API gateway, business logic | 100K requests/day |
| **Config Store** | Cloudflare KV | Read-heavy JSON Schema storage | **1,000 writes/day**, 100K reads/day |
| **Data Store** | Cloudflare D1 | Write-heavy submission storage | 5M rows read, **100K rows written/day**, 500MB max |
| **Security** | Cloudflare Turnstile | Silent bot detection | Unlimited |
| **AI** | Workers AI | LLM translation (Llama-3/Qwen) | **10,000 neurons/day** |

### 2.2 Architecture Overview

```
Control Plane (Config-time)
  Admin Console → Workers AI (translate) → KV (publish) / D1 (metadata)

Render Plane (Access-time)
  User → Pages (Astro) → KV (read config, <1ms) → Render multilingual UI

Data Plane (Submit-time)
  User → Workers API → Turnstile (verify) → D1 (persist submission)
```

> See `docs/architecture.html` for interactive Mermaid diagram.

### 2.3 Caching Strategy

KV reads are fast but not free. Add a **Cache API layer** in Workers:

- Cache key: `form:{form_id}:locale:{locale}`
- TTL: 1 hour (form config rarely changes)
- Purge on publish: when Admin publishes config, explicitly purge related cache keys
- This reduces KV reads significantly and adds an extra layer of edge caching

### 2.4 KV Write Budget Management

Free tier KV allows only **1,000 writes/day**. Mitigation:

- **Batch writes**: merge entire form config (schema + all i18n locales + theme) into a single KV PUT on publish
- **Draft in D1**: keep draft/editing state in D1, only write to KV on explicit "Publish"
- **Monitor usage**: expose remaining KV write quota in Admin console

---

## 3. Detailed Requirements

### 3.1 Control Plane: Admin Console

#### Authentication

| Phase | Approach |
|-------|----------|
| **Phase 0-1** | `ADMIN_PASSWORD` env var, single password |
| **Phase 2+** | Upgrade to: Turnstile on login endpoint + KV session token with TTL + rate limiting (max 5 attempts per IP per 15min via KV) |

#### Form Builder

- **Config-as-Code (DSL)**: define fields via UI or direct JSON editing
- **JSON Schema spec**: each form is a self-contained JSON document containing `schema`, `theme`, `i18n_map`
- **Publish workflow**: Draft (D1) → Preview → Publish (KV)

#### Translation Engine (Multi-Provider)

Translation adopts a **provider abstraction** inspired by kiss-translator / immersive-translate, supporting multiple backends:

| Provider | Type | Cost | Notes |
|----------|------|------|-------|
| **Google Translate API** (free endpoint) | Free | 0 | Unofficial endpoint, rate limited, best for high-volume basic translations |
| **Microsoft Translator** (free tier) | Free | 0 | 2M chars/month free via Azure Cognitive Services |
| **Cloudflare Workers AI** | Built-in | Free (10K neurons/day) | Llama-3/Qwen, best for context-aware translation |
| **Custom AI Key** (OpenAI / Claude / DeepSeek / Coze) | BYOK | User pays | User configures their own API key in Admin console |

**Provider priority** (configurable in Admin):
1. Free APIs first (Google/Microsoft) for bulk translation
2. Workers AI for polishing / context-aware refinement
3. Custom AI key as premium option for highest quality

**Implementation details**:
- Admin console exposes a "Translation Settings" panel to configure provider order and custom API keys
- Custom API keys are stored encrypted in KV (`translate_config:{form_id}`)
- **One-click translate**: sends all field labels/options through the configured provider chain
- **Free tier awareness**: display remaining quota per provider; auto-fallback to next provider when exhausted
- **Manual fallback**: always allow manual editing of i18n JSON
- **Batch optimization**: batch all fields in a single request to minimize API calls
- **Coze (扣子) integration**: support Coze bot API as a translation provider — user provides Bot ID + API key, system sends fields as a single prompt

### 3.2 Block-based Schema (Core Abstraction)

EdgeForm's schema is **block-based**: a site is an ordered list of pages, each page is an ordered list of blocks. Forms, landing pages, bio pages are all composed from the same block vocabulary.

#### Site Config Structure

```jsonc
{
  "id": "my-site",
  "title": "My Site",
  "theme": { "primaryColor": "#f97316", "logoUrl": "..." },
  "i18n_map": { ... },
  "pages": [
    {
      "id": "hero",
      "blocks": [
        { "type": "hero", "title": "...", "subtitle": "...", "cta": { "label": "...", "action": "next" } },
        { "type": "features", "items": [...] }
      ]
    },
    {
      "id": "signup",
      "blocks": [
        { "type": "form", "fields": [...], "submitEndpoint": "/api/waitlist" }
      ]
    }
  ],
  "navigation": "fullpage"  // "fullpage" | "scroll" | "tabs" | "none"
}
```

#### Block Types

| Block Type | Description | Phase |
|-----------|-------------|-------|
| `hero` | Large title + subtitle + optional CTA button + optional background | **Phase 0** |
| `features` | Grid/list of feature cards with icon/tag + text | **Phase 0** |
| `form` | Form fields (existing capability) — email, text, select, etc. | **Phase 0** |
| `footer` | Footer with links, copyright, branding | **Phase 0** |
| `text` | Rich text / markdown content block | Phase 1 |
| `image` | Single image or image gallery | Phase 1 |
| `pricing` | Pricing table with plans and CTA | Phase 1 |
| `countdown` | Countdown timer to a target date | Phase 1 |
| `links` | Link-in-bio style link list | Phase 1 |
| `timeline` | Chronological timeline (for resumes, changelogs) | Phase 2 |
| `grid` | Card grid (for portfolios, team members) | Phase 2 |
| `embed` | Embed external content (YouTube, CodePen, etc.) | Phase 2 |
| `poll` | Live poll with real-time results from edge | Phase 2 |
| `code` | Code snippet with syntax highlighting | Phase 2 |

#### Navigation Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `fullpage` | One page per screen, scroll/swipe to navigate | Landing pages, presentations |
| `scroll` | All pages stacked, smooth scroll | Long-form sites, portfolios |
| `tabs` | Tab bar navigation between pages | Multi-section apps |
| `none` | Single page, no navigation | Simple forms, bio pages |

### 3.3 Rendering Engine

#### Schema-First Rendering

The SiteEngine reads the JSON config from KV (via Cache API) and renders blocks through the active theme. Each theme implements all block types with its own visual language.

#### Themes

| Theme | Style | Tone |
|-------|-------|------|
| **Glass** | Glassmorphism, gradients, blur | Modern SaaS, Vercel/Linear |
| **Terminal** | Dark terminal, monospace, CLI prompts | Developer tools, geek appeal |
| **Brutal** | Black & white, thick borders, big type | Bold brands, design-forward |
| **Minimal** | Max whitespace, subtle, vertically centered | Clean, high-conversion |
| **Retro** | Green CRT, scanlines, pixel aesthetic | Fun, nostalgic, game-adjacent |

> Users switch themes in real-time via the theme pill bar. URL param `?theme=xxx` is shareable.

#### White-labeling

MVP scope (hard boundary):
- Custom logo URL
- Single primary color injection (CSS custom property)

**Out of MVP scope**: custom CSS, custom domains, custom fonts.

### 3.4 Storage Spec

#### KV Structure

```
Key:   site_config:{site_id}
Value: {
  pages: [{ id, blocks: [...] }],
  theme: { primaryColor, logoUrl },
  navigation: "fullpage" | "scroll" | "tabs" | "none",
  i18n_map: { en: {...}, zh: {...}, ja: {...} },
  version: number,
  updatedAt: ISO8601
}
```

#### D1 Schema

```sql
-- Form metadata
CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft',  -- draft | published | archived
  config_json TEXT,             -- draft config (full JSON)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Submissions
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  locale TEXT DEFAULT 'en',
  ip_hash TEXT,
  user_agent TEXT,
  latency_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (form_id) REFERENCES forms(id)
);

-- Rate limiting index
CREATE INDEX idx_submissions_ip_form ON submissions(ip_hash, form_id, created_at);
```

### 3.5 Security

#### Bot Protection
- Turnstile on all submit endpoints (silent challenge)

#### Anti-Spam / Rate Limiting
- Worker-level rate limit: KV key `ratelimit:{ip_hash}:{form_id}` with 60s TTL
- Reject duplicate submissions from same IP within window
- D1 index on `(ip_hash, form_id, created_at)` for query-time dedup

#### Privacy / GDPR
- `ip_hash` uses SHA-256 with daily rotating salt — non-reversible
- Document in privacy policy: hashed IP is stored for spam prevention, auto-deleted after 90 days
- Provide data export and deletion API for GDPR compliance (Phase 2)

### 3.6 Data Export

| Phase | Capability |
|-------|-----------|
| **Phase 2** | CSV export from Admin console (client-side generation from D1 query) |
| **Phase 3** | REST API for programmatic access, webhook on new submission |

---

## 4. Roadmap

### Phase 0: Waitlist as Landing Demo

**Goal**: Validate block-based rendering engine + edge submission pipeline + collect early adopters.

**Deliverables**:
- **SiteEngine**: block-based renderer with fullpage scroll navigation
- **4 block types**: hero, features, form, footer
- **5 themes**: Glass, Terminal, Brutal, Minimal, Retro — real-time switching
- Waitlist email submission → D1 storage via Workers
- Display submission latency (e.g., "Submitted in 15ms")
- Turnstile integration for bot protection
- Open Graph meta tags for social sharing
- **The waitlist page IS the product demo** — visitors experience multi-theme rendering firsthand

**Success metric**: collect 200+ emails.

### Phase 1: Core Engine MVP

**Deliverables**:
- D1 table structure (forms + submissions)
- Astro-based form renderer (Modern mode only)
- Workers submit gateway + Turnstile verification
- KV-based config reading with Cache API
- Rate limiting on submissions

### Phase 2: Admin Console + AI

**Deliverables**:
- Stateless Admin page with upgraded auth (session tokens + rate limiting)
- Form builder UI (JSON Schema editor)
- Workers AI translation integration with quota awareness
- Publish workflow: D1 draft → KV publish
- CSV data export
- GDPR: data export and deletion endpoints

### Phase 3: Templates + Distribution

**Deliverables**:
- "Deploy to Cloudflare" one-click template
- Terminal mode + Code mode interactions
- Multiple UI theme presets
- REST API for submissions
- Webhook notifications

---

## 5. Project Structure

```
edgeform/
├── apps/
│   └── web/                # Astro frontend (Cloudflare Pages)
│       ├── src/
│       │   ├── layouts/
│       │   ├── pages/
│       │   ├── components/
│       │   └── styles/
│       ├── public/
│       ├── astro.config.mjs
│       └── package.json
├── workers/
│   └── api/                # Cloudflare Workers (API gateway)
│       ├── src/
│       │   ├── index.ts
│       │   └── routes/
│       ├── schema.sql
│       ├── wrangler.toml
│       └── package.json
├── packages/
│   └── shared/             # Shared types and utilities
│       ├── src/
│       │   └── types.ts
│       └── package.json
├── docs/
│   ├── MASTER_PLAN.md
│   └── architecture.html
├── package.json            # Workspace root
├── CLAUDE.md
└── .gitignore
```

---

## 6. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| KV write limit (1K/day) | Can't publish frequently | Batch writes, draft in D1 |
| Workers AI quota (10K neurons/day) | Translation fails mid-form | Manual i18n fallback, quota display |
| Single-password auth | Security breach | Upgrade in Phase 2, Turnstile on login |
| D1 500MB limit | Storage full | Monitor size, archive old submissions |
| GDPR compliance | Legal risk | Hashed IP, deletion API, privacy policy |
