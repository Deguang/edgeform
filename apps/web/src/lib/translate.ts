/**
 * Translation provider abstraction.
 * Dispatches to Google, Microsoft, OpenAI, Claude, DeepSeek, Coze, or Workers AI.
 */

export interface TranslateRequest {
  texts: string[];
  sourceLang: string;
  targetLang: string;
}

export interface TranslateResult {
  translations: string[]; // parallel array to input texts
  provider: string;
}

export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  botId?: string;
  endpoint?: string;
  model?: string;
}

export async function translateTexts(
  config: ProviderConfig,
  req: TranslateRequest,
  ai?: any // Cloudflare AI binding (optional)
): Promise<TranslateResult> {
  switch (config.provider) {
    case 'google':        return translateGoogle(config, req);
    case 'microsoft':     return translateMicrosoft(config, req);
    case 'microsoft-edge': return translateMicrosoftEdge(req);
    case 'mymemory':      return translateMyMemory(req);
    case 'deeplx':        return translateDeepLX(config, req);
    case 'openai':        return translateAI(config, req, 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini');
    case 'claude':        return translateClaude(config, req);
    case 'deepseek':      return translateAI(config, req, 'https://api.deepseek.com/chat/completions', 'deepseek-chat');
    case 'glm':           return translateAI(config, req, 'https://open.bigmodel.cn/api/paas/v4/chat/completions', 'glm-4-flash');
    case 'openai-compat': return translateAI(config, req, config.endpoint || '', config.apiKey ? 'auto' : '');
    case 'coze':          return translateCoze(config, req);
    case 'workers-ai':    return translateWorkersAI(req, ai);
    default:
      throw new Error(`Unknown translation provider: ${config.provider}`);
  }
}

// `auto` = let the provider detect the source language.
const isAuto = (s: string) => !s || s.toLowerCase() === 'auto';

// --- Google Translate (free endpoint or Cloud Translation v2) ---
async function translateGoogle(config: ProviderConfig, req: TranslateRequest): Promise<TranslateResult> {
  if (config.apiKey) {
    // Cloud Translation API v2 — omit `source` to enable auto-detect.
    const url = `https://translation.googleapis.com/language/translate/v2?key=${config.apiKey}`;
    const body: any = { q: req.texts, target: req.targetLang, format: 'text' };
    if (!isAuto(req.sourceLang)) body.source = req.sourceLang;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Google API error: ${res.status} ${await res.text()}`);
    const data = await res.json() as any;
    return {
      translations: data.data.translations.map((t: any) => t.translatedText),
      provider: 'google',
    };
  }

  // Free endpoint — translate one by one. `sl=auto` triggers detection.
  const sl = isAuto(req.sourceLang) ? 'auto' : req.sourceLang;
  const translations: string[] = [];
  let failCount = 0;
  for (const text of req.texts) {
    try {
      const params = new URLSearchParams({
        client: 'gtx', sl, tl: req.targetLang, dt: 't', q: text,
      });
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const raw = await res.text();
      const data = JSON.parse(raw);
      const translated = (data[0] || []).map((s: any) => s[0]).filter(Boolean).join('');
      if (!translated || translated === text) {
        failCount++;
        translations.push(text);
      } else {
        translations.push(translated);
      }
    } catch (e: any) {
      failCount++;
      translations.push(text);
    }
  }
  // If all translations failed, throw so user knows
  if (failCount === req.texts.length) {
    throw new Error('Google free translate: all requests failed. This endpoint may be blocked in Workers. Use a provider with an API key instead (OpenAI, DeepSeek, Claude, or Google Cloud with apiKey).');
  }
  return { translations, provider: 'google-free' };
}

// --- MyMemory (free, no key needed, 1000 words/day) ---
async function translateMyMemory(req: TranslateRequest): Promise<TranslateResult> {
  // MyMemory needs an explicit source. Default to 'en' when auto is requested.
  const src = isAuto(req.sourceLang) ? 'en' : req.sourceLang;
  const translations: string[] = [];
  // MyMemory supports batch via | separator but can be unreliable for long texts
  for (const text of req.texts) {
    try {
      const params = new URLSearchParams({
        q: text,
        langpair: `${src}|${req.targetLang}`,
      });
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`);
      if (!res.ok) throw new Error(`MyMemory API error: ${res.status}`);
      const data = await res.json() as any;
      const translated = data.responseData?.translatedText;
      if (translated && translated !== text && !data.responseData?.match?.toLowerCase().includes('no translation')) {
        translations.push(translated);
      } else {
        translations.push(text);
      }
    } catch {
      translations.push(text);
    }
  }
  const failCount = translations.filter((t, i) => t === req.texts[i]).length;
  if (failCount === req.texts.length) {
    throw new Error('MyMemory: all translations failed. Daily limit (1000 words) may be reached.');
  }
  return { translations, provider: 'mymemory' };
}

