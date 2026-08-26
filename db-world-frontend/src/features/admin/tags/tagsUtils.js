/**
 * Shared MUI text-field / select styling for this page's dialogs. A factory taking the theme
 * rather than a module-level constant, so it is still resolved per-render from useT().
 */
export const adminInputSx = (T, S) => ({
  '& .MuiOutlinedInput-root': {
    bgcolor: T.inputBg, color: T.textPrimary,
    '& fieldset':             { borderColor: S.border },
    '&:hover fieldset':       { borderColor: T.borderHover },
    '&.Mui-focused fieldset': { borderColor: T.teal },
  },
  '& .MuiInputLabel-root':             { color: T.textMuted },
  '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
  '& .MuiSelect-icon':                 { color: T.textMuted },
  '& .MuiFormHelperText-root':         { color: T.textFaint, mt: '2px' },
});

/** Returns the rail's pageTypes array (or empty when missing). */
export function railPageTypes(rail) {
  return Array.isArray(rail?.pageTypes) ? rail.pageTypes : [];
}

/** True if the rail is configured to appear on the given page (sub-tab). */
export function railOnPage(rail, page) {
  return railPageTypes(rail).includes(page);
}

// Sort options come from GET /tags/rail-metadata as [{ value, label }] — the labels live in
// RailSortBuilder.FIELD_LABELS next to the JPQL paths, so adding a sort field is a backend-only
// change. There used to be a duplicate label map here and it drifted.
//
// Reads a label out of that list, falling back to the raw value for anything unlisted (e.g. a
// legacy releaseDate/firstAirDate still stored on an old rail).
export const sortLabelFrom = (sortFields, value) =>
  sortFields.find(f => f.value === value)?.label ?? value ?? '—';

// Compact "when did the scheduler last run this tag" for the config table. 'never' means
// the strategy has not run since the tag was seeded — on an ON tag that points at the
// scheduler job being stalled or disabled, not at the tag config.
export const fmtLastRefreshed = (ts) => {
  if (!ts) return 'never';
  const then = new Date(ts);
  if (Number.isNaN(then.getTime())) return '—';
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : then.toLocaleDateString();
};
