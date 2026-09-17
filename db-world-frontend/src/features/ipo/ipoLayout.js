/**
 * The measure the IPO app is laid out to, in one place.
 *
 * <h2>Why there are two numbers rather than one</h2>
 * A cap does exactly one job: it stops a line of prose getting so long the eye loses its place
 * coming back to the start of the next one. It does nothing for a table, a chart, a stat row or a
 * card grid — those read better with the width.
 *
 * <p>An IPO detail page is both kinds of content at once, so a single page-level number cannot
 * serve it. It used to try: the page was capped at 1100, which squeezed the Overview's two-column
 * grid to about 515px a side (the financials table lives in one of them) while the only genuinely
 * long-form block on the page was still running past 140 characters a line. The cap was paying the
 * cost of protecting prose without actually protecting it.
 *
 * <p>So: {@link PAGE_MAX_W} bounds the page generously, for the sake of an ultrawide window rather
 * than for reading, and {@link PROSE_MAX_W} is applied by the handful of blocks that are actually
 * prose. Everything else on these pages is a grid and limits its own columns.
 */

/**
 * Page measure. 1500px keeps the list's card grid at four columns at the top end and leaves the
 * hero, toolbar and ad slot aligned to the same edge; past that a grid becomes a wall of cards.
 * Shared by the list, the detail page, its skeleton and My IPOs — those had three different
 * answers (1500, 1100 and none at all), so navigating between them changed the measure.
 */
export const PAGE_MAX_W = 1500;

/** Prose measure, for a block of running text inside the wide page. */
export const PROSE_MAX_W = 780;

/**
 * The page shell: clears the fixed app bar, insets the content, caps the measure, centres it.
 *
 * <p>`width: 100%` is load-bearing alongside `mx: auto`. These pages are a flex item of the app
 * shell's `<main>` column, and AUTO SIDE MARGINS CANCEL `align-items: stretch` — so without an
 * explicit width the Box shrink-wrapped its own max-content instead of the viewport, came out
 * 465px wide on a 390px phone, and gave the whole page a horizontal scrollbar.
 *
 * <p>Spread it and override what a page needs: `{ ...PAGE_SX, pb: 3 }`.
 */
export const PAGE_SX = {
  pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' },
  px: { xs: 2, sm: 3 },
  pb: 4,
  maxWidth: PAGE_MAX_W,
  width: '100%',
  mx: 'auto',
};