// --- Microsoft Edge Translate (free, no key needed) ---
// Microsoft Translator uses different codes for some languages
const MS_LANG_MAP: Record<string, string> = {
  'zh': 'zh-Hans', 'zh-cn': 'zh-Hans',
  'zh-tw': 'zh-Hant', 'zh-hk': 'zh-Hant',
  'pt': 'pt-pt', 'pt-br': 'pt-br',
  'sr': 'sr-Cyrl', 'mn': 'mn-Cyrl',
  'tlh': 'tlh-Latn', 'nb': 'nb', 'no': 'nb',
  'tl': 'fil',
};

function msLangCode(lang: string): string {
  return MS_LANG_MAP[lang.toLowerCase()] || lang;
}

async function translateMicrosoftEdge(req: TranslateRequest): Promise<TranslateResult> {
  // Get auth token from Edge's public endpoint
  const tokenRes = await fetch('https://edge.microsoft.com/translate/auth', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!tokenRes.ok) throw new Error(`Microsoft Edge auth failed: ${tokenRes.status}`);
  const token = await tokenRes.text();

  // Omit `from` for auto-detect (Microsoft will detect per text).
  const toLang = msLangCode(req.targetLang);
  const fromParam = isAuto(req.sourceLang) ? '' : `&from=${msLangCode(req.sourceLang)}`;
  const baseUrl = `https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${toLang}${fromParam}`;

  // Microsoft Translator batch limit is ~25 items; chunk to avoid failures
  const CHUNK_SIZE = 25;
  const allTranslations: string[] = [];

  for (let i = 0; i < req.texts.length; i += CHUNK_SIZE) {
    const chunk = req.texts.slice(i, i + CHUNK_SIZE);
    const body = chunk.map(text => ({ Text: text }));

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Microsoft Edge translate failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as any[];
    for (const item of data) {
      allTranslations.push(item.translations[0]?.text || '');
    }
  }

  return {
    translations: allTranslations,
    provider: 'microsoft-edge',
  };
}

// --- Microsoft / Azure Translator v3 (requires API key) ---
async function translateMicrosoft(config: ProviderConfig, req: TranslateRequest): Promise<TranslateResult> {
  const endpoint = config.endpoint || 'https://api.cognitive.microsofttranslator.com';
  const fromParam = isAuto(req.sourceLang) ? '' : `&from=${msLangCode(req.sourceLang)}`;
  const url = `${endpoint}/translate?api-version=3.0&to=${msLangCode(req.targetLang)}${fromParam}`;
  const body = req.texts.map(text => ({ Text: text }));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.apiKey || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Microsoft API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as any[];
  return {
    translations: data.map(item => item.translations[0]?.text || ''),
    provider: 'microsoft',
  };
}

