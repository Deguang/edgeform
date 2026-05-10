# EdgeForm

Edge-native micro-site engine — one JSON, seven themes, zero cost.

Built entirely on Cloudflare's free tier: Pages + D1 + KV.

**Live demo:** [page.lideguang.com](https://page.lideguang.com/) · **Source:** [github.com/Deguang/edgeform](https://github.com/Deguang/edgeform)

[中文文档](./README_CN.md)

## What is EdgeForm?

EdgeForm turns a single JSON config into a fully themed, multilingual micro-site deployed globally at the edge.

- **Forms** — surveys, waitlists, contact forms with multi-step support
- **Landing pages** — fullpage scroll, product launches, pricing pages
- **Link-in-bio** — personal pages, developer profiles
- **Lightweight sites** — portfolios, small business homepages

### Key Features

- **7 built-in themes** — Glass, Terminal, Brutal, Minimal, Retro, Light, Soft
- **13 block types** — Hero, Features, Form, Text, Image, Pricing, Links, Countdown, FAQ, Testimonials, Logos, Video, Footer
- **Real-time theme switching** — visitors can try all themes, URL `?theme=xxx` is shareable
- **Custom branding** — primary color picker, logo URL, per-block backgrounds
- **Block-level layout** — configurable page width (narrow/normal/wide/full) and spacing per block
- **Fullpage scroll navigation** — smooth page transitions with animation support (6 types)
- **Zero cost** — runs entirely on Cloudflare free tier (up to 100K PV/month)
- **Multi-site support** — host unlimited sub-sites under `/s/{id}` from a single deployment
- **Visitor language switching** — runtime `t()` translates blocks on the fly via a pill picker; URL `?lang=xx` shareable
- **AI translation** — 12 providers (Google, Microsoft, MS Edge free, MyMemory, DeepLX, OpenAI, Claude, DeepSeek, GLM, OpenAI-compatible, Coze, Workers AI), 56 target languages including zh-CN/zh-TW/zh-HK
- **Webhook notifications** — POST to Slack/Zapier/etc on form submission or waitlist signup
- **Image upload** — upload images directly via admin, stored in Cloudflare KV
- **Admin console** — dark/light mode, multi-language (EN/中文/日本語/ES), visual + JSON editors
- **All-in-one deploy** — single `wrangler deploy`, no separate Workers needed

## Project Structure

```
edgeform/
├── apps/web/                  # Astro SSR → Cloudflare Pages (all-in-one)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro    # Site renderer
│   │   │   ├── admin.astro    # Admin console (dark/light, i18n)
│   │   │   └── api/           # Server API endpoints
│   │   │       ├── health.ts
│   │   │       ├── submit.ts       # POST — multi-field form submission
│   │   │       ├── waitlist/
│   │   │       │   ├── index.ts    # POST — submit email
│   │   │       │   └── count.ts    # GET — public count
│   │   │       ├── img/
│   │   │       │   └── [id].ts     # GET — serve uploaded images
│   │   │       └── admin/
│   │   │           ├── login.ts    # POST — verify password
│   │   │           ├── config.ts   # GET/PUT/DELETE — site config
│   │   │           ├── stats.ts    # GET — dashboard stats
│   │   │           ├── waitlist.ts # GET — paginated list
│   │   │           ├── submissions.ts # GET — form submissions
│   │   │           ├── export.ts   # GET — CSV download
│   │   │           ├── templates.ts # GET — template configs
│   │   │           ├── translate.ts # POST — AI translation
│   │   │           └── upload.ts   # POST — image upload
│   │   ├── components/
│   │   │   └── renderer/
│   │   │       └── SiteEngine.astro  # Core rendering engine
│   │   ├── themes/            # Theme registry (pluggable)
│   │   │   ├── registry.ts
│   │   │   ├── types.ts
│   │   │   ├── shared-renderers.ts  # Shared block HTML generators
│   │   │   ├── shared-blocks.css    # Shared block CSS
│   │   │   ├── glass/         # Frosted glass, warm orange
│   │   │   ├── terminal/      # Green-on-black hacker
│   │   │   ├── brutal/        # Anti-design, loud colors
│   │   │   ├── minimal/       # Swiss design, ultra-clean
│   │   │   ├── retro/         # CRT phosphor green
│   │   │   ├── light/         # Clean SaaS, blue accent
│   │   │   └── soft/          # Warm Notion-inspired
│   │   ├── lib/
│   │   │   ├── i18n-extract.ts  # Text extraction for translation
│   │   │   ├── icons.ts         # Unified Lucide SVG icon set
│   │   │   └── translate.ts     # Multi-provider translation
│   │   └── layouts/
│   │       └── Base.astro     # Base layout with SEO
│   ├── migrations/
│   │   ├── 0001_init.sql      # D1 schema (forms, submissions, waitlist)
│   │   ├── 0002_add_site_id.sql      # Multi-site columns
│   │   └── 0003_migrate_waitlist.sql # Merge waitlist into submissions
│   ├── wrangler.toml          # Cloudflare config (D1/KV bindings)
│   └── public/
├── packages/shared/           # Shared TypeScript types
│   └── src/types.ts
└── docs/
```

## Block Types

| Block | Description | Key Options |
|-------|-------------|-------------|
| **Hero** | Title, subtitle, CTA | Background (gradient/image/particles), animation |
| **Features** | Card grid with tags | Columns (2-4), layout (grid/list) |
| **Form** | Multi-field, multi-step | 10 field types, validation, form ID tracking |
| **Text** | Rich text paragraph | Size (sm/md/lg), alignment |
| **Image** | Image with caption | Upload or URL, fit mode, rounded |
| **Pricing** | Pricing cards | Plans with features, highlighted flag, CTA |
| **Links** | Link-in-bio list | Avatar, icon, description, style variants |
| **Countdown** | Live timer | Custom labels, expired message |
| **FAQ** | Accordion Q&A | Click to expand/collapse |
| **Testimonials** | Customer quotes | Avatar, author, company, role |
| **Logos** | Brand wall | Grayscale → color on hover, optional links |
| **Video** | Embedded video | YouTube, Bilibili, MP4, autoplay |
| **Footer** | Footer with links | Social links, custom text |

All blocks support: animation (6 types), page width override, spacing control, per-block background.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

```bash
npm install -g wrangler
```

## Local Development

### 1. Clone and install

```bash
git clone <repo-url> edgeform
cd edgeform
npm install
```

### 2. Configure local secrets

```bash
cd apps/web
cat > .dev.vars << 'EOF'
ADMIN_PASSWORD=your-secret-password
TURNSTILE_SECRET=
EOF
```

### 3. Create local D1 database

```bash
npx wrangler d1 execute edgeform-db --local --file=migrations/0001_init.sql
npx wrangler d1 execute edgeform-db --local --file=migrations/0002_add_site_id.sql
npx wrangler d1 execute edgeform-db --local --file=migrations/0003_migrate_waitlist.sql
```

### 4. Start dev server

```bash
npx astro dev --port 4321
```

- Landing page: http://localhost:4321
- Admin console: http://localhost:4321/admin
- API endpoints: http://localhost:4321/api/*

Everything runs in a single process — no separate Workers server needed.

## Deploy to Cloudflare

One command from `apps/web/`:

```bash
cd apps/web
npm run deploy
```

The script automatically:
1. Logs into Cloudflare (if needed)
2. Creates D1 database and KV namespace (if not exist)
3. Runs database migration
4. Builds the project
5. Deploys to Cloudflare Workers
6. Prompts you to set `ADMIN_PASSWORD`

Your site will be live at `https://edgeform.<your-subdomain>.workers.dev`.

### Manual deploy (step by step)

If you prefer manual control, see [deploy script](apps/web/scripts/deploy.sh) for the individual commands.

## Admin Console

Access at `/admin` on your deployed site (or http://localhost:4321/admin locally).

### Features

- **Dark/Light mode** — toggle in header, persisted in localStorage
- **Multi-language** — EN, 中文, 日本語, ES — switch in header
- **Visual editor** — drag-reorder pages/blocks, rich form per block type
- **JSON editor** — direct JSON editing with validation
- **Template picker** — 6 built-in templates as starting points
- **Theme picker** — visual cards with mini preview for all 7 themes
- **Branding** — primary color picker with preview, logo upload
- **Webhook config** — URL + secret for form/waitlist notifications
- **Image upload** — upload images directly, stored in KV and served via CDN
- **Waitlist tab** — paginated table, CSV export
- **Submissions tab** — form-filtered, dynamic columns, latency tracking
- **Translations tab** — provider config, language management, translation table

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Health check |
| `POST` | `/api/waitlist` | No | Submit email to waitlist |
| `GET` | `/api/waitlist/count` | No | Get total waitlist count |
| `POST` | `/api/submit` | No | Submit multi-field form |
| `GET` | `/api/img/:id` | No | Serve uploaded image |
| `POST` | `/api/admin/login` | Yes | Verify admin password |
| `POST` | `/api/admin/password` | Yes | Change admin password |
| `GET` | `/api/admin/config?list=1` | Yes | List all sites |
| `GET` | `/api/admin/config?siteId=` | Yes | Read site config (omit for main) |
| `PUT` | `/api/admin/config` | Yes | Save site config (body: `{ config, siteId }`) |
| `DELETE` | `/api/admin/config?siteId=` | Yes | Delete sub-site (or reset main) |
| `GET` | `/api/admin/stats?siteId=` | Yes | Dashboard statistics |
| `GET` | `/api/admin/waitlist` | Yes | List waitlist entries |
| `GET` | `/api/admin/submissions?siteId=` | Yes | List form submissions |
| `GET` | `/api/admin/export?siteId=` | Yes | CSV export (waitlist/submissions) |
| `GET` | `/api/admin/templates` | Yes | List/load templates |
| `POST` | `/api/admin/translate` | Yes | Batch translate strings (body includes `siteId`) |
| `POST` | `/api/admin/upload` | Yes | Upload image (max 2MB) |

Auth: `Authorization: Bearer <ADMIN_PASSWORD>` header or `?token=<ADMIN_PASSWORD>` query param.

## Adding a New Theme

1. Create `apps/web/src/themes/yourtheme/index.ts`:

```ts
import type { ThemeDefinition } from '../types';
import { renderText, renderImage, renderPricing, renderLinks, renderCountdown,
         renderFAQ, renderTestimonials, renderLogos, renderVideo,
         renderFormFields, renderMultiStepForm } from '../shared-renderers';

export const yourtheme: ThemeDefinition = {
  name: 'yourtheme',
  label: 'Your Theme',
  cssClass: 'ef-t-yourtheme',
  blocks: {
    hero: (b) => `<h1>${b.title}</h1>...`,
    features: (b) => `...`,
    form: (b) => `...`,
    footer: (b) => `...`,
    text: (b) => renderText(b),
    image: (b) => renderImage(b),
    pricing: (b) => renderPricing(b, 'y'),
    links: (b) => renderLinks(b),
    countdown: (b) => renderCountdown(b),
    faq: (b) => renderFAQ(b),
    testimonials: (b) => renderTestimonials(b),
    logos: (b) => renderLogos(b),
    video: (b) => renderVideo(b),
  },
};
```

2. Create `apps/web/src/themes/yourtheme/style.css` with `.ef-t-yourtheme` scoped styles.

3. Register in `apps/web/src/themes/registry.ts`:

```ts
import { yourtheme } from './yourtheme/index';
// Add to allThemes array
```

4. Import CSS in `SiteEngine.astro`:

```html
<style is:global>@import '../../themes/yourtheme/style.css';</style>
```

No engine code changes needed.

## Schema Example

```json
{
  "id": "my-site",
  "title": "My Site",
  "theme": { "name": "glass", "primaryColor": "#f97316", "logoUrl": "/api/img/abc.png" },
  "themeSwitcher": {
    "enabled": true,
    "themes": ["glass", "minimal", "light"],
    "defaultTheme": "glass",
    "position": "top-right"
  },
  "navigation": "fullpage",
  "webhook": { "url": "https://hooks.slack.com/...", "secret": "my-secret" },
  "pages": [
    {
      "id": "hero",
      "blocks": [
        {
          "type": "hero",
          "title": "Hello World",
          "subtitle": "Built with EdgeForm",
          "cta": { "label": "Get Started", "action": "next" },
          "animation": { "type": "fade-up" }
        }
      ]
    },
    {
      "id": "features",
      "blocks": [
        {
          "type": "features",
          "heading": "Why EdgeForm?",
          "items": [
            { "title": "Fast", "description": "Edge-deployed globally", "tag": "NEW", "tagColor": "green" },
            { "title": "Free", "description": "Cloudflare free tier", "tag": "FREE", "tagColor": "blue" }
          ],
          "pageWidth": "wide"
        }
      ]
    },
    {
      "id": "faq",
      "blocks": [
        {
          "type": "faq",
          "heading": "FAQ",
          "items": [
            { "question": "Is it really free?", "answer": "Yes, runs on Cloudflare's free tier." }
          ]
        }
      ]
    }
  ]
}
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Astro SSR + Cloudflare Workers | All-in-one: static pages + server API |
| Database | Cloudflare D1 (SQLite) | Submission + waitlist storage |
| Config | Cloudflare KV | Site config + image storage |
| Security | Cloudflare Turnstile | Bot protection |
| Translation | 12 providers | Google, Microsoft, MS Edge (free), MyMemory, DeepLX, OpenAI, Claude, DeepSeek, GLM, OpenAI-compat, Coze, Workers AI |

## License

MIT
