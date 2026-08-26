/**
 * Media-request scopes.
 *
 * A request used to be per record, which says nothing useful about a series: "needs files
 * for Breaking Bad" is unactionable when seasons 1-3 are already in the library. A request
 * now carries a scope — the whole title, one season, or one episode — and the detail page
 * holds one entry per pending scope keyed by these helpers.
 *
 * `null` season/episode means "not scoped to one" on the wire; the backend stores a -1
 * sentinel so MySQL can keep the (record, kind, season, episode) key unique.
 */

export const DEFAULT_KIND = 'NEW_FILES';

/** Stable key for a scope. `*` stands for "not scoped", which `null` can't do inside a string. */
export const requestScopeKey = ({ kind = DEFAULT_KIND, season = null, episode = null } = {}) =>
  `${kind}|${season ?? '*'}|${episode ?? '*'}`;

/** Index a `/media-requests/record/{id}` payload by scope key. */
export function indexRequests(list) {
  const index = new Map();
  for (const r of list ?? []) {
    if (!r) continue;
    index.set(requestScopeKey(r), r);
  }
  return index;
}

/**
 * The pending request that already speaks for this episode, narrowest first: the episode's
 * own request, then its season's, then one for the whole title. Used to say "in your Season 2
 * request" instead of offering a second button that would ask for the same thing again.
 */
export function coveringRequest(index, { kind = DEFAULT_KIND, season = null, episode = null } = {}) {
  if (!index) return null;
  const candidates = [];
  if (season != null && episode != null) candidates.push({ kind, season, episode });
  if (season != null) candidates.push({ kind, season });
  candidates.push({ kind });
  for (const scope of candidates) {
    const hit = index.get(requestScopeKey(scope));
    if (hit) return hit;
  }
  return null;
}

/**
 * Fold a vote response back into a cached list so the count is the server's, not a guess.
 * A response with no votes left means the row was pruned, so it drops out of the list.
 */
export function applyVote(list, res) {
  if (!res) return list ?? [];
  const key = requestScopeKey(res);
  const rest = (list ?? []).filter((r) => requestScopeKey(r) !== key);
  return res.voteCount > 0 ? [...rest, res] : rest;
}

/** " Season 2" / "" — a suffix for toast copy, empty for a whole-title request. */
export function scopeSuffix(scopeLabel) {
  return !scopeLabel || scopeLabel === 'All' ? '' : ` ${scopeLabel}`;
}
