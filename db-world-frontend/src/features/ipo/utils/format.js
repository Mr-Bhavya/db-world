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

/** `website` URL → bare display domain ("https://www.paytm.com/ipo" → "paytm.com"), for the
 * About section's clickable link (the link itself still points at the full URL — this is
 * display text only). Falls back to the raw string for anything `URL` can't parse (e.g. a
 * bare "paytm.com" with no scheme) rather than hiding the field; null-safe. */
export const websiteDomain = (website) => {
  if (!website) return null;
  try { return new URL(website).hostname.replace(/^www\./, ''); } catch { return website; }
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
/**
 * An open IPO whose bidding window ends today. Broken out because it's the only state on this
 * screen with a same-day deadline, so it earns louder treatment than "Listed 4d ago" — everything
 * else on a card is descriptive, this one is a decision the user has hours left to make.
 */
export const isClosingToday = (ipo) =>
  ipo?.status === 'open' && daysUntil(ipo.closeDate) === 0;

/**
 * Sections for the grouped list, in the order they matter to someone deciding what to do next:
 * a same-day deadline first, then what they can still act on, then what's merely announced, then
 * the archive.
 *
 * Grouping replaces most of the reason to touch the status filter at all — the filter narrows,
 * whereas this ORDERS by urgency and keeps everything visible, which is what a tracker is for.
 * Sections with nothing in them are dropped by the caller rather than rendered as empty headings.
 */
export const IPO_GROUPS = [
  { key: 'closingToday', label: 'Closing today', match: isClosingToday },
  { key: 'open', label: 'Open now', match: (i) => i.status === 'open' },
  { key: 'upcoming', label: 'Upcoming', match: (i) => i.status === 'upcoming' },
  { key: 'closed', label: 'Awaiting listing', match: (i) => i.status === 'closed' },
  { key: 'listed', label: 'Recently listed', match: (i) => i.status === 'listed' },
];

/**
 * Buckets `ipos` into {@link IPO_GROUPS}, preserving the order the server sorted them in within
 * each bucket. First matching group wins, so an open IPO closing today lands in "Closing today"
 * and not also in "Open now". Anything matching no group (an unrecognised status) is appended
 * under a neutral heading rather than silently dropped.
 */
export const groupIposByStage = (ipos) => {
  const buckets = new Map(IPO_GROUPS.map((g) => [g.key, []]));
  const other = [];
  (ipos ?? []).forEach((ipo) => {
    const group = IPO_GROUPS.find((g) => g.match(ipo));
    if (group) buckets.get(group.key).push(ipo);
    else other.push(ipo);
  });
  const sections = IPO_GROUPS
    .map((g) => ({ key: g.key, label: g.label, ipos: buckets.get(g.key) }))
    .filter((sec) => sec.ipos.length > 0);
  if (other.length > 0) sections.push({ key: 'other', label: 'Other', ipos: other });
  return sections;
};

/**
 * Case-insensitive company-name match for the list's search box. Deliberately client-side over the
 * already-loaded page: the list is one bounded response (a financial year, a couple of hundred rows
 * at most), so a round-trip per keystroke would be slower and noisier than filtering in place.
 */
export const matchesIpoQuery = (ipo, query) => {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return true;
  return (ipo?.companyName ?? '').toLowerCase().includes(q);
};

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

/**
 * Mean of the available (non-null) subscription multiples — e.g. QIB/NII/Retail on the
 * detail page's Subscription tab — so a category that hasn't reported yet doesn't drag
 * the average toward zero. Null when none of the inputs are known yet (never `NaN`).
 */
export const averageSubscription = (values) => {
  const known = (values ?? []).filter((v) => v != null).map(Number);
  if (known.length === 0) return null;
  return known.reduce((sum, v) => sum + v, 0) / known.length;
};

/**
 * The application lot-size breakdown investorgain/Chittorgarh show — how many lots each investor
 * category can bid, derived purely from the lot size + the cut-off price (upper band) and SEBI's
 * category caps: Retail ≤ ₹2,00,000, S-HNI ₹2,00,000–₹10,00,000, B-HNI > ₹10,00,000. Returns
 * `{ minBidShares, tiers: [{ label, group, lots, shares, amount }] }`, or `null` when lot size /
 * price is missing. SME issues have no 2L/10L split — a single HNI tier above the retail cap.
 *   - Retail (Min) = 1 lot; Retail (Max) = most lots still ≤ ₹2L.
 *   - S-HNI (Min) = Retail-max + 1; S-HNI (Max) = most lots still ≤ ₹10L; B-HNI (Min) = S-HNI-max + 1.
 */
export const computeLotBreakdown = (lotSize, price, ipoType) => {
  const lot = Number(lotSize);
  const p = Number(price);
  if (!lot || !p || lot <= 0 || p <= 0) return null;

  const RETAIL_CAP = 200000;
  const SHNI_CAP = 1000000;
  const lotValue = lot * p;
  const tier = (label, group, lots) => ({ label, group, lots, shares: lots * lot, amount: lots * lotValue });

  const retailMaxLots = Math.max(1, Math.floor(RETAIL_CAP / lotValue));
  const tiers = [tier('Retail (Min)', 'retail', 1), tier('Retail (Max)', 'retail', retailMaxLots)];

  if (String(ipoType).toLowerCase() === 'sme') {
    tiers.push(tier('HNI (Min)', 'hni', retailMaxLots + 1));
  } else {
    const sHniMaxLots = Math.max(retailMaxLots + 1, Math.floor(SHNI_CAP / lotValue));
    tiers.push(tier('S-HNI (Min)', 'hni', retailMaxLots + 1));
    tiers.push(tier('S-HNI (Max)', 'hni', sHniMaxLots));
    tiers.push(tier('B-HNI (Min)', 'hni', sHniMaxLots + 1));
  }
  return { minBidShares: lot, tiers };
};

/**
 * Preferred display order for subscription categories — the classic QIB/NII/Retail trio
 * first, then the aliases some sources use for the same tranches (HNI ≈ NII, RII ≈ Retail),
 * then the less-common reservation categories, all matched case-insensitively. Anything not
 * in this list (a source-specific category we've never seen before) sorts after all of
 * these, alphabetically — so a brand-new category never gets dropped, it just lands last.
 */
const PREFERRED_SUBSCRIPTION_CATEGORY_ORDER = [
  'QIB', 'NII', 'S-NII', 'B-NII', 'HNI', 'Retail', 'RII', 'Employee', 'Shareholder', 'Anchor', 'Other',
];

/**
 * Sorts subscription category keys (from `SubscriptionPointDto.categories`, e.g.
 * `['Retail','Anchor','QIB','NII']`) into the app's preferred display order —
 * `PREFERRED_SUBSCRIPTION_CATEGORY_ORDER` first (case-insensitive), then any
 * remaining/unrecognized keys alphabetically. Shared by the Subscription tab's bars, the
 * day-wise chart's series/legend and the day-wise table's columns so all three always agree
 * on category order regardless of what order the backend/source happened to report them in.
 * Pure and null-safe: never mutates the input, returns `[]` for a falsy/empty input.
 */
export const orderSubscriptionCategories = (keys) => {
  const list = keys ?? [];
  const rankOf = (key) => {
    const i = PREFERRED_SUBSCRIPTION_CATEGORY_ORDER.findIndex(
      (p) => p.toLowerCase() === String(key).toLowerCase(),
    );
    return i === -1 ? PREFERRED_SUBSCRIPTION_CATEGORY_ORDER.length : i;
  };
  return [...list].sort((a, b) => {
    const diff = rankOf(a) - rankOf(b);
    return diff !== 0 ? diff : String(a).localeCompare(String(b));
  });
};


/**
 * `fiscalYear` display label → a short label for the financials chart's x-axis (the P&L
 * table keeps the full label as-is — this is chart-only). Recognizes two "FY" shapes and
 * passes anything else through unchanged (e.g. an already-short month label like
 * "Mar 2026"), so it's safe to call on whatever a source happens to report:
 *   "FY 2021-22" / "FY2021-22" → "2022"  (ending year = start year + 1, so a
 *                                          century-crossing range like "FY 1999-00"
 *                                          still rolls over to "2000" rather than
 *                                          reusing the start year's century)
 *   "FY22"                     → "2022"  (assumes 2000s — the only era this app covers)
 *   anything else / null       → returned unchanged
 */
export const shortFinancialLabel = (fiscalYear) => {
  if (!fiscalYear) return fiscalYear ?? null;
  const rangeMatch = fiscalYear.match(/^FY\s*(\d{4})-(\d{2})$/i);
  if (rangeMatch) {
    const [, startYear] = rangeMatch;
    return String(parseInt(startYear, 10) + 1);
  }
  const shortMatch = fiscalYear.match(/^FY\s*(\d{2})$/i);
  if (shortMatch) return `20${shortMatch[1]}`;
  // "31 Mar 2026" / "Mar 2026" (Chittorgarh period-end labels) → just the year for a tidy axis.
  const trailingYear = fiscalYear.match(/(\d{4})\s*$/);
  if (trailingYear) return trailingYear[1];
  return fiscalYear;
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
 * look like it only had 2-3 stages total). Each stage is tagged with a `status`,
 * evaluated PER STAGE (not positionally) so one unknown date can never block a later,
 * already-known-past date from reading as done — e.g. a listed IPO whose Refund/Demat
 * dates aren't published yet still shows Listing as 'done' rather than stuck 'upcoming':
 *   'done'    — that stage's OWN date is known and strictly before today. A null/unknown
 *               date is never 'done', no matter what any other stage looks like.
 *   'current' — the first stage (in order) that isn't 'done' and has a known date of
 *               today-or-later. A stage with no date at all (TBA) is never 'current' —
 *               it just sits in 'upcoming' until it gets a real date. There can be NO
 *               'current' stage at all (e.g. every stage is done, or the only not-done
 *               stages are TBA past the last dated one) — that's fine, it just means a
 *               fully (or currently-inert) timeline has no single active step.
 *   'upcoming'— every other stage: not done, not current, including every TBA/null-date
 *               stage (still renders its "TBA" date via `formatStageDate`/`StageNode`).
 * Returns [] for a falsy ipo.
 */
export const buildTimelineStages = (ipo) => {
  if (!ipo) return [];
  const defs = TIMELINE_STAGE_DEFS(ipo);
  const dayOffsets = defs.map((d) => (d.date != null ? daysUntil(d.date) : null));
  const isDone = dayOffsets.map((n) => n != null && n < 0);
  const currentIndex = dayOffsets.findIndex((n, i) => !isDone[i] && n != null && n >= 0);
  return defs.map((d, i) => ({
    ...d,
    status: isDone[i] ? 'done' : i === currentIndex ? 'current' : 'upcoming',
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

/**
 * Quick-stats for the list-page hero — how many IPOs in the *currently loaded* list
 * (whatever type/status filter is active) are open right now / still upcoming, plus
 * whichever single IPO has the highest gmpPct. Pure and null-safe: an empty/missing
 * list yields zero counts and a null topGmp rather than throwing, so the hero can
 * decide to hide the stats row without a guard at the call site. On a tie for the
 * highest gmpPct, the first one encountered wins (list order, typically by sort). An
 * IPO with a null/undefined gmpPct is never considered for topGmp (never wins by
 * being treated as 0).
 */
export const computeQuickStats = (ipos) => {
  // Defensive: only an array is iterable here. A caller that hands the raw list RESPONSE
  // ({ ipos, lastUpdated }) — or anything non-array — must degrade to empty stats, never throw
  // (a `for…of` on a non-iterable would crash the whole page via the calling useMemo).
  const list = Array.isArray(ipos) ? ipos : [];
  let openCount = 0;
  let upcomingCount = 0;
  let topGmp = null;
  for (const ipo of list) {
    if (ipo.status === 'open') openCount += 1;
    else if (ipo.status === 'upcoming') upcomingCount += 1;
    if (ipo.gmpPct != null && (topGmp == null || ipo.gmpPct > topGmp.gmpPct)) {
      topGmp = { companyName: ipo.companyName, gmpPct: ipo.gmpPct };
    }
  }
  return { openCount, upcomingCount, topGmp };
};
