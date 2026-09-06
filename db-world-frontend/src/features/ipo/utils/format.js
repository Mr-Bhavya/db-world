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
 *
 * The undersubscribed tier is `textMuted`, not `textFaint`: it is still the dimmest of the four,
 * but 0.46 alpha rendered both the figure and the bar tracking it as barely-there grey — the same
 * contrast problem the labels had.
 */
export const subscriptionMeta = (subTotal, T) => {
  if (subTotal == null) return null;
  const n = Number(subTotal);
  const fillPct = Math.max(0, Math.min(n, 1)) * 100;
  let color;
  if (n < 1)        { color = T.textMuted; }
  else if (n < 3)   { color = T.teal; }
  else if (n <= 10) { color = T.success; }
  else              { color = T.warning; }
  return { fillPct, color, hot: n > 10 };
};

/**
 * The per-category application ladder SEBI's caps produce, derived purely from the lot size and
 * the cut-off price: Retail ≤ ₹2,00,000, S-HNI ₹2,00,000–₹10,00,000, B-HNI above that. An SME
 * issue has no 2L/10L split — one HNI tranche above the retail cap.
 *
 * Returns RANGES, not endpoint rows. The five endpoints ("Retail (Min)", "Retail (Max)", …) were
 * only ever the ends of three ranges, and splitting each one into its own row made the reader
 * reassemble them; a tranche IS "1 to 13 lots, ₹14,586 to ₹1,89,618". The last tranche is
 * open-ended, so its `max*` fields are null rather than an invented ceiling.
 *
 * `{ minBidShares, lotValue, tranches: [{ key, label, group, minLots, maxLots, minShares,
 * maxShares, minAmount, maxAmount }] }`, or null when lot size / price is missing.
 */
export const computeLotBreakdown = (lotSize, price, ipoType) => {
  const lot = Number(lotSize);
  const p = Number(price);
  if (!lot || !p || lot <= 0 || p <= 0) return null;

  const RETAIL_CAP = 200000;
  const SHNI_CAP = 1000000;
  const lotValue = lot * p;
  const tranche = (key, label, group, minLots, maxLots) => ({
    key,
    label,
    group,
    minLots,
    maxLots,
    minShares: minLots * lot,
    maxShares: maxLots == null ? null : maxLots * lot,
    minAmount: minLots * lotValue,
    maxAmount: maxLots == null ? null : maxLots * lotValue,
  });

  const retailMaxLots = Math.max(1, Math.floor(RETAIL_CAP / lotValue));
  const tranches = [tranche('retail', 'Retail', 'retail', 1, retailMaxLots)];

  if (String(ipoType).toLowerCase() === 'sme') {
    tranches.push(tranche('hni', 'HNI', 'hni', retailMaxLots + 1, null));
  } else {
    const sHniMaxLots = Math.max(retailMaxLots + 1, Math.floor(SHNI_CAP / lotValue));
    tranches.push(tranche('shni', 'S-HNI', 'hni', retailMaxLots + 1, sHniMaxLots));
    tranches.push(tranche('bhni', 'B-HNI', 'hni', sHniMaxLots + 1, null));
  }
  return { minBidShares: lot, lotValue, tranches };
};

/**
 * Categories that are a SLICE of another category rather than a peer of it: S-NII and B-NII are
 * the small- and big-HNI halves of NII (and S-HNI/B-HNI are the same split under the other
 * source's naming). Maps a key to its parent's key, or null when it stands alone.
 */
const SUB_TRANCHE_PARENT = {
  's-nii': 'nii', 'b-nii': 'nii',
  's-hni': 'hni', 'b-hni': 'hni',
};

/**
 * The parent category a key is a slice of, but only when that parent is actually present in
 * `siblings` — a source that reports S-NII and B-NII WITHOUT an NII line isn't double counting,
 * so those two are peers there and must not be treated as slices.
 *
 * This is what stops the shares-offered total being inflated. Summing every reported category
 * counted the NII tranche twice (once whole, once as its two halves), which put the denominator
 * ~21% too high and made every "% of offer" wrong on every mainboard IPO.
 */
export const subTrancheParentOf = (key, siblings = []) => {
  const parent = SUB_TRANCHE_PARENT[String(key).toLowerCase()];
  if (!parent) return null;
  const match = siblings.find((k) => String(k).toLowerCase() === parent);
  return match ?? null;
};

/**
 * Total shares on offer across categories, counting each share once — sub-tranches are skipped
 * when their parent is also reported. Null when nothing carries a `sharesOffered`, so the caller
 * hides the "% of offer" figures rather than dividing by zero.
 */
