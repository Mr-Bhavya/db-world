/**
 * Recently-watched live channels, per device.
 *
 * <p>Deliberately local: a channel list is not user-scoped state worth a table and a
 * round trip, and "the last few things I watched" is the one piece of personalisation a
 * live-TV grid genuinely needs — with thousands of channels, getting back to the five
 * you actually watch is the whole navigation problem.
 */
const KEY = 'dbworld:live:recent';
const MAX = 12;

/** @returns {string[]} channel ids, most recent first */
export function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];   // private mode, or someone hand-edited it
  }
}

/** Move `channelId` to the front, capped at {@link MAX}. */
export function pushRecent(channelId) {
  if (!channelId) return;
  try {
    const next = [channelId, ...readRecent().filter((id) => id !== channelId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not being able to remember is not worth breaking playback over.
  }
}

export function clearRecent() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
