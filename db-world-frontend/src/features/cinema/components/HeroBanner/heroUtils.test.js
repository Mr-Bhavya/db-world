import { describe, it, expect } from 'vitest';
import {
  fmtRuntime,
  buildMobileMeta,
  heroArtCandidates,
  heroBadge,
  classifyLogoTone,
  interpolateRgb,
  darken,
} from './heroUtils';

// ─── heroArtCandidates ─────────────────────────────────────────────────────
// This is the shared source of truth for "which image does the hero paint",
// used both to render the artwork and to pick the image the page-wash colour
// is sampled from. The two diverging is what made the wash sometimes clash
// with the picture on screen.

const full = {
  posterPathClean: '/poster-clean.jpg',
  posterPath: '/poster-text.jpg',
  backdropPath: '/backdrop-clean.jpg',
  backdropPathText: '/backdrop-text.jpg',
};

describe('heroArtCandidates', () => {
  it('leads with the portrait poster on phones and the landscape backdrop otherwise', () => {
    expect(heroArtCandidates(full, { portrait: true, hasLogo: false })[0]).toBe('/poster-clean.jpg');
    expect(heroArtCandidates(full, { portrait: false, hasLogo: false })[0]).toBe('/backdrop-clean.jpg');
  });

  it('prefers textless artwork when a title logo will be drawn on top', () => {
    // Without a clean poster the phone must skip the text-bearing poster and
    // take the clean backdrop, or the title renders twice.
    const noCleanPoster = { ...full, posterPathClean: null };
    const withLogo = heroArtCandidates(noCleanPoster, { portrait: true, hasLogo: true });
    const withoutLogo = heroArtCandidates(noCleanPoster, { portrait: true, hasLogo: false });

    expect(withLogo.filter(Boolean)[0]).toBe('/backdrop-clean.jpg');
    expect(withoutLogo.filter(Boolean)[0]).toBe('/poster-text.jpg');
  });

  it('leads with the TITLED poster when the card draws no title of its own', () => {
    // The phone card stack paints the poster AS the hero, so there the poster's own
    // title art is the title and the clean variant would leave the card nameless.
    expect(heroArtCandidates(full, { portrait: true, hasLogo: false, titled: true })[0])
      .toBe('/poster-text.jpg');
    expect(heroArtCandidates(full, { portrait: true, hasLogo: true, titled: true })[0])
      .toBe('/poster-text.jpg');
  });

  it('falls back through the clean poster when there is no titled one', () => {
    const noTitledPoster = { ...full, posterPath: null };
    expect(heroArtCandidates(noTitledPoster, { portrait: true, titled: true }).filter(Boolean)[0])
      .toBe('/poster-clean.jpg');
  });

  it('still offers the text-bearing artwork as a last resort', () => {
    const onlyText = { posterPath: '/poster-text.jpg', backdropPathText: '/backdrop-text.jpg' };
    expect(heroArtCandidates(onlyText, { portrait: true, hasLogo: true }).filter(Boolean))
      .toEqual(['/poster-text.jpg', '/backdrop-text.jpg']);
  });

  it('always returns the same four paths, just reordered', () => {
    const combos = [
      { portrait: true, hasLogo: true },
      { portrait: true, hasLogo: false },
      { portrait: false, hasLogo: true },
      { portrait: false, hasLogo: false },
    ];
    combos.forEach((opts) => {
      expect([...heroArtCandidates(full, opts)].sort()).toEqual([
        '/backdrop-clean.jpg', '/backdrop-text.jpg', '/poster-clean.jpg', '/poster-text.jpg',
      ]);
    });
  });

  it('survives a missing record and a record with no artwork at all', () => {
    expect(heroArtCandidates(null, { portrait: true, hasLogo: true }).filter(Boolean)).toEqual([]);
    expect(heroArtCandidates({}, { portrait: false, hasLogo: false }).filter(Boolean)).toEqual([]);
  });
});

