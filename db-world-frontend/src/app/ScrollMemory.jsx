import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import {
  getScrollContainer, growthTarget, readScroll, reachableScroll, scrollSource,
  scrollToOffset, scrollToTop, subscribeScrollContainer,
} from './scrollContainer';

/**
 * Where each page was left, and where each new one starts — for the whole app, once.
 *
 * <h2>Why the browser cannot do this for us</h2>
 * It tries. {@code history.scrollRestoration} defaults to {@code auto}, and on a server-rendered
 * site that is enough. Here every route is a lazily-loaded chunk that then fetches its own data,
 * so at the moment the browser restores the offset the page is a few hundred pixels of skeleton —
 * the scroll clamps to whatever little there is, the content arrives a beat later, and the reader
 * is at the top of a list they were forty rows into. Nothing puts it back, because as far as the
 * browser is concerned it already did its job.
 *
 * <h2>Why there is exactly one of these</h2>
 * There used to be four. The cinema page kept positions in {@code sessionStorage}; the IPO list
 * had its own one-shot store; the record detail had a third; two more pages simply forced the top.
 * Each fired on its own trigger — usually "80ms after my data loaded" — and pages nobody had got
 * round to had nothing at all. That is why it worked in some places and not others, and why
 * adding an app-wide one made it worse rather than better: on the IPO list this restored the
 * reader's position and the page's own copy overwrote it with zero a moment later.
 *
 * <p>So the per-page versions are gone and this is the only one. Which means it has to be good
 * enough to replace them: it waits for content rather than guessing at a delay, it follows the
 * scroller the layout nominates rather than assuming the window, and it gets out of the way the
 * moment the reader takes over.
 *
 * <h2>The rules</h2>
 * <ul>
 *   <li><b>Back and forward</b> ({@code POP}) restore.</li>
 *   <li><b>A new page</b> ({@code PUSH}/{@code REPLACE}) starts at the top.</li>
 *   <li><b>Staying on the same path</b> changes nothing — a query string the page owns, or a
 *       history entry pushed so Back can close an overlay.</li>
 *   <li><b>An overlay over a preserved page</b> ({@code state.background}) is left alone.</li>
 *   <li><b>A hash</b> is an instruction to scroll somewhere specific, and the top is not it.</li>
 * </ul>
 *
 * <p>Positions are keyed on {@code location.key}, not the path: two visits to the same list are
 * two different places to be.
 */

/** Long enough for a lazy chunk and its first fetch; short enough not to pounce much later. */
const RESTORE_BUDGET_MS = 5000;

/**
 * How long the arriving page may be held back while it is positioned.
 *
 * <p>Deliberately much shorter than the restore budget. Holding is a trick for hiding one bad
 * frame, not a loading strategy — past about this long the reader deserves to see something, even
 * if it means they also see the jump.
 */
const HOLD_MS = 400;

/*
 * Hide the arriving page until it has been put back where the reader left it.
 *
 * On Back into a page whose data is refetched, the sequence is: short skeleton paints at the top,
 * data lands, the page grows, we scroll to the saved offset. The reader sees the top of the list
 * for a frame and then a jump -- which reads as a flicker, or as the page having reloaded itself.
 * Restoring earlier is not possible: at that first paint there is nothing tall enough to scroll.
 *
 * So the one bad frame is not shown. A fade rather than `visibility`, because a hard cut to
 * content reads as a flash of its own; 120ms of opacity reads as the page arriving.
 */
function hold(element) {
  const node = element ?? document.body;
  node.style.transition = 'opacity 120ms ease';
  node.style.opacity = '0';
}

function release(element) {
  const node = element ?? document.body;
  node.style.opacity = '';
  // Left on the element for the length of the fade, then cleared, so nothing else inherits a
  // transition it did not ask for.
  window.setTimeout(() => { node.style.transition = ''; }, 160);
}

