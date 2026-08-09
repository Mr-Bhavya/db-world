// Record publish/visibility lifecycle — mirrors the backend RecordVisibility enum.
// DRAFT: admin-only, not public, no push. PUBLISHED: live everywhere (rails + search + detail).
// UNLISTED: searchable + direct link only, kept off the rails (18+ / library-only deep cuts).
export const VISIBILITY_META = {
  DRAFT:     { label: 'Draft',     color: '#f59e0b', desc: 'Admin-only — not public, no notification.' },
  PUBLISHED: { label: 'Published', color: '#10b981', desc: 'Live everywhere — rails, search and detail.' },
  UNLISTED:  { label: 'Unlisted',  color: '#6b7280', desc: 'Searchable + direct link only — off the rails.' },
};

/** Menu / selector order. */
export const VISIBILITY_ORDER = ['DRAFT', 'PUBLISHED', 'UNLISTED'];

/** Safe lookup that falls back to DRAFT for a null/unknown value. */
export const visibilityMeta = (v) => VISIBILITY_META[v] ?? VISIBILITY_META.DRAFT;
