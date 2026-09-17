/**
 * Which element the page actually scrolls in.
 *
 * <h2>Why this is not always the window</h2>
 * Most of the app scrolls the document, and {@code window.scrollY} is the whole story. The admin
 * section does not: {@code AdminLayout} is a full-height flex shell whose main pane carries
 * {@code overflowY: auto}, so the document never scrolls at all and {@code window.scrollY} is
 * permanently zero. Anything trying to remember a position there records zero, restores zero, and
 * looks like it was never wired up — which is exactly what it did.
 *
 * <p>So a layout that owns its own scrolling says so, and {@link ScrollMemory} reads and writes
 * that element instead. One registration at a time, because one thing is scrolling at a time;
 * registering replaces whatever was there and unmounting clears it back to the window.
 */
let current = null;
const subscribers = new Set();

function announce() {
  subscribers.forEach((notify) => notify(current));
}

/** Declares `element` the scroller until the returned function is called. */
export function registerScrollContainer(element) {
  current = element ?? null;
  announce();
  return () => {
    if (current !== element) return;
    current = null;
    announce();
  };
}

/** The registered scroller, or null when the document is the scroller. */
export function getScrollContainer() {
  return current;
}

export function subscribeScrollContainer(notify) {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}

/* ============================== reading and writing ============================== */

export function readScroll(element) {
  return element ? element.scrollTop : window.scrollY;
}

export function scrollToTop(element) {
  // `instant` overrides a CSS `scroll-behavior: smooth`, which would otherwise animate the jump
  // on every navigation.
  if (element) element.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

export function scrollToOffset(element, top) {
  if (element) element.scrollTo({ top, left: 0, behavior: 'instant' });
  else window.scrollTo({ top, left: 0, behavior: 'instant' });
}

/** How far down it is possible to scroll right now. */
export function reachableScroll(element) {
  if (element) return element.scrollHeight - element.clientHeight;
  return document.documentElement.scrollHeight - window.innerHeight;
}

/** What to listen to for scroll events, and what to watch for growth. */
export function scrollSource(element) {
  return element ?? window;
}

export function growthTarget(element) {
  return element ?? document.documentElement;
}

/**
 * Bring the top of a region to the top of whatever is scrolling it.
 *
 * <p>For a list whose contents were <b>replaced</b> — the next page of a table — rather than
 * appended. Page two starting wherever page one ended means the reader is looking at row 50 of
 * results they have never seen the start of; with "load more" the old rows are still above them
 * and staying put is correct, which is why this is called explicitly rather than wired to every
 * list.
 *
 * <p>The top of the <em>region</em>, not of the page: jumping to the very top would push the page
 * heading, the filters and the toolbar back into view on every click, and somebody paging through
 * six pages would scroll past all of it six times.
 *
 * <p>Does nothing when the region's top is already on screen. On a short table the pager and the
 * first row are visible together, and moving then is movement for no reason.
 */
export function scrollRegionToTop(element, offset = 0) {
  if (!element) return;

  // A region that scrolls inside itself -- a TableContainer with its own maxHeight and a sticky
  // header -- keeps the reader's offset in its own scrollTop, where nothing outside it can see.
  // Bringing its top into view would leave them halfway down the new page's rows regardless.
  if (element.scrollHeight > element.clientHeight + 1) element.scrollTop = 0;

  const container = getScrollContainer();
  const containerTop = container ? container.getBoundingClientRect().top : 0;
  const delta = element.getBoundingClientRect().top - containerTop - offset;

  // Already at or below the top edge: visible, so leave it alone.
  if (delta >= 0) return;

  // Instant, not smooth. A smooth scroll across a few thousand pixels takes half a second and
  // reads as the page sliding away -- and it compounds for somebody clicking Next repeatedly.
  const target = container ?? window;
  target.scrollBy({ top: delta, left: 0, behavior: 'instant' });
}
