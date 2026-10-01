/**
 * The server's list filters, re-implemented for a snapshot.
 *
 * Pure and in its own module so it can be tested against the behaviour it copies without
 * dragging react-query, notistack and the auth context into the test run.
 */
/**
 * Re-apply the server's filters locally.
 *
 * Offline there is no server to narrow the list, but the UI still passes whatever the
 * user typed — so without this, searching offline silently returns everything and looks
 * like the filter is broken.
 *
 * Deliberately mirrors WalletDocumentService.list EXACTLY: `q` matches on the LABEL and
 * nothing else. Searching more fields here would be worse than searching fewer — the
 * same query would return different documents depending on whether there was signal,
 * which is precisely the kind of thing that makes a store stop feeling trustworthy.
 *
 * The number is not searchable offline even in principle: the server holds the real
 * value and only ever sends a masked one, so there is nothing local to match against.
 */
export function applyFilters(documents, filters) {
  let out = documents ?? [];
  if (filters?.typeId) out = out.filter((d) => String(d.typeId) === String(filters.typeId));
  if (filters?.q) {
    const q = String(filters.q).trim().toLowerCase();
    if (q) out = out.filter((d) => String(d.label ?? '').toLowerCase().includes(q));
  }
  return out;
}
