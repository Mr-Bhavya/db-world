/**
 * The IPO app's page shell.
 *
 * <p>The measure itself lives in {@link module:shared/layout/pageMeasure} and is shared with the
 * record detail page, so a 27" monitor is treated the same in both. What is specific to these
 * pages is only the clearance for the fixed app bar.
 *
 * <p>History, because the numbers moved twice: the detail page was capped at 1100 and the list at
 * 1500, with My IPOs uncapped, so navigating between the three changed the measure. 1100 squeezed
 * the Overview's two-column grid to about 515px a side -- the financials table in one of them --
 * while the one genuinely long-form block on the page still ran past 140 characters a line. A flat
 * 1500 fixed that page and still left a television half empty, hence the rising ceiling.
 */
import { PAGE_MEASURE_SX, PROSE_MAX_W } from '@shared/layout/pageMeasure';

export { PROSE_MAX_W };

/**
 * The page shell: clears the fixed app bar, then the shared measure.
 *
 * <p>Spread it and override what a page needs: `{ ...PAGE_SX, pb: 3 }`.
 */
export const PAGE_SX = {
  pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' },
  pb: 4,
  ...PAGE_MEASURE_SX,
};
