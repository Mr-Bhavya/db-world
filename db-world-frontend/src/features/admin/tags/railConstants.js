export const PAGE_TYPES  = ['HOME', 'MOVIES', 'SERIES'];
export const BLANK_RULE = { type: 'tag', tag: 'TRENDING', genreId: null, languages: [], field: '', value: '', recordType: '', sort: 'popularity', direction: 'DESC' };
export const BLANK_RAIL = { title: '', priority: 0, limitSize: 20, infiniteScroll: true, active: true, pageTypes: ['HOME'], displayType: '', imageVariant: '', rule: { ...BLANK_RULE } };

// Which image the cards use. '' = Auto (per display-type default).
export const IMAGE_VARIANTS = [
  { value: '',             label: 'Auto' },
  { value: 'WITH_TEXT',    label: 'With text (title art)' },
  { value: 'WITHOUT_TEXT', label: 'Without text (clean)' },
];

// Card display types selectable per rail. '' = Auto (client derives from rule
// type — continueWatching/person — else responsive default: mobile poster / desktop 16:9).
export const DISPLAY_TYPES = [
  { value: '',            label: 'Auto (default)' },
  { value: 'standard',    label: 'Standard — 16:9 (poster on mobile)' },
  { value: 'landscape',   label: 'Landscape — 16:9 (all screens)' },
  { value: 'wide',        label: 'Wide — 16:9' },
  { value: 'poster',      label: 'Poster' },
  { value: 'posterPlain', label: 'Poster (no title)' },
  { value: 'prime',       label: 'Prime' },
  { value: 'jumbo',       label: 'Jumbo' },
  { value: 'top10',       label: 'Top 10 (ranked)' },
  { value: 'billboard',   label: 'Billboard' },
];

// Sub-tab keys for the Rails Tab. A rail appears under EVERY tab its pageTypes
// includes (a HOME+SERIES rail shows under both Home and Series) — there's no
// separate "All" bucket; multi-page rails are driven purely by their pageTypes.
export const RAIL_SCOPE_TABS = [
  { key: 'HOME',   label: 'Home'   },
  { key: 'MOVIES', label: 'Movies' },
  { key: 'SERIES', label: 'Series' },
];
