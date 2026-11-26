/**
 * Recently opened search results, kept in localStorage so the palette's empty state is useful.
 *
 * Only plain, serialisable fields are stored; icons and accents are resolved again from the
 * result's group when rendered. The list functions are pure so they can be tested directly.
 */

const STORAGE_KEY = 'dbw.search.recent';
export const MAX_RECENTS = 6;

const STORED_FIELDS = ['key', 'group', 'label', 'detail', 'route', 'poster'];

/** Puts {@code item} first, drops any older copy of it, and caps the list. */
export function addRecent(list, item, max = MAX_RECENTS) {
  if (!item?.key || !item?.route) return list ?? [];
  const entry = Object.fromEntries(
    STORED_FIELDS.filter((field) => item[field] != null).map((field) => [field, item[field]])
  );
  return [entry, ...(list ?? []).filter((existing) => existing.key !== item.key)].slice(0, max);
}

/** Tolerates anything a previous build, an extension or a hand edit may have left behind. */
export function parseRecents(raw) {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.key === 'string' && typeof item.route === 'string')
          .slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

export function loadRecents() {
  try {
    return parseRecents(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRecents(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private mode or a full quota: recents are a convenience, never worth an error.
  }
}

export function clearRecents() {
  saveRecents([]);
}
