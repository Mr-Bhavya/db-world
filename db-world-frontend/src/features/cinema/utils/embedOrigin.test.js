import { describe, it, expect } from 'vitest';
import { embedOrigin } from './embedOrigin';

describe('embedOrigin', () => {
  it('returns the origin of a standard YouTube embed', () => {
    expect(embedOrigin('https://www.youtube.com/embed/abc123?autoplay=1&mute=1'))
      .toBe('https://www.youtube.com');
  });

  it('returns the nocookie origin, not a hard-coded youtube.com', () => {
    // The whole reason this is derived rather than hard-coded.
    expect(embedOrigin('https://www.youtube-nocookie.com/embed/abc123'))
      .toBe('https://www.youtube-nocookie.com');
  });

  it('keeps a non-default port in the origin', () => {
    expect(embedOrigin('http://localhost:3000/embed/x')).toBe('http://localhost:3000');
  });

  it('drops path, query and hash', () => {
    const o = embedOrigin('https://player.vimeo.com/video/9?h=1#t=10');
    expect(o).toBe('https://player.vimeo.com');
  });

  it('preserves the scheme (http stays http)', () => {
    expect(embedOrigin('http://example.com/e')).toBe('http://example.com');
  });

  it.each([
    ['a relative URL',       '/embed/abc'],
    ['a protocol-relative',  '//www.youtube.com/embed/abc'],
    ['a data: URL',          'data:text/html,<p>hi</p>'],
    ['a blob: URL',          'blob:https://www.youtube.com/1234'],
    ['an about: URL',        'about:blank'],
    ['a javascript: URL',    'javascript:alert(1)'],
    ['malformed input',      'not a url'],
    ['an empty string',      ''],
    ['undefined',            undefined],
    ['null',                 null],
    ['a non-string',         42],
  ])('returns null for %s', (_label, input) => {
    expect(embedOrigin(input)).toBeNull();
  });

  it('never returns the wildcard', () => {
    // Returning '*' would defeat the point — it delivers the message to whatever
    // document occupies the frame.
    for (const u of ['https://www.youtube.com/embed/a', 'bogus', '', null]) {
      expect(embedOrigin(u)).not.toBe('*');
    }
  });
});
