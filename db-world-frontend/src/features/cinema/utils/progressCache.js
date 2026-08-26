// Local mirror of watch progress.
//
// The server is the record of truth ACROSS devices; this is the record of truth for
// "where was I, on this device, a moment ago". Writing here is free and synchronous, so
// the player can note its position often and talk to the API rarely — which is what lets
// the network save drop to a slow heartbeat without a crash costing you your place.
//
// One localStorage key holds a { fileId: entry } map so the whole thing can be pruned in
// one write; per-file keys would leak an unbounded number of them.

const KEY = 'dbworld:player:progress';
const MAX_ENTRIES = 120;      // ~a season of a show per device; oldest are dropped first

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};   // corrupt or unavailable (private mode) — behave as if empty
  }
}

/** Saved position for one file, or null. `at` is epoch ms, for resolving against the server. */
export function readCachedProgress(fileId) {
  if (!fileId) return null;
  const e = readAll()[String(fileId)];
  return (e && e.positionMs > 0) ? e : null;
}

export function writeCachedProgress(fileId, { positionMs, durationMs = 0 } = {}) {
  if (!fileId || !(positionMs > 0)) return;
  try {
    const all = readAll();
    all[String(fileId)] = {
      positionMs: Math.round(positionMs),
      durationMs: Math.round(durationMs) || 0,
      at: Date.now(),
    };

    // Prune oldest-first so a heavy viewer's cache can't grow without bound.
    const ids = Object.keys(all);
    if (ids.length > MAX_ENTRIES) {
      ids.sort((a, b) => (all[a]?.at ?? 0) - (all[b]?.at ?? 0))
        .slice(0, ids.length - MAX_ENTRIES)
        .forEach((id) => delete all[id]);
    }
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // A full or unavailable store must never interrupt playback.
  }
}

export function clearCachedProgress(fileId) {
  if (!fileId) return;
  try {
    const all = readAll();
    delete all[String(fileId)];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/**
 * Reconcile the local entry with the server's.
 *
 * Newest wins rather than furthest-along: finishing an episode on the phone and
 * restarting it here should not be overruled by a stale local position, and "I watched
 * more on another device" should win over what this one last saw. Ties go to the server,
 * which is the cross-device answer.
 */
export function mergeProgress(local, server) {
  const localAt  = Number(local?.at) || 0;
  const serverAt = server?.updatedAt ? Date.parse(server.updatedAt) || 0 : 0;
  if (!local)  return server ?? null;
  if (!server) return local;
  return localAt > serverAt ? local : server;
}
