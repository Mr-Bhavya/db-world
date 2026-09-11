import { format, parseISO } from 'date-fns';

/** LocalDate ("yyyy-MM-dd") → "24 Jul 2026". Null-safe, and null for anything unparseable. */
export const formatDocDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    return Number.isNaN(d.getTime()) ? null : format(d, 'dd MMM yyyy');
  } catch { return null; }
};

const MS_PER_DAY = 86_400_000;

/**
 * Whole-day difference between a "yyyy-MM-dd" date and today, floored to midnight on both ends so
 * "tomorrow" is exactly 1 regardless of the time of day. Positive = future, negative = past.
 */
export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  try {
    const target = parseISO(dateStr);
    if (Number.isNaN(target.getTime())) return null;
    const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((startOfTarget - startOfToday) / MS_PER_DAY);
  } catch { return null; }
};

/** How close to renewal a document counts as "expiring". Ninety days is the window most consulates
 * and licensing authorities want you inside before you apply, so it is the point at which knowing
 * is still actionable rather than merely alarming. */
export const EXPIRING_SOON_DAYS = 90;

/**
 * A document's validity, as the one thing a wallet is actually for.
 *
 * `'none'` is a first-class answer, not a failure: a birth certificate or a PAN card has no expiry
 * and never will. Cards render nothing at all for it rather than an em dash — the same rule the IPO
 * surfaces follow, that a value is only ever offered when it exists.
 */
export const expiryState = (expiryDate) => {
  const days = daysUntil(expiryDate);
  if (days == null) return { key: 'none', days: null };
  if (days < 0) return { key: 'expired', days };
  if (days <= EXPIRING_SOON_DAYS) return { key: 'expiring', days };
  return { key: 'valid', days };
};

/** Short human label for an expiry state — the card's headline when a document has one. */
export const expiryLabel = (expiryDate) => {
  const { key, days } = expiryState(expiryDate);
  const on = formatDocDate(expiryDate);
  switch (key) {
    case 'expired': return days === -1 ? 'Expired yesterday' : `Expired ${on}`;
    case 'expiring': {
      if (days === 0) return 'Expires today';
      if (days === 1) return 'Expires tomorrow';
      if (days < 31) return `Expires in ${days}d`;
      // Singular matters here: rounding 38 days lands on 1, and "Expires in 1 months" is the kind
      // of thing that makes a page look unfinished.
      const months = Math.round(days / 30);
      return `Expires in ${months} month${months === 1 ? '' : 's'}`;
    }
    case 'valid': return `Valid to ${on}`;
    default: return null;
  }
};

/**
 * Themed accent per expiry state — but ONLY for the two states that want you to do something.
 *
 * `valid` and `none` both return a null colour, which is what suppresses the card's accent edge and
 * its pill. That is deliberate and was a correction: roughly seven in ten document types never
 * expire at all, and of the ones that do, most are years out. Painting a green "Valid to 12 Mar
 * 2031" badge on a passport spends the card's loudest affordance saying "nothing is wrong", which
 * is not information. Expired and expiring are the only states with an action attached, so they are
 * the only ones that get colour.
 *
 * The validity date itself is not lost — the preview dialog states it, where a detail view belongs.
 */
export const expiryMeta = (expiryDate, T) => {
  const { key } = expiryState(expiryDate);
  switch (key) {
    case 'expired': return { key, color: T.error, bg: T.errorBg };
    case 'expiring': return { key, color: T.warning, bg: T.warningBg };
    default: return { key, color: null, bg: null };
  }
};

const KB = 1024;
/** Byte count → "812 KB" / "1.4 MB". Whole numbers below a megabyte, one decimal above: a
 * document's size is a rough reassurance, not a measurement. */
export const formatFileSize = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < KB) return `${n} B`;
  if (n < KB * KB) return `${Math.round(n / KB)} KB`;
  return `${(n / (KB * KB)).toFixed(1)} MB`;
};

/**
 * The wallet's own summary, computed from the loaded list rather than fetched — the backend's
 * `/stats` endpoint is admin-scoped and counts every user's documents, which is not what an owner
 * wants to see. Pure and null-safe: a missing or non-array input yields zeroes rather than throwing
 * inside the caller's `useMemo`.
 */
export const computeWalletStats = (docs) => {
  const list = Array.isArray(docs) ? docs : [];
  let expiring = 0;
  let expired = 0;
  let shared = 0;
  for (const doc of list) {
    const { key } = expiryState(doc.expiryDate);
    if (key === 'expiring') expiring += 1;
    else if (key === 'expired') expired += 1;
    if (doc.shared) shared += 1;
  }
  return { total: list.length, expiring, expired, shared };
};

/** Sort options offered in the toolbar. "Expiring first" is the only one that answers a question
 * rather than describing the list, so it is worth its own entry even though it is rarely the
 * default view. */
export const DOC_SORTS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'expiry', label: 'Expiring first' },
  { value: 'name', label: 'Name (A–Z)' },
];

/**
 * Sorts a copy of `docs`. Client-side on purpose: the wallet is one bounded response — a person's
 * documents, not a catalogue — so a round trip per sort change would be slower and noisier than
 * ordering in place.
 *
 * Under "expiring first", documents with NO expiry sort last rather than first. A null date is not
 * an urgent one, and treating it as either 0 or Infinity gets that wrong in one direction or the
 * other; it is ranked explicitly instead.
 */
export const sortDocuments = (docs, sort) => {
  const list = [...(docs ?? [])];
  switch (sort) {
    case 'expiry':
      return list.sort((a, b) => {
        const da = daysUntil(a.expiryDate);
        const db = daysUntil(b.expiryDate);
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    case 'name':
      return list.sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? '')));
    default:
      // Newest first. `createdAt` is an ISO instant, so lexical comparison is chronological.
      return list.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }
};

/** Status filters, applied on top of the type filter. Each answers "show me the ones I may need to
 * do something about", which the type chips can't. */
export const DOC_STATUS_FILTERS = [
  { value: 'expiring', label: 'Expiring', match: (d) => expiryState(d.expiryDate).key === 'expiring' },
  { value: 'expired', label: 'Expired', match: (d) => expiryState(d.expiryDate).key === 'expired' },
  { value: 'shared', label: 'Shared', match: (d) => !!d.shared },
];

/** Applies a status filter by value; an unknown or empty value keeps everything. */
export const filterDocsByStatus = (docs, status) => {
  const filter = DOC_STATUS_FILTERS.find((f) => f.value === status);
  if (!filter) return docs ?? [];
  return (docs ?? []).filter(filter.match);
};
