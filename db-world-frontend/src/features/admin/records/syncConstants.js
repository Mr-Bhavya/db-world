// TMDB sync status → chip label + color (matches the sync-health strip on the Records page).
export const SYNC_META = {
  SUCCESS: { label: 'Synced',  color: '#10b981' },
  FAILED:  { label: 'Failed',  color: '#ef4444' },
  SKIPPED: { label: 'Skipped', color: '#6b7280' },
  RUNNING: { label: 'Running', color: '#f59e0b' },
};

// TMDB answered 404 for the title itself on its latest sync: deleted, or merged into another
// id. It outranks the status, which reads FAILED, or SKIPPED once the recheck gate passes it by.
export const NOT_ON_TMDB = {
  label: 'Not on TMDB',
  color: '#a855f7',
  short: 'Removed from TMDB — re-link or delete',
  hint:  'TMDB has removed this title, usually because it was merged into another entry. '
       + 'Use Edit to re-link it to the right TMDB id, or delete the record.',
};

/** Chip meta for a records-table row, or null when it has never synced. */
export const syncMeta = (row) =>
  row?.tmdbNotFound ? NOT_ON_TMDB : (SYNC_META[row?.syncStatus] ?? null);
