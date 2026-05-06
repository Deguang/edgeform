import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify({ status: 'ok', edge: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
