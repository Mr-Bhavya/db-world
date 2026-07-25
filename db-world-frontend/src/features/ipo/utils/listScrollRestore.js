// Session-scoped signal pair that lets `IpoListPage` tell a genuine "back to the list
// from an IPO's detail page" apart from every other way of arriving there — header nav,
// a fresh load, a browser refresh, or `MyIposPage`'s own back button. Scroll restoration
// must only ever fire for the former; everything else should land at the top.
//
// `SCROLL_KEY` remembers where the list was scrolled to at the moment a card was opened.
// `RESTORE_FLAG_KEY` is a one-shot marker set only by the detail page's back action —
// its presence is what actually authorizes a restore; `SCROLL_KEY` alone is never enough
// (it would still be sitting in sessionStorage from an unrelated earlier visit otherwise).
const SCROLL_KEY = 'ipoListScrollY';
const RESTORE_FLAG_KEY = 'ipoListRestore';

const hasSessionStorage = () => typeof window !== 'undefined' && !!window.sessionStorage;

/** Call right before navigating from the list into an IPO's detail page. */
export function saveListScrollForBack() {
  if (!hasSessionStorage()) return;
  sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
}

/** Call right before the detail page's "Back to IPO Tracker" action navigates to the list. */
export function markListRestoreOnBack() {
  if (!hasSessionStorage()) return;
  sessionStorage.setItem(RESTORE_FLAG_KEY, '1');
}

/**
 * Call once, on the list page's mount (after it has something to scroll to). Consumes —
 * i.e. clears — both the flag and the saved value unconditionally, so neither can be
 * replayed by a later, unrelated visit. Returns the Y to scroll to when this really was
 * an in-app back-from-detail (falling back to 0 if nothing was saved); returns 0 for
 * every other entry path, telling the caller to reset to the top instead.
 */
export function consumeListScrollRestore() {
  if (!hasSessionStorage()) return 0;
  const shouldRestore = sessionStorage.getItem(RESTORE_FLAG_KEY) === '1';
  const saved = sessionStorage.getItem(SCROLL_KEY);
  sessionStorage.removeItem(RESTORE_FLAG_KEY);
  sessionStorage.removeItem(SCROLL_KEY);
  if (!shouldRestore) return 0;
  const y = saved != null ? parseInt(saved, 10) : 0;
  return Number.isFinite(y) && y > 0 ? y : 0;
}
