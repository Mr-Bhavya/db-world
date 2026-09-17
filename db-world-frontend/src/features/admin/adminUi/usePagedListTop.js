import { useEffect, useRef } from 'react';
import { scrollRegionToTop } from '../../../app/scrollContainer';

/**
 * Puts the reader at the top of a list when its page changes.
 *
 * <h2>Replaced, not appended</h2>
 * Paging a table swaps every row for a different one. Staying where you were means opening page
 * two somewhere in the middle of it — reading row fifty of results whose first forty-nine you
 * have never seen, and with no sign that they exist. "Load more" is the opposite case: the rows
 * you were reading are still above you, so moving would be the bug. Hence a hook you opt into per
 * list rather than anything automatic.
 *
 * <p>Skips the first render. Arriving on a table is not a page change, and scrolling then would
 * fight whatever brought the reader here — a restored position, a deep link, an anchor.
 *
 * @param page the current page number. Any value that changes when the rows are replaced.
 * @param ref  the region to bring to the top — the table, not the page.
 */
export default function usePagedListTop(page, ref) {
  const seen = useRef(page);

  useEffect(() => {
    if (seen.current === page) return;
    seen.current = page;
    scrollRegionToTop(ref.current);
  }, [page, ref]);
}
