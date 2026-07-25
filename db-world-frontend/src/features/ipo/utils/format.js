import { format, parseISO } from 'date-fns';

/** LocalDate ("yyyy-MM-dd") → "24 Jul 2026". */
export const formatShortDate = (dateStr) => {
  if (!dateStr) return null;
  try { return format(parseISO(dateStr), 'dd MMM yyyy'); } catch { return null; }
};

/** Instant (ISO) → "HH:MM" in IST, regardless of the viewer's local timezone. */
export const formatIstTime = (isoInstant) => {
  if (!isoInstant) return null;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(isoInstant));
  } catch { return null; }
};

export const formatCurrency = (n) =>
  (n == null ? null : `₹${Number(n).toLocaleString('en-IN')}`);

export const formatPriceBand = (min, max) => {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? formatCurrency(min) : `₹${min}–₹${max}`;
  return formatCurrency(min ?? max);
};

export const formatPct = (n) =>
  (n == null ? null : `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%`);

export const formatMultiplier = (n) =>
  (n == null ? null : `${Number(n).toFixed(2)}x`);

export const IPO_TYPE_LABEL = {
  mainboard: 'Mainboard',
  sme: 'SME',
};

export const STATUS_LABEL = {
  upcoming: 'Upcoming',
  open: 'Open',
  closed: 'Closed',
  listed: 'Listed',
};

/**
 * Status → themed accent, resolved against the live design tokens (`useT()`) so it's
 * correct in both AMOLED dark and pure-white light: upcoming = info/blue (announced,
 * not live yet), open = success/green (live now), closed = warning/amber (subscription
 * over, awaiting listing), listed = teal/accent (done — matches the brand accent).
 */
export const statusMeta = (status, T) => {
  const label = STATUS_LABEL[status] ?? status ?? 'Unknown';
  switch (status) {
    case 'upcoming': return { label, color: T.info, bg: T.infoBg };
    case 'open':     return { label, color: T.success, bg: T.successBg };
    case 'closed':   return { label, color: T.warning, bg: T.warningBg };
    case 'listed':   return { label, color: T.teal, bg: T.tealBg };
    default:         return { label, color: T.textFaint, bg: T.glassHover };
  }
};

/**
 * ipoType → themed chip tint, distinct from `statusMeta` (which colors the lifecycle
 * badge). Mainboard reuses the brand teal; SME gets its own violet so the two chip
 * kinds are never confusable at a glance. `#8b5cf6` matches the violet already used
 * for EDITOR_PICK tags elsewhere in the app (see admin/records/tagConstants.js).
 * Returns null (hide the chip) for an unrecognized/missing ipoType rather than
 * fabricating a "Mainboard" default — no generic "IPO" fallback label either way.
 */
const SME_VIOLET = '#8b5cf6';
export const ipoTypeMeta = (ipoType, T) => {
  const label = IPO_TYPE_LABEL[ipoType];
  if (!label) return null;
  if (ipoType === 'sme') return { label, color: SME_VIOLET, bg: `${SME_VIOLET}1f` };
  return { label, color: T.teal, bg: T.tealBg };
};

const MS_PER_DAY = 86_400_000;

/**
 * Whole-day difference between a "yyyy-MM-dd" local date and today (local time),
 * floored to midnight on both ends so "tomorrow" is always exactly 1 regardless of
 * the current time of day. Positive = future, negative = past, null if undeterminable.
 */
const daysUntil = (dateStr) => {
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

/**
 * Status-aware, terse "time left" label for the card footer. Null-safe throughout —
 * returns null when the relevant date is missing/unparseable so callers can hide the
 * pill entirely rather than show a blank one.
 *   upcoming → "Opens in Nd" / "Opens today"
 *   open     → "Nd left" / "Closing today"
 *   closed   → "Allotment in Nd" (if an allotmentDate is ever added upstream) →
 *              else "Lists in Nd" → else "Listing soon" (always non-null)
 *   listed   → "Listed Nd ago" / "Listed today"
 */
export const daysLeftLabel = (ipo) => {
  if (!ipo) return null;
  switch (ipo.status) {
    case 'upcoming': {
      const n = daysUntil(ipo.openDate);
      if (n == null) return null;
      return n <= 0 ? 'Opens today' : `Opens in ${n}d`;
    }
    case 'open': {
      const n = daysUntil(ipo.closeDate);
      if (n == null) return null;
      return n <= 0 ? 'Closing today' : `${n}d left`;
    }
    case 'closed': {
      const allotmentN = daysUntil(ipo.allotmentDate);
      if (allotmentN != null && allotmentN > 0) return `Allotment in ${allotmentN}d`;
      const listingN = daysUntil(ipo.listingDate);
      if (listingN != null && listingN > 0) return `Lists in ${listingN}d`;
      return 'Listing soon';
    }
    case 'listed': {
      const n = daysUntil(ipo.listingDate);
      if (n == null) return null;
      const agoDays = -n;
      return agoDays <= 0 ? 'Listed today' : `Listed ${agoDays}d ago`;
    }
    default:
      return null;
  }
};

/** `subTotal` (e.g. 2.4) → "2.4× subscribed"; null if not yet known. */
export const subscriptionLabel = (subTotal) =>
  (subTotal == null ? null : `${Number(subTotal).toFixed(1)}× subscribed`);

/**
 * Subscription progress-bar fill % (capped at 100 — anything past 1× reads as "full
 * bar, multiple emphasized in the label" rather than an ever-growing bar) + color tier
 * resolved against the live tokens: <1× muted/grey (undersubscribed), 1–3× teal,
 * 3–10× success/green (comfortably oversubscribed), >10× warning/orange ("hot" issue).
 */
export const subscriptionMeta = (subTotal, T) => {
  if (subTotal == null) return null;
  const n = Number(subTotal);
  const fillPct = Math.max(0, Math.min(n, 1)) * 100;
  let color;
  let bg;
  if (n < 1)       { color = T.textFaint; bg = T.glassHover; }
  else if (n < 3)  { color = T.teal;      bg = T.tealBg; }
  else if (n <= 10) { color = T.success;  bg = T.successBg; }
  else             { color = T.warning;   bg = T.warningBg; }
  return { fillPct, color, bg, hot: n > 10 };
};
