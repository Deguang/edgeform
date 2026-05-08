import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// Import templates statically (they're JSON, bundled at build time)
import productLaunch from '../../../schemas/templates/product-launch.json';
import personalBio from '../../../schemas/templates/personal-bio.json';
import survey from '../../../schemas/templates/survey.json';
import portfolio from '../../../schemas/templates/portfolio.json';
import business from '../../../schemas/templates/business.json';
import waitlistTpl from '../../../schemas/templates/waitlist.json';
import feedback from '../../../schemas/templates/feedback.json';
import defaultShowcase from '../../../schemas/waitlist.json';

const templates: Record<string, { name: string; description: string; config: any }> = {
  'default': { name: 'EdgeForm Showcase', description: 'Full showcase with all 9 block types and theme switcher', config: defaultShowcase },
  'product-launch': { name: 'Prism AI Launch', description: 'SaaS product launch with countdown, pricing, and early access', config: productLaunch },
  'personal-bio': { name: 'Designer Bio', description: 'Creative professional link-in-bio with portfolio links', config: personalBio },
  'survey': { name: 'NPS Survey', description: 'Multi-step customer satisfaction survey with NPS scoring', config: survey },
  'portfolio': { name: 'Photo Studio', description: 'Photography studio portfolio with booking form', config: portfolio },
  'business': { name: 'Dev Agency', description: 'Bold dev agency homepage with services and project intake', config: business },
  'waitlist': { name: 'Startup Waitlist', description: 'Hacker-style coming soon page with waitlist signup', config: waitlistTpl },
  'feedback': { name: 'Bug Bounty', description: 'Bug report portal with severity guide and bounty rewards', config: feedback },
};

import { getAuth, validateToken } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const templateId = url.searchParams.get('id');

  // Return specific template config
  if (templateId) {
    const tpl = templates[templateId];
    if (!tpl) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ template: tpl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return template list (without full configs to keep response small)
  const list = Object.entries(templates).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
    theme: t.config.theme?.name || 'glass',
    primaryColor: t.config.theme?.primaryColor || null,
    pages: t.config.pages?.length || 0,
    // Each page summarised as its block types — renders a schematic preview client-side.
    pageBlocks: (t.config.pages || []).map((p: any) =>
      (p.blocks || []).map((b: any) => b.type)
    ),
  }));

  return new Response(JSON.stringify({ templates: list }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
