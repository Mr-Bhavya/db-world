function sameJob(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merges a fresh WS snapshot into the previous jobs map, reusing the previous object for every
 * job whose content is unchanged. Memoised cards selecting `jobs[id]` then skip re-rendering.
 * Returns `prev` itself when nothing changed at all.
 */
export function mergeJobs(prev, next) {
  const incoming = next && typeof next === 'object' ? next : {};
  const base = prev || {};
  let changed = Object.keys(base).length !== Object.keys(incoming).length;
  const out = {};
  for (const [id, job] of Object.entries(incoming)) {
    if (sameJob(base[id], job)) {
      out[id] = base[id];
    } else {
      out[id] = job;
      changed = true;
    }
  }
  return changed ? out : base;
}
