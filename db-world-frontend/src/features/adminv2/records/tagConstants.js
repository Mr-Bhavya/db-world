export const ALL_TAGS = [
  'TRENDING',
  'TOP_10',
  'FEATURED',
  'EDITOR_PICK',
  'RECENTLY_ADDED',
  'AVAILABLE_FOR_DOWNLOAD',
];

/** Tags auto-assigned by the scheduler — admins cannot add/remove these. */
export const AUTO_TAGS = new Set([
  'TRENDING',
  'TOP_10',
  'FEATURED',
  'RECENTLY_ADDED',
]);

/** Tags admins can assign/remove manually. */
export const MANUAL_TAGS = ALL_TAGS.filter(t => !AUTO_TAGS.has(t));

export const TAG_COLORS = {
  TRENDING:               '#ef4444',
  TOP_10:                 '#ec4899',
  FEATURED:               '#f59e0b',
  EDITOR_PICK:            '#8b5cf6',
  RECENTLY_ADDED:         '#06b6d4',
  AVAILABLE_FOR_DOWNLOAD: '#22c55e',
};

export const TAG_LABELS = {
  TRENDING:               'Trending',
  TOP_10:                 'Top 10',
  FEATURED:               'Featured',
  EDITOR_PICK:            'Editor Pick',
  RECENTLY_ADDED:         'Recently Added',
  AVAILABLE_FOR_DOWNLOAD: 'Available for Download',
};
