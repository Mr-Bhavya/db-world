/**
 * The measure a wide page is laid out to, for the whole site.
 *
 * <h2>A rising ceiling, not a fixed cap and not none</h2>
 * A cap does exactly one job: it stops a line of prose getting long enough that the eye loses its
 * place on the return sweep. It does nothing for a table, a chart, a stat row or a card grid, all
 * of which read better with the width they are given.
 *
 * <p>So a single fixed number cannot serve a page that is both kinds of content at once. A low one
 * wastes half a 27" monitor and most of a TV; no cap at all runs prose to two hundred characters a
 * line. The ceiling therefore RISES with the viewport, and the blocks that are genuinely prose
 * carry {@link PROSE_MAX_W} themselves.
 *
 * <p>Arrived at on the record detail page, which had it right first, and adopted by the IPO pages
 * after they spent a while on a flat 1500 (and before that a flat 1100, which squeezed the
 * financials column to about 515px while still letting the one long-form block run past 140
 * characters a line — paying a cap's cost without getting its benefit).
 */

/**
 * Past MUI's `xl`, where a monitor stops being wide and starts being a television.
 *
 * <p>A raw media query rather than a custom breakpoint: adding one to the theme renumbers every
 * `xl` in the codebase, and there are hundreds.
 */
export const ULTRAWIDE = '@media (min-width:1920px)';

/** Horizontal page padding, in theme spacing units. */
export const PAGE_PX = { xs: 2, md: 3, xl: 5 };
export const PAGE_PX_ULTRAWIDE = 8;

/** The page measure itself. `100%` below `lg`: a laptop has no width to spare. */
export const PAGE_MAX_W = { xs: '100%', lg: 1200, xl: 1560 };
export const PAGE_MAX_W_ULTRAWIDE = 1840;

/** A block of running text inside the wide page. */
export const PROSE_MAX_W = 780;

/**
 * Padding, measure and centring together — for the usual case where one element owns all three.
 *
 * <p>Where an element owns only one of them (a full-bleed hero pads its backdrop but measures its
 * content column separately), compose from the parts above instead.
 *
 * <p>`width: 100%` is load-bearing alongside `mx: auto` on a flex child. AUTO SIDE MARGINS CANCEL
 * `align-items: stretch` — without an explicit width the box shrink-wraps its own max-content
 * rather than the viewport, which once came out 465px wide on a 390px phone and gave the page a
 * horizontal scrollbar.
 */
export const PAGE_MEASURE_SX = {
  px: PAGE_PX,
  maxWidth: PAGE_MAX_W,
  width: '100%',
  mx: 'auto',
  [ULTRAWIDE]: { px: PAGE_PX_ULTRAWIDE, maxWidth: PAGE_MAX_W_ULTRAWIDE },
};
