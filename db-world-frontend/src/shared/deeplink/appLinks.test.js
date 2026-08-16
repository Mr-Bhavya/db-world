import { describe, it, expect } from 'vitest';
import { pathFromAppLink } from './appLinks';

describe('pathFromAppLink', () => {
  describe('accepts real shared links', () => {
    it('resolves a shared movie record URL to its in-app path', () => {
      expect(pathFromAppLink('https://db-world.in/db-world/db-cinema/movie/123-inception'))
        .toBe('/db-world/db-cinema/movie/123-inception');
    });

    it('resolves a series URL', () => {
      expect(pathFromAppLink('https://db-world.in/db-world/db-cinema/series/45-loki'))
        .toBe('/db-world/db-cinema/series/45-loki');
    });

    it('accepts the www host', () => {
      expect(pathFromAppLink('https://www.db-world.in/db-world/db-cinema/movie/1-x'))
        .toBe('/db-world/db-cinema/movie/1-x');
    });

    it('accepts the Capacitor WebView origin', () => {
      expect(pathFromAppLink('https://app.db-world.in/db-world/profile'))
        .toBe('/db-world/profile');
    });

    it('accepts the bare app home', () => {
      expect(pathFromAppLink('https://db-world.in/db-world')).toBe('/db-world');
    });

    it('preserves query string and hash', () => {
      expect(pathFromAppLink('https://db-world.in/db-world/db-cinema/movie/9-a?tab=watch#cast'))
        .toBe('/db-world/db-cinema/movie/9-a?tab=watch#cast');
    });

    it('is case-insensitive on the host', () => {
      expect(pathFromAppLink('https://DB-World.IN/db-world/home')).toBe('/db-world/home');
    });
  });

  describe('rejects links it must not act on', () => {
    it.each([
      ['a foreign host',            'https://evil.com/db-world/db-cinema/movie/1'],
      ['a lookalike host',          'https://db-world.in.evil.com/db-world/x'],
      ['a subdomain not allowed',   'https://cdn.db-world.in/db-world/x'],
      ['a path outside the app',    'https://db-world.in/admin-secret'],
      ['a prefix-collision path',   'https://db-world.in/db-worldsomething/x'],
      ['a javascript: URL',         'javascript:alert(1)'],
      ['a data: URL',               'data:text/html,<script>1</script>'],
      ['a custom scheme',           'dbworld://db-world/home'],
      ['a relative path',           '/db-world/db-cinema/movie/1'],
      ['a protocol-relative URL',   '//evil.com/db-world/x'],
      ['malformed input',           'not a url'],
      ['an empty string',           ''],
      ['undefined',                 undefined],
      ['null',                      null],
      ['a non-string',              42],
    ])('returns null for %s', (_label, input) => {
      expect(pathFromAppLink(input)).toBeNull();
    });
  });

  it('never returns an absolute URL, so it cannot become an open redirect', () => {
    const result = pathFromAppLink('https://db-world.in/db-world/db-cinema/movie/1-a');
    expect(result.startsWith('/')).toBe(true);
    expect(result).not.toContain('db-world.in');
  });
});