export const totalSharesOffered = (rows) => {
  const list = rows ?? [];
  const keys = list.map((r) => r.category);
  const total = list.reduce((sum, r) => (
    subTrancheParentOf(r.category, keys) || r.sharesOffered == null
      ? sum
      : sum + Number(r.sharesOffered)
  ), 0);
  return total > 0 ? total : null;
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


// ─── Detail page ─────────────────────────────────────────────────────────────
// The detail page follows the same rule the list cards do (see `IpoCard`'s `cardStats`): a
// figure is only ever offered when its value exists, so no stage can render a hole where a
// number should be. These helpers are the shared, testable half of that — the components own
// the rendering, this file owns "what does this IPO actually have, and what leads".

/** Whole-rupee amount with Indian digit grouping — "₹14,450". Paise are never meaningful for
 * an application amount or an issue figure, and two trailing zeros only add width. */
export const formatAmount = (n) =>
  (n == null ? null : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`);

/**
 * What one retail application actually costs: the minimum bid (one lot) at the cut-off price.
 * This is the number a reader is really after when they look at a price band and a lot size —
 * the detail page shows it rather than making them multiply. Null whenever either input is
 * missing or non-positive, so the caller hides the figure instead of printing "₹0".
 */
export const minInvestment = (lotSize, priceMax) => {
  const lot = Number(lotSize);
  const price = Number(priceMax);
  if (!lot || !price || lot <= 0 || price <= 0) return null;
  return lot * price;
};

/**
 * How far through its bidding window an IPO is, 0–100, counting whole days INCLUSIVELY — on the
 * open day of a 28 Aug–01 Sep issue you are 1 day into 5, not 0. Clamped at both ends so a
 * not-yet-open issue reads 0 and a closed one reads 100 rather than going negative/past full.
 * Null when either date is unknown or the window is inverted, so the bar is hidden rather than
 * drawn at some arbitrary width.
 */
export const biddingProgressPct = (openDate, closeDate) => {
  const fromOpen = daysUntil(openDate);
  const fromClose = daysUntil(closeDate);
  if (fromOpen == null || fromClose == null) return null;
  const totalDays = fromClose - fromOpen + 1;
  if (totalDays <= 0) return null;
  const elapsed = Math.max(0, Math.min(1 - fromOpen, totalDays));
  return (elapsed / totalDays) * 100;
};

/**
 * Presence test per hero figure — the single place that decides whether the detail page has a
 * given number at all. Keyed the same way as `DETAIL_FIGURE_ORDER` below and as the Key-facts
 * grid's exclusion list, so "does it exist", "does the hero lead with it" and "has the grid
 * already shown it" can never drift apart.
 */
const DETAIL_FIGURE_HAS = {
  gmp: (i) => i.gmp != null || i.gmpPct != null,
  subscription: (i) => i.subTotal != null,
  listingGain: (i) => i.listingGainPct != null,
  listingPrice: (i) => i.listingPrice != null,
  priceBand: (i) => i.priceMin != null || i.priceMax != null,
  minInvestment: (i) => minInvestment(i.lotSize, i.priceMax) != null,
  issueSize: (i) => !!i.issueSize,
};

/**
 * Hero figures per lifecycle stage, most relevant first — the detail-page counterpart of
 * `IpoCard`'s ORDER map, and deliberately the same shape of answer: each stage lists more
 * candidates than it can show and the available ones win, so the headline is always a real
 * number rather than an em dash.
 *
 * Every stage carries the price band and the minimum application amount, because those are what
 * turn a headline into a decision ("₹330 premium" means nothing until you know a lot costs
 * ₹14,950). The lead differs by stage exactly as it does on the card: grey market before
 * bidding, subscription once bidding is done, listing gain once it is over.
 */
const DETAIL_FIGURE_ORDER = {
  upcoming: ['gmp', 'priceBand', 'minInvestment', 'issueSize'],
  open: ['gmp', 'subscription', 'priceBand', 'minInvestment'],
  closed: ['subscription', 'gmp', 'priceBand', 'minInvestment'],
  listed: ['listingGain', 'listingPrice', 'subscription', 'priceBand'],
};

/**
 * The figure keys the detail hero should show for this IPO, in order — first one is the
 * headline. Capped at `max` so the hero stays a hero rather than becoming another flat grid.
 * Returns [] for a falsy IPO or one with nothing at all, which the hero renders as identity +
 * timing only.
 */
export const detailFigures = (ipo, max = 4) => {
  if (!ipo) return [];
  const order = DETAIL_FIGURE_ORDER[ipo.status] ?? DETAIL_FIGURE_ORDER.upcoming;
  return order.filter((key) => DETAIL_FIGURE_HAS[key](ipo)).slice(0, max);
};

/**
 * Which detail tabs have something to say about this IPO.
 *
 * The tab strip had the same problem the cards did before the list redesign: it showed all four
 * sections at every stage, so an upcoming IPO offered a Subscription tab with no bids yet and an
 * Allotment tab for an application nobody could have made.
 *
 * Gating is primarily on the IPO's OWN fields, which arrive with the main query, so the strip
 * settles in one go rather than reshuffling under the reader. `history` widens it: a source can
 * report day-wise points without ever filling the summary figure (`SubscriptionTab` already falls
 * back from `ipo.subTotal` to the latest point's total for exactly that reason), and hiding a tab
 * that has real data behind it would be a worse failure than a tab that appears a moment late.
 */
export const detailTabsFor = (ipo, history = {}) => {
  const { gmp: gmpCount = 0, subscription: subCount = 0 } = history;
  const tabs = ['overview'];
  const hasGreyMarket = !!ipo && (
    ipo.gmp != null || ipo.gmpPct != null || ipo.gmpMin != null || ipo.gmpMax != null
    || ipo.gmpRating != null || ipo.estimatedListingPrice != null
  );
  if (hasGreyMarket || gmpCount > 0) tabs.push('gmp');
  if (ipo?.subTotal != null || subCount > 0) tabs.push('subscription');
  // Bidding has to have opened before there is an application to record or an allotment to check.
  if (ipo?.status && ipo.status !== 'upcoming') tabs.push('allotment');
  return tabs;
};