// --- OpenAI-compatible (OpenAI, DeepSeek, GLM, any BYOK) ---
async function translateAI(
  config: ProviderConfig,
  req: TranslateRequest,
  endpoint: string,
  defaultModel: string
): Promise<TranslateResult> {
  const url = config.endpoint || endpoint;
  const model = config.model || defaultModel;
  const fromDesc = isAuto(req.sourceLang) ? 'their detected source language' : `"${req.sourceLang}"`;
  const systemPrompt = `You are a professional translator. Translate the following JSON array of strings from ${fromDesc} to "${req.targetLang}". Return ONLY a JSON array of translated strings in the same order. Preserve any HTML tags. Do not add explanations.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(req.texts) },
      ],
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  const content = data.choices?.[0]?.message?.content || '[]';
  const translations = parseJsonArray(content, req.texts.length);
  return { translations, provider: config.provider };
}

// --- Claude (Anthropic Messages API) ---
async function translateClaude(config: ProviderConfig, req: TranslateRequest): Promise<TranslateResult> {
  const url = config.endpoint || 'https://api.anthropic.com/v1/messages';
  const fromDesc = isAuto(req.sourceLang) ? 'their detected source language' : `"${req.sourceLang}"`;
  const systemPrompt = `You are a professional translator. Translate the following JSON array of strings from ${fromDesc} to "${req.targetLang}". Return ONLY a JSON array of translated strings in the same order. Preserve any HTML tags.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(req.texts) }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  const content = data.content?.[0]?.text || '[]';
  const translations = parseJsonArray(content, req.texts.length);
  return { translations, provider: 'claude' };
}

// --- Coze Bot API ---
async function translateCoze(config: ProviderConfig, req: TranslateRequest): Promise<TranslateResult> {
  const url = config.endpoint || 'https://api.coze.com/open_api/v2/chat';
  const fromDesc = isAuto(req.sourceLang) ? 'their detected source language' : `"${req.sourceLang}"`;
  const prompt = `Translate the following texts from ${fromDesc} to "${req.targetLang}". Return ONLY a JSON array of translated strings:\n${JSON.stringify(req.texts)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bot_id: config.botId || '',
      user: 'edgeform-translate',
      query: prompt,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Coze API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  const answer = data.messages?.find((m: any) => m.role === 'assistant' && m.type === 'answer')?.content || '[]';
  const translations = parseJsonArray(answer, req.texts.length);
  return { translations, provider: 'coze' };
}

// --- DeepLX (free DeepL proxy) ---
async function translateDeepLX(config: ProviderConfig, req: TranslateRequest): Promise<TranslateResult> {
  const url = config.endpoint || 'https://api.deeplx.org/translate';
  const translations: string[] = [];

  for (const text of req.texts) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          text,
          source_lang: isAuto(req.sourceLang) ? 'auto' : req.sourceLang.toUpperCase(),
          target_lang: req.targetLang.toUpperCase(),
        }),
      });
      if (!res.ok) throw new Error(`DeepLX error: ${res.status}`);
      const data = await res.json() as any;
      translations.push(data.data || text);
    } catch {
      translations.push(text);
    }
  }

  const failCount = translations.filter((t, i) => t === req.texts[i]).length;
  if (failCount === req.texts.length) throw new Error('DeepLX: all translations failed.');
  return { translations, provider: 'deeplx' };
}

// --- Cloudflare Workers AI ---
async function translateWorkersAI(req: TranslateRequest, ai: any): Promise<TranslateResult> {
  if (!ai) throw new Error('Workers AI binding not available. Add [ai] binding to wrangler.toml.');

  const translations: string[] = [];
  for (const text of req.texts) {
    const result = await ai.run('@cf/meta/m2m100-1.2b', {
      text,
      // m2m100 needs an explicit source. Default to 'en' when auto is requested.
      source_lang: isAuto(req.sourceLang) ? 'en' : req.sourceLang,
      target_lang: req.targetLang,
    });
    translations.push(result.translated_text || text);
  }
  return { translations, provider: 'workers-ai' };
}

// --- Helpers ---

/** Parse a JSON array from AI response, with fallback. */
function parseJsonArray(content: string, expectedLength: number): string[] {
  // Extract JSON array from response (may have markdown fences)
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return new Array(expectedLength).fill('');
  try {
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr) && arr.length === expectedLength) {
      return arr.map(s => String(s));
    }
    // Pad or trim to expected length
    return Array.from({ length: expectedLength }, (_, i) => String(arr[i] || ''));
  } catch {
    return new Array(expectedLength).fill('');
  }
}
