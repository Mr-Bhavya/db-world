/**
 * Opens the global search palette from anywhere in the app.
 *
 * The palette is owned by the header, which is mounted once; pages such as the home screen only
 * need a way to ask for it. A window event keeps them decoupled — no context provider to thread
 * through, and asking when no header is mounted is simply a no-op.
 */

export const OPEN_SEARCH_EVENT = 'dbw:open-search';

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

/** Subscribes to open requests; returns the unsubscribe function for an effect cleanup. */
export function onOpenSearch(handler) {
  window.addEventListener(OPEN_SEARCH_EVENT, handler);
  return () => window.removeEventListener(OPEN_SEARCH_EVENT, handler);
}
