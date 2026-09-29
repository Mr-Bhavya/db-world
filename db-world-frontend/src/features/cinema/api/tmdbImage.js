/**
 * TMDB image URLs. Pure string building — no transport, so it stays testable and
 * importable from anywhere. `cinemaApi` re-exports both for existing call sites.
 */

/**
 * Every width the TMDB CDN will resize to.
 *
 * /configuration publishes a separate list per image kind — stills stop at w300,
 * backdrops start at w300 — but those lists are ADVISORY, not enforced. Verified
 * against the live CDN: poster widths (w342, w500) resolve on a backdrop path and
 * return correctly sized images. So one ladder serves every kind, and an episode
 * still is not stuck at 300px on a display that wants 500.
 */
export const TMDB_WIDTHS = [92, 154, 185, 300, 342, 500, 780, 1280];

export const tmdbImg = (path, quality = 'original') =>
  (path ? `https://image.tmdb.org/t/p/${quality}${path}` : null);

/**
 * A `srcset` across those widths, to be paired with a `sizes` describing the slot.
 *
 * Call sites used to hardcode one bucket each, which cannot be right on more than one
 * device: w342 into a 110px phone card is three times the pixels needed, and the same
 * w342 into a 300px card at 2x is half of them — over-fetched AND soft, from one
 * literal. Handing the browser the ladder lets it resolve width and pixel ratio itself.
 *
 * `min`/`max` trim the ladder to what a slot could plausibly want, so a thumbnail never
 * offers a 1280px candidate and a hero never offers a 92px one. Returns undefined for
 * a missing path so it can be spread straight onto an <img> without adding an
 * empty attribute.
 */
export const tmdbSrcSet = (path, { min = 92, max = 1280 } = {}) =>
  (path
    ? TMDB_WIDTHS
      .filter((w) => w >= min && w <= max)
      .map((w) => `https://image.tmdb.org/t/p/w${w}${path} ${w}w`)
      .join(', ') || undefined
    : undefined);
