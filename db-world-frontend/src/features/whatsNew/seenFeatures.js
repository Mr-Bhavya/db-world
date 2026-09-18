import { useSyncExternalStore } from 'react';

/**
 * Which feature announcements this device has already seen.
 *
 * <p>Per device, in localStorage: the announcement has to work for signed-out visitors —
 * the public Live TV grid is aimed squarely at them — and a server-side flag cannot.
 * The cost is that someone using the website and the Android app sees it once in each.
 *
 * <p>Reactive via {@link useSyncExternalStore} rather than a context: the "New" badges
 * live in the header's Apps panel and the hub's Quick Launch tile, nowhere near the
 * dialog that dismisses them, and threading a provider between them to flip a boolean
 * would be more plumbing than the feature is worth.
 */
const KEY = 'dbworld:whatsNew:seen';

const listeners = new Set();

/** Cached so getSnapshot can return a stable reference — a fresh array every call would loop. */
let cache = null;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];   // private mode, or hand-edited
  }
}

function snapshot() {
  if (cache === null) cache = load();
  return cache;
}

function emit(next) {
  cache = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @returns {string[]} ids already seen on this device */
export function readSeen() {
  return snapshot();
}

export function hasSeen(id) {
  return snapshot().includes(id);
}

/** Record one or more announcement ids as seen. No-op for ids already recorded. */
export function markSeen(...ids) {
  const flat = ids.flat().filter(Boolean);
  const current = snapshot();
  const next = [...new Set([...current, ...flat])];
  if (next.length === current.length) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Can't persist (private mode). Still emit, so the badge clears for this session
    // rather than sitting there after the user has plainly seen the thing.
  }
  emit(next);
}

/** Testing / "show me again" affordance. */
export function resetSeen() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  emit([]);
}

/**
 * Subscribe a component to the seen set.
 *
 * @returns {{ seen: string[], isSeen: (id: string) => boolean, isNew: (id: string) => boolean }}
 */
export function useSeenFeatures() {
  const seen = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    seen,
    isSeen: (id) => seen.includes(id),
    isNew: (id) => Boolean(id) && !seen.includes(id),
  };
}
