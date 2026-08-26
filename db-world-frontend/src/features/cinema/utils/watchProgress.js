// Saved playback positions as something a progress bar can draw.
//
// Shared by the player's episode list and the record page's, so a half-watched
// episode reads the same in both places.

/**
 * A saved position as a 0..1 fraction. The last 5% counts as finished — the same
 * threshold the backend uses to drop a title from Continue Watching — so an episode
 * the viewer sat through doesn't show a bar with a sliver of credits left.
 */
export function watchedFraction({ positionMs, durationMs } = {}) {
  const pos = Number(positionMs) || 0;
  const dur = Number(durationMs) || 0;
  if (dur <= 0 || pos <= 0) return 0;
  const f = pos / dur;
  return f >= 0.95 ? 1 : Math.min(1, f);
}

/** GET /api/cinema/progress/record/{id} rows → { [fileId]: 0..1 }. */
export function progressByFile(rows) {
  return Object.fromEntries(
    (rows || []).map((r) => [String(r.fileId), watchedFraction(r)]),
  );
}

/**
 * How far through an EPISODE the viewer is, given a fileId→fraction map.
 *
 * An episode can be held in several masters and progress is keyed per FILE, so the
 * furthest of them is the honest answer: watching the 1080p copy means you've seen
 * that much of the episode, whichever file the row happens to offer.
 */
export function episodeProgress(progress, files) {
  let best = 0;
  for (const f of files || []) {
    const key = String(f?.id ?? f?.mediaFileId ?? '');
    const v = progress?.[key] ?? 0;
    if (v > best) best = v;
  }
  return best;
}
