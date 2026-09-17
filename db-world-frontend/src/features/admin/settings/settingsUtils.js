/**
 * Settings page helpers — matching, diffing and value coercion. No React, no MUI,
 * so the filtering rules stay testable on their own.
 */

/** Everything is stored as a string server-side; compare as strings or 5 !== "5". */
export const asText = (v) => (v == null ? '' : String(v));

/** A setting the admin has moved off the value the catalog ships with. */
export const isModified = (s) => asText(s?.value) !== asText(s?.defaultValue);

export const isBoolean = (s) => s?.valueType === 'BOOLEAN';
export const isNumeric = (s) => s?.valueType === 'INTEGER' || s?.valueType === 'LONG';

/** Booleans arrive as the strings "true"/"false"; Switch needs a real boolean. */
export const asBool = (v) => v === true || v === 'true';

/**
 * Does this setting match a free-text query?
 *
 * Searches the key as well as the label and description: an admin who knows a
 * setting as `ingestion.storyboard.enabled` from a log line or a config file should
 * not have to guess that it is labelled "Storyboard generation".
 */
export function matchesQuery(s, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${s?.label ?? ''} ${s?.description ?? ''} ${s?.key ?? ''}`.toLowerCase().includes(q);
}

/**
 * Applies the search box and the "modified only" toggle to the API's category list,
 * dropping categories that end up empty so the rail never offers a dead entry.
 *
 * @returns {{category: string, settings: object[]}[]}
 */
export function filterCategories(categories, { query = '', modifiedOnly = false } = {}) {
  return (categories ?? [])
    .map((cat) => ({
      ...cat,
      settings: (cat.settings ?? []).filter(
        (s) => matchesQuery(s, query) && (!modifiedOnly || isModified(s)),
      ),
    }))
    .filter((cat) => cat.settings.length > 0);
}

/** Flattens the category list to its settings, for counting and bulk operations. */
export const allSettings = (categories) =>
  (categories ?? []).flatMap((c) => c.settings ?? []);

/**
 * The drafts that actually differ from what the server holds.
 *
 * The draft map is keyed by setting key and is deliberately allowed to contain
 * no-op entries — a field typed into and then typed back is not a pending change,
 * and the save bar must not claim otherwise.
 *
 * @returns {{key: string, value: string}[]}
 */
export function pendingChanges(categories, drafts) {
  return allSettings(categories)
    .filter((s) => Object.hasOwn(drafts ?? {}, s.key) && asText(drafts[s.key]) !== asText(s.value))
    .map((s) => ({ key: s.key, value: asText(drafts[s.key]) }));
}

/** Clamps a numeric draft into the catalog's min/max so the server never has to reject it. */
export function clampNumeric(s, raw) {
  if (!isNumeric(s) || raw === '') return raw;
  const n = Number(raw);
  if (Number.isNaN(n)) return raw;
  if (s.minValue != null && n < s.minValue) return String(s.minValue);
  if (s.maxValue != null && n > s.maxValue) return String(s.maxValue);
  return raw;
}
