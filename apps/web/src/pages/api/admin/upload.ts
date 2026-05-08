import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { validateToken } from '../../../lib/admin-auth';
import { detectImageType } from '../../../lib/image-detect';

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

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Verify the bytes match the claimed type — clients can lie.
    const detected = detectImageType(bytes);
    if (!detected) {
      return new Response(JSON.stringify({ error: 'File contents do not match a supported image format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (detected !== file.type && !(detected === 'image/jpeg' && file.type === 'image/jpg')) {
      return new Response(JSON.stringify({ error: `MIME type mismatch: claimed ${file.type}, detected ${detected}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = crypto.randomUUID();
    // Pin extension to the detected type so a renamed file can't masquerade.
    const extByType: Record<string, string> = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
      'image/webp': 'webp', 'image/svg+xml': 'svg',
    };
    const ext = extByType[detected] || 'png';
    const key = `img:${id}.${ext}`;

    await env.FORM_KV.put(key, buffer, {
      metadata: { type: detected, name: file.name, size: file.size },
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
