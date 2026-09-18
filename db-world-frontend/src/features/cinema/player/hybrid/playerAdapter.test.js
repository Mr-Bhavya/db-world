import { describe, expect, it } from 'vitest';

import { isHlsUrl } from './playerAdapter';

/**
 * Getting this wrong is silent and total: a false negative hands an HLS manifest to a
 * bare `<video>` element, which plays nothing outside Safari, and a false positive loads
 * a 400 KB library to play an MP4.
 */
describe('isHlsUrl', () => {
  it('matches a plain manifest', () => {
    expect(isHlsUrl('https://cdn.example.com/live/index.m3u8')).toBe(true);
  });

  it('matches a manifest carrying a query string', () => {
    // Signed/tokenised manifests are the norm for live channels, so a regex anchored at
    // the end of the string would miss most real URLs.
    expect(isHlsUrl('https://cdn.example.com/live/index.m3u8?token=abc123&e=1700000000')).toBe(true);
  });

  it('matches a manifest with a fragment', () => {
    expect(isHlsUrl('https://cdn.example.com/live/index.m3u8#t=0')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isHlsUrl('https://cdn.example.com/LIVE/INDEX.M3U8')).toBe(true);
  });

  it('does not match progressive files', () => {
    expect(isHlsUrl('https://cdn.example.com/movie.mp4')).toBe(false);
    expect(isHlsUrl('https://cdn.example.com/movie.mkv')).toBe(false);
    expect(isHlsUrl('https://cdn.example.com/stream.mpd')).toBe(false);
  });

  it('does not match a path that merely contains the token', () => {
    expect(isHlsUrl('https://cdn.example.com/m3u8-archive/movie.mp4')).toBe(false);
    expect(isHlsUrl('https://cdn.example.com/index.m3u8x')).toBe(false);
  });

  it('tolerates a missing url', () => {
    expect(isHlsUrl(undefined)).toBe(false);
    expect(isHlsUrl(null)).toBe(false);
    expect(isHlsUrl('')).toBe(false);
  });
});
