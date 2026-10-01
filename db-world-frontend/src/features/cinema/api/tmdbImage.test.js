import { describe, it, expect } from 'vitest';
import { tmdbImg, tmdbSrcSet, TMDB_WIDTHS } from './tmdbImage';

const P = '/abc123.jpg';
const widthsOf = (srcset) => srcset.split(', ').map((c) => Number(c.match(/ (\d+)w$/)[1]));
const urlsOf = (srcset) => srcset.split(', ').map((c) => c.split(' ')[0]);

describe('tmdbImg', () => {
  it('builds a bucket URL and returns null for a missing path', () => {
    expect(tmdbImg(P, 'w500')).toBe('https://image.tmdb.org/t/p/w500/abc123.jpg');
    expect(tmdbImg(null, 'w500')).toBeNull();
    expect(tmdbImg(undefined)).toBeNull();
  });
});

describe('tmdbSrcSet', () => {
  it('emits every ladder width with a matching w descriptor', () => {
    const set = tmdbSrcSet(P);
    expect(widthsOf(set)).toEqual(TMDB_WIDTHS);
    // The descriptor has to match the bucket in the URL, or the browser picks wrongly.
    urlsOf(set).forEach((url, i) => {
      expect(url).toBe(`https://image.tmdb.org/t/p/w${TMDB_WIDTHS[i]}${P}`);
    });
  });

  it('trims the ladder to the slot, inclusive at both ends', () => {
    expect(widthsOf(tmdbSrcSet(P, { min: 185, max: 780 }))).toEqual([185, 300, 342, 500, 780]);
    expect(widthsOf(tmdbSrcSet(P, { min: 300, max: 300 }))).toEqual([300]);
  });

  it('is ascending, so a browser can scan it without sorting', () => {
    const w = widthsOf(tmdbSrcSet(P, { min: 154, max: 1280 }));
    expect([...w].sort((a, b) => a - b)).toEqual(w);
  });

  it('gives undefined rather than an empty attribute when there is nothing to offer', () => {
    // No path at all...
    expect(tmdbSrcSet(null)).toBeUndefined();
    expect(tmdbSrcSet(undefined, { min: 92, max: 1280 })).toBeUndefined();
    // ...and a window that excludes every bucket, which would otherwise emit srcset="".
    expect(tmdbSrcSet(P, { min: 2000, max: 4000 })).toBeUndefined();
    expect(tmdbSrcSet(P, { min: 500, max: 300 })).toBeUndefined();
  });

  it('covers the real slots the cinema surfaces ask for', () => {
    // Episode still: 116px phone slot up to a 260px slot at 2x.
    const still = widthsOf(tmdbSrcSet(P, { min: 185, max: 780 }));
    expect(Math.min(...still)).toBeLessThanOrEqual(116 * 2);
    expect(Math.max(...still)).toBeGreaterThanOrEqual(260 * 2);
    // Continue Watching: 230px phone slot up to 300px at 3x.
    const cw = widthsOf(tmdbSrcSet(P, { min: 300, max: 1280 }));
    expect(Math.max(...cw)).toBeGreaterThanOrEqual(300 * 3);
  });
});
