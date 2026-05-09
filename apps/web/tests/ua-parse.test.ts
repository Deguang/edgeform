import { describe, it, expect } from 'vitest';
import { parseUA } from '../src/lib/ua-parse';

describe('parseUA', () => {
  it('detects Chrome on macOS', () => {
    const r = parseUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    expect(r).toEqual({ browser: 'Chrome', os: 'macOS', device: 'desktop' });
  });

  it('detects Edge ahead of Chrome (Edg/ token wins)', () => {
    const r = parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.2151.78');
    expect(r.browser).toBe('Edge');
    expect(r.os).toBe('Windows 10/11');
    expect(r.device).toBe('desktop');
  });

  it('detects Safari on iOS as mobile', () => {
    const r = parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    expect(r.browser).toBe('Safari');
    expect(r.os).toBe('iOS');
    expect(r.device).toBe('mobile');
  });

  it('detects Chrome on iOS (CriOS) as mobile', () => {
    const r = parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0 Mobile/15E148 Safari/604.1');
    expect(r.browser).toBe('Chrome');
    expect(r.device).toBe('mobile');
  });

  it('detects Firefox on Linux', () => {
    const r = parseUA('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0');
    expect(r).toEqual({ browser: 'Firefox', os: 'Linux', device: 'desktop' });
  });

  it('detects iPad as tablet', () => {
    const r = parseUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    expect(r.device).toBe('tablet');
    expect(r.os).toBe('iOS');
  });

  it('detects Android tablet via Tablet token', () => {
    const r = parseUA('Mozilla/5.0 (Linux; Android 13; Tab S9) Chrome/119.0 Tablet/Safari');
    expect(r.device).toBe('tablet');
    expect(r.os).toBe('Android');
  });

  it('detects Android phone (Mobile token)', () => {
    const r = parseUA('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36');
    expect(r.device).toBe('mobile');
    expect(r.os).toBe('Android');
    expect(r.browser).toBe('Chrome');
  });

  it('classifies common bots as bot device', () => {
    expect(parseUA('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').device).toBe('bot');
    expect(parseUA('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)').device).toBe('bot');
    expect(parseUA('curl/8.4.0').device).toBe('bot');
    expect(parseUA('python-requests/2.31.0').device).toBe('bot');
  });

  it('returns Other browser/OS for unknown UA', () => {
    const r = parseUA('SomeWeirdAgent/1.0');
    expect(r.browser).toBe('Other');
    expect(r.os).toBe('Other');
  });

  it('handles empty UA gracefully', () => {
    const r = parseUA('');
    expect(r).toEqual({ browser: 'Other', os: 'Other', device: 'other' });
    const r2 = parseUA(null);
    expect(r2.device).toBe('other');
  });

  it('caps overlong UA strings (DoS protection)', () => {
    const huge = 'A'.repeat(50_000) + ' Chrome';
    const r = parseUA(huge);
    // Capped to 1024 — "Chrome" is well past the cap, so it's not detected.
    expect(r.browser).toBe('Other');
  });

  it('detects Samsung Internet', () => {
    const r = parseUA('Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 SamsungBrowser/22.0 Chrome/115.0 Mobile Safari/537.36');
    expect(r.browser).toBe('Samsung Internet');
  });
});
