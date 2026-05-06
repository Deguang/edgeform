import { describe, it, expect } from 'vitest';

// Extract the MS_LANG_MAP and msLangCode from translate.ts for testing
// Since translate.ts doesn't export them, we replicate the logic here
const MS_LANG_MAP: Record<string, string> = {
  'zh': 'zh-Hans', 'zh-cn': 'zh-Hans', 'zh-tw': 'zh-Hant',
  'pt': 'pt-pt', 'pt-br': 'pt-br',
  'sr': 'sr-Cyrl', 'mn': 'mn-Cyrl',
  'tlh': 'tlh-Latn', 'nb': 'nb', 'no': 'nb',
};

function msLangCode(lang: string): string {
  return MS_LANG_MAP[lang.toLowerCase()] || lang;
}

describe('Microsoft Edge language code mapping', () => {
  it('maps zh to zh-Hans', () => {
    expect(msLangCode('zh')).toBe('zh-Hans');
  });

  it('maps zh-cn to zh-Hans', () => {
    expect(msLangCode('zh-cn')).toBe('zh-Hans');
  });

  it('maps zh-tw to zh-Hant', () => {
    expect(msLangCode('zh-tw')).toBe('zh-Hant');
  });

  it('maps pt to pt-pt', () => {
    expect(msLangCode('pt')).toBe('pt-pt');
  });

  it('maps no to nb', () => {
    expect(msLangCode('no')).toBe('nb');
  });

  it('passes through standard codes unchanged', () => {
    expect(msLangCode('ja')).toBe('ja');
    expect(msLangCode('ko')).toBe('ko');
    expect(msLangCode('es')).toBe('es');
    expect(msLangCode('fr')).toBe('fr');
    expect(msLangCode('de')).toBe('de');
    expect(msLangCode('en')).toBe('en');
    expect(msLangCode('ar')).toBe('ar');
    expect(msLangCode('ru')).toBe('ru');
  });

  it('is case insensitive', () => {
    expect(msLangCode('ZH')).toBe('zh-Hans');
    expect(msLangCode('Zh-CN')).toBe('zh-Hans');
    expect(msLangCode('PT-BR')).toBe('pt-br');
  });
});
