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

/** `listingExchange` ("NSE"|"BSE"|"BOTH"|null) → display text. `BOTH` reads as
 * "BSE, NSE" (both real exchanges named, not the internal enum value); NSE/BSE pass
 * through unchanged; null renders as an em dash rather than a blank tile. */
export const formatExchange = (exchange) => {
  if (exchange == null) return '—';
  if (exchange === 'BOTH') return 'BSE, NSE';
  return exchange;
};

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
 * badge). Mainboard reuses the brand teal; SME gets its own violet (`T.violet`/
 * `T.violetBg`) so the two chip kinds are never confusable at a glance, and so the
 * tint actually adapts between AMOLED dark and pure-white light like every other
 * chip color here does. Returns null (hide the chip) for an unrecognized/missing
 * ipoType rather than fabricating a "Mainboard" default — no generic "IPO" fallback
 * label either way.
 */
export const ipoTypeMeta = (ipoType, T) => {
  const label = IPO_TYPE_LABEL[ipoType];
  if (!label) return null;
  if (ipoType === 'sme') return { label, color: T.violet, bg: T.violetBg };
  return { label, color: T.teal, bg: T.tealBg };
};

/** The user's own self-recorded "My IPOs" allotment result (`unknown|allotted|not_allotted` —
 * see `IpoUserApplicationEntity`), themed against the live tokens. Distinct from `statusMeta`
 * (the IPO's overall lifecycle) and from `ipo.allotmentStatus` (the registrar's own
 * Awaited/Finalized status) — this is what *this* applicant recorded for themselves. Defaults
 * to the neutral "Unknown" treatment for a missing/unrecognized value. */
export const ALLOTMENT_RESULT_LABEL = {
  unknown: 'Unknown',
  allotted: 'Allotted',
  not_allotted: 'Not allotted',
};

export const allotmentResultMeta = (result, T) => {
  const label = ALLOTMENT_RESULT_LABEL[result] ?? ALLOTMENT_RESULT_LABEL.unknown;
  if (result === 'allotted') return { label, color: T.success, bg: T.successBg };
  if (result === 'not_allotted') return { label, color: T.error, bg: T.errorBg };
  return { label, color: T.textFaint, bg: T.glassHover };
};

const MS_PER_DAY = 86_400_000;

/**
 * Whole-day difference between a "yyyy-MM-dd" local date and today (local time),
 * floored to midnight on both ends so "tomorrow" is always exactly 1 regardless of
 * the current time of day. Positive = future, negative = past, null if undeterminable.
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
  if (n < 1)        { color = T.textFaint; }
  else if (n < 3)   { color = T.teal; }
  else if (n <= 10) { color = T.success; }
  else              { color = T.warning; }
  return { fillPct, color, hot: n > 10 };
};

/** "yyyy-MM-dd" → { dayMonth: "24 Jul", year: "2026" } — the two-line date label used by
 * the timeline stepper (day+month prominent, year small underneath). Null-safe. */
export const formatStageDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return { dayMonth: format(d, 'dd MMM'), year: format(d, 'yyyy') };
  } catch { return null; }
};

/** Ordered stage definitions for the detail-page timeline stepper. */
const TIMELINE_STAGE_DEFS = (ipo) => [
  { key: 'open', label: 'Open', date: ipo.openDate },
  { key: 'close', label: 'Close', date: ipo.closeDate },
  { key: 'allotment', label: 'Allotment', date: ipo.allotmentDate },
  { key: 'refund', label: 'Refund', date: ipo.refundDate },
  { key: 'demat', label: 'Demat', date: ipo.dematDate },
  { key: 'listing', label: 'Listing', date: ipo.listingDate },
];

/**
 * Builds the ordered list of timeline stages for `IpoTimeline` — ALWAYS all six
 * Open/Close/Allotment/Refund/Demat/Listing stages, in order, never dropped just because
 * a date isn't known yet (a future/TBA stage is still a real stage the user should see
 * coming, per the reference design — dropping it made an upcoming/open IPO's timeline
 * look like it only had 2-3 stages total). Each stage is tagged with a `status`:
 *   'done'    — date is known and in the past
 *   'current' — the active stage: the earliest stage that isn't 'done' yet, whether
 *               because its date is today/future or because its date isn't known at all
 *               (a still-TBA stage reached once every earlier dated stage is done). If
 *               every stage already has a past date (fully listed), the last stage
 *               (Listing) is promoted to 'current' so there's always exactly one.
 *   'upcoming'— every stage after the current one, including further TBA stages
 * Returns [] for a falsy ipo.
 */
export const buildTimelineStages = (ipo) => {
  if (!ipo) return [];
  const defs = TIMELINE_STAGE_DEFS(ipo);
  const isPending = defs.map((d) => {
    const n = d.date != null ? daysUntil(d.date) : null;
    return n == null || n >= 0; // unknown date, or today/future → not done yet
  });
  let currentIndex = isPending.indexOf(true);
  if (currentIndex === -1) currentIndex = defs.length - 1; // all done → last stage is "current"
  return defs.map((d, i) => ({
    ...d,
    status: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming',
  }));
};

/**
 * Expected listing price = upper price band + latest GMP, with the implied gain %
 * vs the upper band (equivalent to `latestGmp / priceMax * 100`). Null whenever either
 * input is missing or the price band is zero (can't divide), so callers can hide the
 * stat entirely rather than show a bogus number.
 */
export const expectedListingPrice = (priceMax, latestGmp) => {
  if (priceMax == null || latestGmp == null) return null;
  const band = Number(priceMax);
  const gmp = Number(latestGmp);
  if (band === 0) return null;
  return { price: band + gmp, gainPct: (gmp / band) * 100 };
};

/**
 * Day-over-day change between two consecutive history values (e.g. GMP ₹). Null when
 * either side is missing (e.g. the earliest row in the table has no prior day to compare
 * against). `direction` drives the ▲/▼/flat treatment in the day-wise history tables.
 */
export const dayOverDayDelta = (current, previous) => {
  if (current == null || previous == null) return null;
  const delta = Number(current) - Number(previous);
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return { delta, direction };
};
