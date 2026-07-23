import { describe, it, expect } from '@jest/globals';
import { extractResultUrls } from '../../src/cron/scraper/search';

describe('extractResultUrls', () => {
  it('decodes DuckDuckGo uddg redirect links into real target URLs', () => {
    const html = `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.sgcarmart.com%2Fcarpark&rut=abc123">SGCarMart</a>`;
    expect(extractResultUrls(html)).toEqual(['https://www.sgcarmart.com/carpark']);
  });

  it('preserves query strings inside the encoded target', () => {
    const html = `href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fx.com%2Fp%3Fa%3D1%26b%3D2&rut=z"`;
    expect(extractResultUrls(html)).toContain('https://x.com/p?a=1&b=2');
  });

  it('dedupes repeated results and drops redirect/search hosts', () => {
    const html = `
      href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.com&rut=1"
      href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.com&rut=2"
      href="https://duckduckgo.com/settings"
      href="https://getgo.sg/rates"`;
    const out = extractResultUrls(html);
    expect(out).toContain('https://a.com');
    expect(out).toContain('https://getgo.sg/rates');
    expect(out.filter(u => u === 'https://a.com')).toHaveLength(1);
    expect(out.some(u => u.includes('duckduckgo.com'))).toBe(false);
  });

  it('returns nothing for a page with no result links', () => {
    expect(extractResultUrls('<html><body>no results</body></html>')).toEqual([]);
  });

  it('skips malformed percent-encoding without throwing', () => {
    expect(() => extractResultUrls('href="//duckduckgo.com/l/?uddg=%E0%A4%A&rut=1"')).not.toThrow();
  });
});

import { shouldBackOff } from '../../src/cron/scraper/search';

describe('shouldBackOff', () => {
  it('backs off on connection errors', () => {
    expect(shouldBackOff({ code: 'ECONNREFUSED' })).toBe(true);
    expect(shouldBackOff({ code: 'ETIMEDOUT' })).toBe(true);
  });
  it('backs off on DuckDuckGo HTTP blocks (403/429/5xx)', () => {
    expect(shouldBackOff({ response: { status: 403 } })).toBe(true);
    expect(shouldBackOff({ response: { status: 429 } })).toBe(true);
    expect(shouldBackOff({ response: { status: 503 } })).toBe(true);
  });
  it('does not back off on an ordinary 404 or a parse error', () => {
    expect(shouldBackOff({ response: { status: 404 } })).toBe(false);
    expect(shouldBackOff(new Error('bad regex'))).toBe(false);
  });
});
