/// <reference path="../.astro/types.d.ts" />

interface Env {
  DB: D1Database;
  FORM_KV: KVNamespace;
  ADMIN_PASSWORD: string;
  TURNSTILE_SECRET: string;
}

// Astro v6 + @astrojs/cloudflare v13: use `import { env } from 'cloudflare:workers'`
declare module 'cloudflare:workers' {
  const env: Env;
  export { env };
}
