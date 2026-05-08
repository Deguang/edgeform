import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

/**
 * /s/[id]/llms.txt — per-sub-site GEO surface.
 * Generates a Markdown digest of the sub-site so LLM crawlers can answer
 * questions about it. Spec: https://llmstxt.org/.
 */
export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) return new Response('not found', { status: 404 });

  let cfg: any;
  try {
    const raw = await env.FORM_KV.get(`site:${id}`, 'text');
    if (!raw) return new Response('not found', { status: 404 });
    cfg = JSON.parse(raw);
  } catch {
    return new Response('not found', { status: 404 });
  }

  const title = cfg.title || id;
  const description = cfg.description || '';
  const url = `https://edgeform.better-li.workers.dev/s/${id}`;
  const langs = Object.keys(cfg.i18n_map || {});

  // Pull human-readable text from each block type that carries copy.
  function blockText(b: any): string[] {
    const out: string[] = [];
    switch (b.type) {
      case 'hero':
        if (b.title) out.push(`### ${b.title}`);
        if (b.subtitle) out.push(b.subtitle);
        if (b.description) out.push(b.description);
        break;
      case 'features':
        if (b.heading) out.push(`### ${b.heading}`);
        for (const it of (b.items || [])) {
          out.push(`- **${it.title || ''}** — ${it.description || ''}`);
        }
        break;
      case 'text':
        if (b.content) out.push(b.content);
        break;
      case 'pricing':
        if (b.heading) out.push(`### ${b.heading}`);
        if (b.description) out.push(b.description);
        for (const p of (b.plans || [])) {
          out.push(`- **${p.name}** ${p.price || ''}${p.period ? '/' + p.period : ''} — ${(p.features || []).join(', ')}`);
        }
        break;
      case 'faq':
        if (b.heading) out.push(`### ${b.heading}`);
        for (const it of (b.items || [])) {
          out.push(`**${it.question}**`);
          out.push(it.answer || '');
        }
        break;
      case 'testimonials':
        if (b.heading) out.push(`### ${b.heading}`);
        for (const it of (b.items || [])) {
          out.push(`> "${it.quote}" — ${it.author || ''}${it.role ? ', ' + it.role : ''}${it.company ? ' @ ' + it.company : ''}`);
        }
        break;
      case 'links':
        if (b.heading) out.push(`### ${b.heading}`);
        for (const it of (b.items || [])) {
          out.push(`- [${it.label}](${it.url})${it.description ? ' — ' + it.description : ''}`);
        }
        break;
      case 'form':
        if (b.heading) out.push(`### ${b.heading}`);
        if (b.description) out.push(b.description);
        out.push('_(interactive form)_');
        break;
      case 'countdown':
        if (b.heading) out.push(`### ${b.heading}`);
        if (b.targetDate) out.push(`Target date: ${b.targetDate}`);
        break;
      case 'footer':
        if (b.text) out.push(b.text);
        break;
    }
    return out.filter(Boolean);
  }

  const sections: string[] = [];
  for (const page of (cfg.pages || [])) {
    const lines: string[] = [];
    for (const b of (page.blocks || [])) {
      lines.push(...blockText(b));
    }
    if (lines.length) sections.push(`## ${page.id}\n\n${lines.join('\n\n')}`);
  }

  const body = `# ${title}

${description ? `> ${description}\n` : ''}
- URL: ${url}
- Hosted on: EdgeForm (open source, edge-deployed)
- Available languages: ${langs.length ? langs.join(', ') : 'source language only'}

${sections.join('\n\n')}
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};

export const prerender = false;
