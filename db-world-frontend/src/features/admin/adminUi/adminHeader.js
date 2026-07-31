/**
 * Single-header model: the admin TOP BAR is the only header. Each page registers
 * its title / icon / actions / refresh here; the top bar renders them. No big
 * per-page header, no duplicate title, less vertical space (better on mobile).
 *
 * Implemented as a tiny external store (not context) so a page WRITING its header
 * never re-renders itself — only the top bar (the reader) updates. That avoids the
 * render→setState→render loop a context+effect would cause with inline `actions`.
 */
import { useEffect, useSyncExternalStore } from 'react';

let current = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

const setAdminHeader = (h) => { current = h; emit(); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => current;

/** Read the active page header — used by the admin top bar. */
export const useAdminHeaderValue = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/**
 * Register this page's header into the top bar. Updated every render so live
 * values (refreshing spinner, dynamic actions) stay fresh; cleared on unmount so
 * a route change resets it (non-migrated pages fall back to the breadcrumb title).
 */
export const useAdminHeader = (header) => {
  useEffect(() => { setAdminHeader(header); });           // keep fresh each render
  useEffect(() => () => setAdminHeader(null), []);        // clear on unmount only
};