// ─── classifyLogoTone ──────────────────────────────────────────────────────
// Only near-black artwork gets repainted white; everything else keeps its
// brand colour.

describe('classifyLogoTone', () => {
  it('calls a mostly-black logo dark', () => {
    expect(classifyLogoTone(90, 100)).toBe('dark');
  });

  it('keeps a white or coloured logo as-is', () => {
    expect(classifyLogoTone(2, 100)).toBe('light');
    expect(classifyLogoTone(0, 100)).toBe('light');
  });

  it('still calls black glyphs dark when a light outline pads the tally', () => {
    // The regression this replaced: averaging luma let a halo of bright edge
    // pixels pull an obviously-black logo over the threshold.
    expect(classifyLogoTone(70, 100)).toBe('dark');
  });

  it('leaves a majority-light logo alone even with dark accents', () => {
    expect(classifyLogoTone(45, 100)).toBe('light');
  });

  it('is undecidable when nothing opaque was sampled', () => {
    expect(classifyLogoTone(0, 0)).toBeNull();
  });

  it('treats the 60% threshold as inclusive', () => {
    expect(classifyLogoTone(60, 100)).toBe('dark');
    expect(classifyLogoTone(59, 100)).toBe('light');
  });
});

// ─── interpolateRgb ────────────────────────────────────────────────────────

