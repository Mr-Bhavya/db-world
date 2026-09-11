import { describe, it, expect } from 'vitest';
import { pathFromAppLink } from './appLinks';

describe('pathFromAppLink', () => {
  describe('accepts real shared links', () => {
    it('resolves a shared movie record URL to its in-app path', () => {
      expect(pathFromAppLink('https://db-world.in/db-cinema/movie/123-inception'))
        .toBe('/db-cinema/movie/123-inception');
    });

    it('resolves a series URL', () => {
      expect(pathFromAppLink('https://db-world.in/db-cinema/series/45-loki'))
        .toBe('/db-cinema/series/45-loki');
    });

    it('accepts the www host', () => {
      expect(pathFromAppLink('https://www.db-world.in/db-cinema/movie/1-x'))
        .toBe('/db-cinema/movie/1-x');
    });

    it('accepts the Capacitor WebView origin', () => {
      expect(pathFromAppLink('https://app.db-world.in/user-profile'))
        .toBe('/user-profile');
    });

    it('accepts the bare host as the hub', () => {
      // `new URL('https://db-world.in')` has pathname '/', so this must not be null.
      expect(pathFromAppLink('https://db-world.in')).toBe('/');
      expect(pathFromAppLink('https://db-world.in/')).toBe('/');
    });

    it('preserves query string and hash', () => {
      expect(pathFromAppLink('https://db-world.in/db-cinema/movie/9-a?tab=watch#cast'))
        .toBe('/db-cinema/movie/9-a?tab=watch#cast');
    });

    it('is case-insensitive on the host', () => {
      expect(pathFromAppLink('https://DB-World.IN/db-ipo')).toBe('/db-ipo');
    });
  });

  describe('still accepts the retired /db-world prefix', () => {
    // These are what an OLDER Android build minted and what its intent filter
    // (pathPrefix="/db-world") still matches, so they must resolve rather than be
    // rejected. LegacyPrefixRedirect strips the prefix once the router sees the path
    // — this function's job is only to not throw the link away.
    it('passes a prefixed record link through untouched', () => {
      expect(pathFromAppLink('https://db-world.in/db-world/db-cinema/movie/123-inception'))
        .toBe('/db-world/db-cinema/movie/123-inception');
    });

    it('passes the prefixed hub through untouched', () => {
      expect(pathFromAppLink('https://db-world.in/db-world')).toBe('/db-world');
    });

    it('keeps query and hash on a prefixed link', () => {
      expect(pathFromAppLink('https://db-world.in/db-world/db-ipo/x?tab=gmp#top'))
        .toBe('/db-world/db-ipo/x?tab=gmp#top');
    });
  });

  describe('rejects links it must not act on', () => {
    it.each([
      ['a foreign host',            'https://evil.com/db-cinema/movie/1'],
      ['a lookalike host',          'https://db-world.in.evil.com/x'],
      ['a subdomain not allowed',   'https://cdn.db-world.in/x'],
      ['the api host',              'https://api.db-world.in/api/seo/browse'],
      ['a javascript: URL',         'javascript:alert(1)'],
      ['a data: URL',               'data:text/html,<script>1</script>'],
      ['a custom scheme',           'dbworld://home'],
      ['a relative path',           '/db-cinema/movie/1'],
      ['a protocol-relative URL',   '//evil.com/x'],
      ['malformed input',           'not a url'],
      ['an empty string',           ''],
      ['undefined',                 undefined],
      ['null',                      null],
      ['a non-string',              42],
    ])('returns null for %s', (_label, input) => {
      expect(pathFromAppLink(input)).toBeNull();
    });

    it('is the host, not the path, that decides', () => {
      // Two cases this used to reject and now deliberately accepts: with the apps at
      // the domain root there is no prefix left to validate against, so any path on
      // an allowed host is a candidate route and an unknown one lands on the in-app
      // error page. That was already true of `/db-world/nonsense` before.
      expect(pathFromAppLink('https://db-world.in/not-a-route')).toBe('/not-a-route');
      expect(pathFromAppLink('https://db-world.in/db-worldsomething/x'))
        .toBe('/db-worldsomething/x');
      // The boundary that actually matters is still enforced.
      expect(pathFromAppLink('https://evil.com/not-a-route')).toBeNull();
    });
  });

  it('never returns an absolute URL, so it cannot become an open redirect', () => {
    const result = pathFromAppLink('https://db-world.in/db-cinema/movie/1-a');
    expect(result.startsWith('/')).toBe(true);
    expect(result).not.toContain('db-world.in');
  });
});
