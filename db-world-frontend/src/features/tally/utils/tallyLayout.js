/**
 * The frame every Tally page shares.
 *
 * <p>One set of numbers rather than one per page, because the pages disagreed: the list was
 * 1060px wide, a one-to-one ledger 760 and a group 1080, so opening a ledger from the list
 * narrowed the whole screen by 300px on a desktop and the pinned bar (always 1080) no longer
 * lined up with the page under it. Moving between Tally screens should change what is in the
 * columns, never where the columns are.
 */

/** Reading width on phones and tablets, the shared two-column width from md up. */
export const TALLY_PAGE_MAX_W = { xs: 760, md: 1080 };

/** Page gutters, which the fixed pinned bar has to repeat to line up with the page. */
export const TALLY_PAGE_PX = { xs: 2, sm: 3, md: 4 };

/** Clears the fixed app bar: 56px on a phone, 64px from md up. */
export const TALLY_PAGE_PT = { xs: 'calc(56px + 16px)', md: 'calc(64px + 24px)' };

/**
 * What you scroll | what you glance at, from md up. The same split on the list and inside a
 * ledger, so the main column keeps its width when you go from one to the other.
 */
export const TALLY_COLUMNS = 'minmax(0, 1.5fr) minmax(0, 1fr)';
