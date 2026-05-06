import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async () => {
  const result = await env.DB.prepare('SELECT COUNT(*) as count FROM waitlist').first<{ count: number }>();
  return new Response(JSON.stringify({ count: result?.count ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
