/**
 * Lightweight User-Agent classifier — just enough to bucket submissions by
 * Browser / OS / Device for analytics. Intentionally NOT a fingerprinting tool.
 *
 * Matches common patterns; unknown UAs get "Other". The string is also kept
 * verbatim in meta.ua for advanced inspection.
 */

export interface ParsedUA {
  browser: string;
  os: string;
  device: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'other';
}

const BOT_RE = /bot|crawl|slurp|spider|wget|curl|python-requests|httpie|postman|libwww|insomnia/i;
const TABLET_RE = /iPad|Tablet|Nexus 7|Nexus 9|Nexus 10|Kindle|Silk/i;
const MOBILE_RE = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|webOS|Mobile/i;

export function parseUA(uaRaw: string | null | undefined): ParsedUA {
  const ua = (uaRaw || '').slice(0, 1024); // cap

  // Device first — bots take precedence
  let device: ParsedUA['device'] = 'desktop';
  if (BOT_RE.test(ua)) device = 'bot';
  else if (TABLET_RE.test(ua)) device = 'tablet';
  else if (MOBILE_RE.test(ua)) device = 'mobile';
  else if (!ua) device = 'other';

  // Browser — order matters (more specific first)
  let browser = 'Other';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Vivaldi/.test(ua)) browser = 'Vivaldi';
  else if (/Brave/.test(ua)) browser = 'Brave';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/CriOS|Chrome/.test(ua)) browser = 'Chrome';
  else if (/FxiOS|Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua) && /Apple/.test(ua)) browser = 'Safari';
  else if (BOT_RE.test(ua)) {
    const m = ua.match(/([A-Za-z][A-Za-z0-9_-]*?(?:bot|crawler|spider))/i);
    browser = m?.[1] || 'Bot';
  }

  // OS
  let os = 'Other';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua) || /Macintosh/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { browser, os, device };
}