describe('interpolateRgb', () => {
  const black = [0, 0, 0];
  const white = [255, 255, 255];

  it('returns the endpoints exactly at t=0 and t=1', () => {
    expect(interpolateRgb(black, white, 0)).toEqual(black);
    expect(interpolateRgb(black, white, 1)).toEqual(white);
  });

  it('clamps out-of-range progress instead of overshooting', () => {
    expect(interpolateRgb(black, white, -0.5)).toEqual(black);
    expect(interpolateRgb(black, white, 4)).toEqual(white);
  });

  it('eases out, so it is already past halfway at the midpoint', () => {
    const [r] = interpolateRgb(black, white, 0.5);
    expect(r).toBeGreaterThan(128);
    expect(r).toBeLessThan(255);
  });

  it('moves monotonically and returns whole channel values', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const [r] = interpolateRgb(black, white, t);
      expect(Number.isInteger(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it('interpolates each channel independently', () => {
    expect(interpolateRgb([10, 20, 30], [10, 20, 30], 0.5)).toEqual([10, 20, 30]);
  });
});

// ─── fmtRuntime / buildMobileMeta ──────────────────────────────────────────

describe('fmtRuntime', () => {
  it('splits into hours and minutes past the hour', () => {
    expect(fmtRuntime(142)).toBe('2h 22m');
    expect(fmtRuntime(60)).toBe('1h 0m');
  });

  it('drops the hour component under 60 minutes', () => {
    expect(fmtRuntime(47)).toBe('47m');
  });

  it('returns null rather than "0m" for missing or nonsense values', () => {
    [0, -5, null, undefined, 'abc'].forEach((v) => expect(fmtRuntime(v)).toBeNull());
  });
});

describe('buildMobileMeta', () => {
  it('lists year, up to two genres, then runtime for a film', () => {
    expect(buildMobileMeta({
      type: 'MOVIE',
      releaseDate: '2024-03-01',
      genres: ['Action', 'Thriller', 'Drama'],
      runtime: 132,
    })).toEqual(['2024', 'Action', 'Thriller', '2h 12m']);
  });

  it('uses a pluralised season count for a series', () => {
    const base = { type: 'TV_SERIES', releaseDate: '2023-01-01', genres: [] };
    expect(buildMobileMeta({ ...base, numberOfSeasons: 1 })).toEqual(['2023', '1 Season']);
    expect(buildMobileMeta({ ...base, numberOfSeasons: 4 })).toEqual(['2023', '4 Seasons']);
  });

  it('omits a series season count when there are none', () => {
    expect(buildMobileMeta({ type: 'TV_SERIES', releaseDate: '2023-01-01', numberOfSeasons: 0 }))
      .toEqual(['2023']);
  });

  it('never emits a runtime for a series, even when one is present', () => {
    expect(buildMobileMeta({ type: 'TV_SERIES', releaseDate: '2023-01-01', runtime: 45, numberOfSeasons: 2 }))
      .toEqual(['2023', '2 Seasons']);
  });

  it('skips a missing year and a zero runtime rather than emitting blanks', () => {
    expect(buildMobileMeta({ type: 'MOVIE', genres: ['Comedy'], runtime: 0 })).toEqual(['Comedy']);
  });

  it('returns an empty list for a missing record', () => {
    expect(buildMobileMeta(null)).toEqual([]);
    expect(buildMobileMeta(undefined)).toEqual([]);
  });
});

// ─── darken ────────────────────────────────────────────────────────────────
// Guards the invariant the hero scrim relies on: the neutral fallback triple
// "20,20,20" is exactly #141414, the page background.

describe('darken', () => {
  it('scales each channel and rounds to whole numbers', () => {
    expect(darken([100, 200, 50], 0.5)).toBe('50,100,25');
  });

  it('can land on the neutral 20,20,20 the scrims fall back to', () => {
    // That triple is #141414 — the page background — which is why an
    // un-extracted hero renders its wash invisibly rather than as a grey slab.
    expect(darken([48, 48, 48], 0.42)).toBe('20,20,20');
  });

  it('clamps nothing but rounds half-up per channel', () => {
    expect(darken([1, 3, 5], 0.5)).toBe('1,2,3');
  });
});


// ─── heroBadge ─────────────────────────────────────────────────────────────
// The single contextual chip on the phone hero card. Pure so the precedence is
// pinned down: a rail-supplied rank beats anything inferred from a date.

describe('heroBadge', () => {
  const NOW = Date.parse('2026-08-20T00:00:00Z');
  const movie = (releaseDate) => ({ type: 'MOVIE', releaseDate });

  it('prefers a real Top 10 rank over anything date-derived', () => {
    const badge = heroBadge(movie('2026-08-19'), { ranked: true, top10: true, idx: 2, now: NOW });
    expect(badge).toEqual({ kind: 'top10', label: '#3 in Movies' });
  });

  it('names the right list for a series', () => {
    const badge = heroBadge({ type: 'TV_SERIES' }, { ranked: true, top10: true, idx: 0, now: NOW });
    expect(badge.label).toBe('#1 in Shows');
  });

  it('does NOT claim Top 10 for a merely-ordered rail, and names that rail instead', () => {
    // A "Trending Now" rail is ordered but is not a top ten; borrowing the badge would
    // be a straight lie about what the number means.
    const badge = heroBadge(movie('2026-01-01'), {
      ranked: true, top10: false, rankLabel: 'Trending Now', idx: 4, now: NOW,
    });
    expect(badge).toEqual({ kind: 'rank', label: '#5 in Trending Now' });
  });

  it('falls back to a plain trending position when the rail has no name', () => {
    const badge = heroBadge(movie('2026-01-01'), { ranked: true, idx: 0, now: NOW });
    expect(badge).toEqual({ kind: 'rank', label: '#1 trending' });
  });

  it('marks an unreleased title as coming soon', () => {
    expect(heroBadge(movie('2026-09-01'), { now: NOW })).toEqual({ kind: 'soon', label: 'Coming soon' });
  });

  it('marks a recent release as new, and an old one as nothing', () => {
    expect(heroBadge(movie('2026-08-01'), { now: NOW })?.kind).toBe('new');
    expect(heroBadge(movie('2026-01-01'), { now: NOW })).toBeNull();
  });

  it('says nothing when there is no usable date', () => {
    expect(heroBadge(movie(null), { now: NOW })).toBeNull();
    expect(heroBadge(movie('not-a-date'), { now: NOW })).toBeNull();
    expect(heroBadge(null)).toBeNull();
  });
});
