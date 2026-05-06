import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { extractTexts } from '../../../lib/i18n-extract';
import { translateTexts } from '../../../lib/translate';
import { getAuth, validateToken, unauthorized } from '../../../lib/admin-auth';

const KV_KEY = 'site:config';

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/admin/translate
 *
 * Body: {
 *   targetLang: string,          // e.g. "zh", "ja", "es"
 *   provider?: string,           // override provider (default: first enabled in settings)
 *   apiKey?: string,             // override API key
 *   endpoint?: string,           // override endpoint
 *   botId?: string,              // for Coze
 *   texts?: string[],            // if omitted, auto-extract from config
 *   saveToConfig?: boolean,      // if true, merge translations into i18n_map and save
 * }
 *
 * Response: { translations: Record<string, string>, count: number }
 */
export const POST: APIRoute = async ({ request, url }) => {
  const token = getAuth(request, url);
  if (!await validateToken(token)) return unauthorized();

  const body = await request.json() as any;
  const { targetLang, saveToConfig, force } = body;

  if (!targetLang) return jsonRes({ error: 'targetLang is required' }, 400);

  // Load config
  const stored = await env.FORM_KV.get(KV_KEY, 'text');
  if (!stored) return jsonRes({ error: 'No site config found' }, 404);
  const config = JSON.parse(stored);

  // Determine texts to translate
  const texts: string[] = body.texts?.length ? body.texts : extractTexts(config);
  if (!texts.length) return jsonRes({ translations: {}, count: 0 });

  // Filter out already-translated texts (unless force=true to re-translate all)
  const existingMap = config.i18n_map?.[targetLang] || {};
  const toTranslate = force ? texts : texts.filter(t => !existingMap[t]);

  if (!toTranslate.length) {
    return jsonRes({ translations: existingMap, count: 0, message: 'All texts already translated' });
  }

  // Resolve provider config
  const settings = config.translate_settings || {};
  const sourceLang = settings.sourceLang || 'en';

  let providerConfig: any;
  if (body.provider) {
    providerConfig = {
      provider: body.provider,
      apiKey: body.apiKey,
      endpoint: body.endpoint,
      botId: body.botId,
    };
  } else {
    const providers = settings.providers || [];
    providerConfig = providers.find((p: any) => p.enabled);
    if (!providerConfig) return jsonRes({ error: 'No translation provider configured' }, 400);
  }

  // Translate
  const ai = (env as any).AI || undefined;
  let result;
  try {
    result = await translateTexts(providerConfig, {
      texts: toTranslate,
      sourceLang,
      targetLang,
    }, ai);
  } catch (e: any) {
    return jsonRes({ error: `Translation failed: ${e.message}` }, 500);
  }

  // Build translation map
  const translationMap: Record<string, string> = { ...existingMap };
  for (let i = 0; i < toTranslate.length; i++) {
    if (result.translations[i]) {
      translationMap[toTranslate[i]] = result.translations[i];
    }
  }

  // Optionally save to config
  if (saveToConfig) {
    if (!config.i18n_map) config.i18n_map = {};
    config.i18n_map[targetLang] = translationMap;

    // Update target langs in settings
    if (!config.translate_settings) config.translate_settings = {};
    const langs: string[] = config.translate_settings.targetLangs || [];
    if (!langs.includes(targetLang)) {
      langs.push(targetLang);
      config.translate_settings.targetLangs = langs;
    }

    config.updatedAt = new Date().toISOString();
    config.version = (config.version || 0) + 1;
    await env.FORM_KV.put(KV_KEY, JSON.stringify(config));
  }

  return jsonRes({
    translations: translationMap,
    count: toTranslate.length,
    provider: result.provider,
    saved: !!saveToConfig,
  });
};

export const prerender = false;
