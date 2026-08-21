/**
 * Tag chip colours — the one piece of tag metadata the backend does NOT own.
 *
 * Everything else about a tag (which tags exist, their labels, whether they are automatic)
 * comes from `GET /api/cinema/admin/tags/definitions` via `useTagDefs`. There used to be
 * ALL_TAGS / AUTO_TAGS / MANUAL_TAGS / TAG_LABELS lists here too, and they silently drifted
 * out of sync with the backend enum — NEW_SEASON and NEW_EPISODE were missing, so they could
 * not be picked for a rail and rendered with an undefined colour. Don't reintroduce them.
 */

/** Explicit colours for the long-standing tags, so their chips stay visually stable. */
const KNOWN_TAG_COLORS = {
  TRENDING:               '#ef4444',
  TOP_10:                 '#ec4899',
  FEATURED:               '#f59e0b',
  EDITOR_PICK:            '#8b5cf6',
  RECENTLY_ADDED:         '#06b6d4',
  AVAILABLE_FOR_DOWNLOAD: '#22c55e',
  NEW_SEASON:             '#3b82f6',
  NEW_EPISODE:            '#14b8a6',
};

/** Palette any tag without an explicit colour is assigned from. */
const FALLBACK_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#ec4899', '#06b6d4', '#8b5cf6', '#f97316',
];

/**
 * Deterministic colour for a tag type. A brand-new tag added on the backend gets a stable
 * colour with no frontend change — derived from the name, so it does not shift between
 * renders, sessions, or the order the tags happen to arrive in.
 */
export function tagColorFor(tagType) {
  if (!tagType) return FALLBACK_COLORS[0];
  if (KNOWN_TAG_COLORS[tagType]) return KNOWN_TAG_COLORS[tagType];

  let hash = 0;
  for (let i = 0; i < tagType.length; i++) {
    hash = (hash * 31 + tagType.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

/** Human-readable fallback for a tag with no displayName from the API yet. */
export const humanizeTagType = (tagType) =>
  (tagType ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
