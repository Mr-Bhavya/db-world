import { describe, expect, it } from 'vitest';

import { upstreamPath } from './worker';

describe('Cloudflare SEO worker routing', () => {
  it('proxies the canonical sitemap instead of serving the SPA shell', () => {
    expect(
      upstreamPath(new Request('https://db-world.in/sitemap.xml'))
    ).toBe('/sitemap.xml');
  });

  it('routes search engines to full rendered pages', () => {
    const request = new Request('https://db-world.in/db-cinema/browse', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    });

    expect(upstreamPath(request)).toBe('/api/seo/browse');
  });

  it('routes record pages to the noindex-capable renderer', () => {
    const request = new Request('https://db-world.in/db-cinema/movie/42-example', {
      headers: { 'user-agent': 'bingbot' },
    });

    expect(upstreamPath(request)).toBe('/api/seo/record/movie/42');
  });

  it('keeps AdSense crawlers on the real JavaScript app', () => {
    const request = new Request('https://db-world.in/', {
      headers: { 'user-agent': 'Mediapartners-Google' },
    });

    expect(upstreamPath(request)).toBeNull();
  });

  it('routes social preview crawlers to the preview controller', () => {
    const request = new Request('https://db-world.in/db-cinema/series/9-show', {
      headers: { 'user-agent': 'WhatsApp/2.0' },
    });

    expect(upstreamPath(request)).toBe('/api/social/record/series/9');
  });
});
