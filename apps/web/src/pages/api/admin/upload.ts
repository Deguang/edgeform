import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { validateToken } from '../../../lib/admin-auth';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export const POST: APIRoute = async ({ request }) => {
  // Auth check
  const auth = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!await validateToken(auth)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const contentType = request.headers.get('Content-Type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: `File too large (max ${MAX_SIZE / 1024 / 1024}MB)` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: `Unsupported file type: ${file.type}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = crypto.randomUUID();
    const ext = file.name.split('.').pop() || 'png';
    const key = `img:${id}.${ext}`;
    const buffer = await file.arrayBuffer();

    await env.FORM_KV.put(key, buffer, {
      metadata: { type: file.type, name: file.name, size: file.size },
    });

    const url = `/api/img/${id}.${ext}`;

    return new Response(JSON.stringify({ ok: true, url, id, name: file.name }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Use multipart/form-data' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const prerender = false;
