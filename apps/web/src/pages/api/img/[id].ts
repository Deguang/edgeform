import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return new Response('Not found', { status: 404 });
  }

  const key = `img:${id}`;
  const result = await env.FORM_KV.getWithMetadata(key, { type: 'arrayBuffer' });

  if (!result.value) {
    return new Response('Not found', { status: 404 });
  }

  const metadata = result.metadata as { type?: string; name?: string } | null;
  const contentType = metadata?.type || 'image/png';

  return new Response(result.value as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

export const prerender = false;