export default function ScrollMemory() {
  const location = useLocation();
  const navigationType = useNavigationType();

  const [container, setContainer] = useState(getScrollContainer);
  useEffect(() => subscribeScrollContainer(setContainer), []);

  const positions = useRef(new Map());
  const currentKey = useRef(location.key);
  const currentPath = useRef(location.pathname);
  const samePage = useRef(false);
  // Set while we are the ones scrolling, so the listener below can tell our own restore from the
  // reader deciding to go somewhere else.
  const restoring = useRef(false);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  // Sampled continuously rather than read once on the way out. A page can be torn down before an
  // unmount handler gets to look, and on mobile a tab can be discarded with no unmount at all.
  useEffect(() => {
    const source = scrollSource(container);
    const onScroll = () => {
      positions.current.set(currentKey.current, readScroll(container));
    };
    source.addEventListener('scroll', onScroll, { passive: true });
    return () => source.removeEventListener('scroll', onScroll);
  }, [container]);

  /*
   * Which entry we are on, updated in a LAYOUT effect, and that is load-bearing.
   *
   * Leaving a 7000px list for a short detail page shrinks the document, and the browser responds
   * by clamping the scroll offset to whatever is left — usually zero — and firing a scroll event
   * for it. That event is not the reader scrolling. It arrives after the DOM has changed but
   * before any ordinary effect, so with the key still pointing at the list the listener above
   * dutifully files "0" as where the reader had got to, wiping the real position a moment before
   * anything tries to save it. Every restore then lands at the top.
   *
   * A layout effect runs inside the commit, ahead of that scroll event, so by the time the clamp
   * is reported the key has already moved on and the bogus zero is filed against the page that is
   * genuinely at zero.
   */
  useLayoutEffect(() => {
    samePage.current = currentPath.current === location.pathname;
    currentKey.current = location.key;
    currentPath.current = location.pathname;
  }, [location.key, location.pathname]);

  /*
   * A LAYOUT effect, so a page whose content is already there is restored BEFORE it is painted.
   *
   * Run after paint, the reader sees the page at the top for one frame and then jump -- which
   * reads as a flicker, or as the page having reloaded itself. Most Back navigations land on
   * cached data and are tall immediately, so the common case can be silent; the observer below
   * is only for the ones that are not.
   */
  useLayoutEffect(() => {
    if (location.hash || location.state?.background) return undefined;

    /*
     * An overlay closing is a return, not a new page.
     *
     * A record detail opens over the cinema page and closes by REPLACING its own history entry
     * with the page underneath -- a plain pop would only unwind one entry, so a record opened
     * from a person view would re-surface the person view instead of returning to cinema. Which
     * means Back is the ONLY dismissal that pops: the close button, the backdrop, Escape and the
     * swipe-to-dismiss all arrive here as a replace onto a different path, and were being read
     * as "somewhere new" and sent to the top. Back worked; nothing else did.
     *
     * The closer says what it is doing and names the entry it is returning to, so this restores
     * the position of THAT visit rather than wherever the path happened to be left last.
     */
    const returningTo = location.state?.restoreScrollKey;
    const target = navigationType === 'POP'
      ? positions.current.get(location.key)
      : positions.current.get(returningTo);

    if (!target) {
      // Genuinely new: top. A same-path navigation and a failed restore both leave it alone,
      // because moving the reader on the strength of a position we do not have is worse than
      // leaving them where the browser put them.
      if (navigationType !== 'POP' && !samePage.current && !returningTo) scrollToTop(container);
      return undefined;
    }

    /*
     * Wait for the page to be tall enough to hold the offset, then put the reader back.
     *
     * A single scrollTo here lands on a skeleton and is silently clamped to nearly zero, which is
     * the bug this file exists for. A fixed delay — which is what every page-local version used —
     * is a guess that is too short on a cold chunk and too long on a warm one.
     *
     * Three ways out, and all three matter. The content grows enough: restore. The reader scrolls
     * first: leave them alone, because yanking somebody who has started reading is worse than
     * forgetting where they were. Neither happens within the budget: give up quietly rather than
     * scrolling to a clamped position that is not where they were either.
     */
    const source = scrollSource(container);
    let settled = false;
    let observer;
    let timer;
    let holdTimer;
    let held = false;

    // `finish` detaches the listener and the listener calls `finish`, so one of them has to be
    // reachable before the other exists. The indirection is that seam, and it is cheaper than
    // hoisting tricks that only work until somebody reorders the file.
    let stopListening = () => {};

    const finish = () => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      clearTimeout(timer);
      clearTimeout(holdTimer);
      stopListening();
      if (held) { held = false; release(container); }
    };

    const onUserScroll = () => {
      if (restoring.current) return;
      finish();
    };
    stopListening = () => source.removeEventListener('scroll', onUserScroll);

    const tryRestore = () => {
      if (settled) return;
      if (reachableScroll(container) < target) return;
      restoring.current = true;
      scrollToOffset(container, target);
      positions.current.set(location.key, target);
      // Cleared next frame, once our own scroll event has been and gone.
      requestAnimationFrame(() => { restoring.current = false; });
      finish();
    };

    source.addEventListener('scroll', onUserScroll, { passive: true });
    observer = new ResizeObserver(tryRestore);
    observer.observe(growthTarget(container));
    timer = setTimeout(finish, RESTORE_BUDGET_MS);

    // Try first: a page whose data is already cached is tall in this very commit, restores before
    // it is ever painted, and never needs hiding at all.
    tryRestore();

    if (!settled) {
      held = true;
      hold(container);
      holdTimer = setTimeout(() => {
        if (!held) return;
        held = false;
        release(container);
      }, HOLD_MS);
    }

    return finish;
  }, [
    location.key, location.hash, location.state?.background,
    location.state?.restoreScrollKey, navigationType, container,
  ]);

  return null;
}
