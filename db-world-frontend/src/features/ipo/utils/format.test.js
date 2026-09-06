import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  daysLeftLabel, subscriptionMeta, ipoTypeMeta,
  formatStageDate, buildTimelineStages, expectedListingPrice, dayOverDayDelta, formatExchange,
  computeQuickStats, shortFinancialLabel, websiteDomain,
  orderSubscriptionCategories, computeLotBreakdown,
  formatAmount, minInvestment, biddingProgressPct, detailFigures, detailTabsFor,
} from './format';

/** Fixed "today" so day-math is deterministic regardless of when the suite runs. */
const TODAY = '2026-07-24T09:00:00';

describe('daysLeftLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a falsy ipo', () => {
    expect(daysLeftLabel(null)).toBeNull();
    expect(daysLeftLabel(undefined)).toBeNull();
  });

  it('returns null for an unknown/missing status', () => {
    expect(daysLeftLabel({ status: 'weird' })).toBeNull();
    expect(daysLeftLabel({})).toBeNull();
  });

  describe('upcoming', () => {
    it('shows days until openDate', () => {
      expect(daysLeftLabel({ status: 'upcoming', openDate: '2026-07-29' })).toBe('Opens in 5d');
    });

    it('shows "Opens today" when openDate is today', () => {
      expect(daysLeftLabel({ status: 'upcoming', openDate: '2026-07-24' })).toBe('Opens today');
    });

    it('is null-safe when openDate is missing', () => {
      expect(daysLeftLabel({ status: 'upcoming', openDate: null })).toBeNull();
    });
  });

  describe('open', () => {
    it('shows days left until closeDate', () => {
      expect(daysLeftLabel({ status: 'open', closeDate: '2026-07-27' })).toBe('3d left');
    });

    it('shows "Closing today" when closeDate is today', () => {
      expect(daysLeftLabel({ status: 'open', closeDate: '2026-07-24' })).toBe('Closing today');
    });

    it('is null-safe when closeDate is missing', () => {
      expect(daysLeftLabel({ status: 'open', closeDate: undefined })).toBeNull();
    });
  });

  describe('closed', () => {
    it('prefers a future allotmentDate when present', () => {
      expect(daysLeftLabel({
        status: 'closed', allotmentDate: '2026-07-26', listingDate: '2026-07-30',
      })).toBe('Allotment in 2d');
    });

    it('falls back to a future listingDate when allotmentDate is absent', () => {
      expect(daysLeftLabel({ status: 'closed', listingDate: '2026-07-28' })).toBe('Lists in 4d');
    });

    it('falls back to "Listing soon" when neither date is in the future', () => {
      expect(daysLeftLabel({ status: 'closed' })).toBe('Listing soon');
      expect(daysLeftLabel({ status: 'closed', listingDate: '2026-07-20' })).toBe('Listing soon');
    });
  });

  describe('listed', () => {
    it('shows days since listingDate', () => {
      expect(daysLeftLabel({ status: 'listed', listingDate: '2026-07-20' })).toBe('Listed 4d ago');
    });

    it('shows "Listed today" when listingDate is today', () => {
      expect(daysLeftLabel({ status: 'listed', listingDate: '2026-07-24' })).toBe('Listed today');
    });

    it('is null-safe when listingDate is missing', () => {
      expect(daysLeftLabel({ status: 'listed', listingDate: null })).toBeNull();
    });
  });
});


describe('subscriptionMeta', () => {
  const T = {
    textMuted: 'muted', textFaint: 'faint', glassHover: 'faintBg',
    teal: 'teal', tealBg: 'tealBg',
    success: 'green', successBg: 'greenBg',
    warning: 'orange', warningBg: 'orangeBg',
  };

  it('is null when subTotal is null', () => {
    expect(subscriptionMeta(null, T)).toBeNull();
  });

  it('tiers <1x as muted/grey with a partial fill', () => {
    const meta = subscriptionMeta(0.4, T);
    // `textMuted`, not `textFaint`: still the dimmest of the four tiers, but readable — 0.46
    // alpha rendered an undersubscribed multiple and its bar as barely-there grey.
    expect(meta.color).toBe('muted');
    expect(meta.fillPct).toBe(40);
    expect(meta.hot).toBe(false);
  });

  it('tiers 1-3x as teal with a full fill', () => {
    const meta = subscriptionMeta(2.4, T);
    expect(meta.color).toBe('teal');
    expect(meta.fillPct).toBe(100);
  });

  it('tiers 3-10x as success/green', () => {
    expect(subscriptionMeta(3, T).color).toBe('green');
    expect(subscriptionMeta(10, T).color).toBe('green');
  });

  it('tiers >10x as hot/warning', () => {
    const meta = subscriptionMeta(15, T);
    expect(meta.color).toBe('orange');
    expect(meta.hot).toBe(true);
  });

  it('never exceeds a 100% fill even far past 1x', () => {
    expect(subscriptionMeta(50, T).fillPct).toBe(100);
  });
});

describe('ipoTypeMeta', () => {
  const T = { teal: 'teal', tealBg: 'tealBg', violet: 'violet', violetBg: 'violetBg' };

  it('labels mainboard distinctly from sme, never a generic "IPO"', () => {
    expect(ipoTypeMeta('mainboard', T)).toEqual({ label: 'Mainboard', color: 'teal', bg: 'tealBg' });
    expect(ipoTypeMeta('sme', T)).toEqual({ label: 'SME', color: 'violet', bg: 'violetBg' });
  });

  it('returns null (hide the chip) for an unrecognized/missing ipoType', () => {
    expect(ipoTypeMeta(null, T)).toBeNull();
    expect(ipoTypeMeta(undefined, T)).toBeNull();
    expect(ipoTypeMeta('bogus', T)).toBeNull();
  });
});

describe('formatStageDate', () => {
  it('splits a "yyyy-MM-dd" into day+month and year', () => {
    expect(formatStageDate('2026-07-24')).toEqual({ dayMonth: '24 Jul', year: '2026' });
  });

  it('is null-safe for missing/unparseable input', () => {
    expect(formatStageDate(null)).toBeNull();
    expect(formatStageDate(undefined)).toBeNull();
    expect(formatStageDate('not-a-date')).toBeNull();
  });
});

describe('buildTimelineStages', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T09:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns [] for a falsy ipo', () => {
    expect(buildTimelineStages(null)).toEqual([]);
    expect(buildTimelineStages(undefined)).toEqual([]);
  });

  it('always returns all 6 stages, in order, even when most dates are unknown', () => {
    const stages = buildTimelineStages({
      openDate: '2026-08-01', closeDate: null,
      allotmentDate: null, refundDate: null, dematDate: null, listingDate: null,
    });
    expect(stages.map((s) => s.key)).toEqual(['open', 'close', 'allotment', 'refund', 'demat', 'listing']);
  });

  it('shows a null date as TBA/pending rather than dropping the stage', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-10', closeDate: '2026-07-14',
      allotmentDate: null, refundDate: null, dematDate: null, listingDate: null,
    });
    const allotment = stages.find((s) => s.key === 'allotment');
    expect(allotment.date).toBeNull();
    expect(allotment.status).not.toBe('done');
  });

  it('marks past dates done, the nearest upcoming/today date current, and the rest upcoming — an open IPO', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-10',       // past → done
      closeDate: '2026-07-14',      // past → done
      allotmentDate: '2026-07-24',  // today → current
      refundDate: '2026-07-26',     // future → upcoming
      dematDate: '2026-07-26',      // future → upcoming
      listingDate: '2026-07-28',    // future → upcoming
    });
    expect(stages.map((s) => [s.key, s.status])).toEqual([
      ['open', 'done'],
      ['close', 'done'],
      ['allotment', 'current'],
      ['refund', 'upcoming'],
      ['demat', 'upcoming'],
      ['listing', 'upcoming'],
    ]);
  });

  it('marks the first stage current and every later stage upcoming/TBA — an upcoming IPO with nothing started yet', () => {
    const stages = buildTimelineStages({
      openDate: '2026-08-01', closeDate: '2026-08-05',
      allotmentDate: null, refundDate: null, dematDate: null, listingDate: null,
    });
    expect(stages.map((s) => s.status)).toEqual([
      'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
    // The still-unknown stages carry a null date so the UI renders "TBA" for them.
    expect(stages.find((s) => s.key === 'listing').date).toBeNull();
  });

  it('leaves an unknown-date stage "upcoming" (TBA), not "current", even once every earlier dated stage is done — no known date, no current promotion', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-10', closeDate: '2026-07-14', // both past → done
      allotmentDate: null, refundDate: null, dematDate: null, listingDate: null,
    });
    expect(stages.map((s) => [s.key, s.status])).toEqual([
      ['open', 'done'],
      ['close', 'done'],
      ['allotment', 'upcoming'],
      ['refund', 'upcoming'],
      ['demat', 'upcoming'],
      ['listing', 'upcoming'],
    ]);
    expect(stages.some((s) => s.status === 'current')).toBe(false);
  });

  // KEY REGRESSION TEST: with the old positional logic, `currentIndex` was pinned to the
  // first pending stage (Refund, since its date is null) and *everything after it* —
  // including the already-past Listing date — rendered as positional "upcoming". A listed
  // IPO whose registrar hasn't published Refund/Demat dates yet must still show Listing as
  // done: done-ness is now evaluated per stage from that stage's own date, never blocked by
  // an earlier stage's unknown date.
  it('marks Listing "done" from its own past date even when earlier Refund/Demat dates are still null/TBA — a listed IPO', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-01',      // past → done
      closeDate: '2026-07-05',     // past → done
      allotmentDate: '2026-07-10', // past → done
      refundDate: null,            // unknown → TBA/pending, never "done"
      dematDate: null,             // unknown → TBA/pending, never "done"
      listingDate: '2026-07-20',   // past → done, regardless of Refund/Demat being null
    });
    expect(stages.map((s) => [s.key, s.status])).toEqual([
      ['open', 'done'],
      ['close', 'done'],
      ['allotment', 'done'],
      ['refund', 'upcoming'],
      ['demat', 'upcoming'],
      ['listing', 'done'],
    ]);
    const refund = stages.find((s) => s.key === 'refund');
    const demat = stages.find((s) => s.key === 'demat');
    expect(refund.date).toBeNull();
    expect(demat.date).toBeNull();
    // No stage is "current" here: Refund/Demat are pending-but-dateless (never current),
    // and there's no later not-done dated stage either.
    expect(stages.some((s) => s.status === 'current')).toBe(false);
  });

  it('marks every stage "done" with no "current" at all once all 6 dates are in the past — a fully-completed timeline', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-01', closeDate: '2026-07-05',
      allotmentDate: '2026-07-10', refundDate: '2026-07-12',
      dematDate: '2026-07-13', listingDate: '2026-07-15', // all past
    });
    expect(stages.map((s) => s.status)).toEqual([
      'done', 'done', 'done', 'done', 'done', 'done',
    ]);
    expect(stages.some((s) => s.status === 'current')).toBe(false);
  });

  it('marks a today-dated Open as "current" (not done) with every later null-date stage upcoming/TBA — a brand-new upcoming IPO', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-24', // today → not done yet, and the sole current stage
      closeDate: null, allotmentDate: null, refundDate: null, dematDate: null, listingDate: null,
    });
    expect(stages.map((s) => [s.key, s.status])).toEqual([
      ['open', 'current'],
      ['close', 'upcoming'],
      ['allotment', 'upcoming'],
      ['refund', 'upcoming'],
      ['demat', 'upcoming'],
      ['listing', 'upcoming'],
    ]);
    expect(stages.filter((s) => s.status === 'current')).toHaveLength(1);
  });

  it('marks a past-dated Open as "done" with every later null-date stage upcoming/TBA and no "current" — nothing else scheduled yet', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-10', // past → done
      closeDate: null, allotmentDate: null, refundDate: null, dematDate: null, listingDate: null,
    });
    expect(stages.map((s) => [s.key, s.status])).toEqual([
      ['open', 'done'],
      ['close', 'upcoming'],
      ['allotment', 'upcoming'],
      ['refund', 'upcoming'],
      ['demat', 'upcoming'],
      ['listing', 'upcoming'],
    ]);
    expect(stages.some((s) => s.status === 'current')).toBe(false);
  });
});

describe('formatExchange', () => {
  it('maps BOTH to the two real exchange names', () => {
    expect(formatExchange('BOTH')).toBe('BSE, NSE');
  });

  it('passes NSE/BSE through unchanged', () => {
    expect(formatExchange('NSE')).toBe('NSE');
    expect(formatExchange('BSE')).toBe('BSE');
  });

  it('renders an em dash for a missing exchange rather than a blank value', () => {
    expect(formatExchange(null)).toBe('—');
    expect(formatExchange(undefined)).toBe('—');
  });
});

describe('expectedListingPrice', () => {
  it('adds the latest GMP to the upper price band and derives the gain %', () => {
    expect(expectedListingPrice(100, 20)).toEqual({ price: 120, gainPct: 20 });
  });

  it('handles a negative GMP (expected discount to the band)', () => {
    expect(expectedListingPrice(100, -10)).toEqual({ price: 90, gainPct: -10 });
  });

  it('is null when priceMax is missing', () => {
    expect(expectedListingPrice(null, 20)).toBeNull();
  });

  it('is null when the latest GMP is missing', () => {
    expect(expectedListingPrice(100, null)).toBeNull();
  });

  it('is null when priceMax is zero (can\'t derive a %)', () => {
    expect(expectedListingPrice(0, 20)).toBeNull();
  });
});

describe('computeQuickStats', () => {
  it('is all-zero/null for an empty or missing list', () => {
    expect(computeQuickStats([])).toEqual({ openCount: 0, upcomingCount: 0, topGmp: null });
    expect(computeQuickStats(null)).toEqual({ openCount: 0, upcomingCount: 0, topGmp: null });
    expect(computeQuickStats(undefined)).toEqual({ openCount: 0, upcomingCount: 0, topGmp: null });
  });

  it('counts open and upcoming separately, ignoring closed/listed', () => {
    const stats = computeQuickStats([
      { status: 'open' }, { status: 'open' }, { status: 'upcoming' },
      { status: 'closed' }, { status: 'listed' },
    ]);
    expect(stats.openCount).toBe(2);
    expect(stats.upcomingCount).toBe(1);
  });

  it('picks the IPO with the single highest gmpPct', () => {
    const stats = computeQuickStats([
      { status: 'open', companyName: 'Alpha', gmpPct: 12 },
      { status: 'open', companyName: 'Beta', gmpPct: 40 },
      { status: 'closed', companyName: 'Gamma', gmpPct: 25 },
    ]);
    expect(stats.topGmp).toEqual({ companyName: 'Beta', gmpPct: 40 });
  });

  it('never lets a null/undefined gmpPct win by being treated as 0', () => {
    const stats = computeQuickStats([
      { status: 'open', companyName: 'Alpha', gmpPct: null },
      { status: 'open', companyName: 'Beta', gmpPct: -5 },
    ]);
    expect(stats.topGmp).toEqual({ companyName: 'Beta', gmpPct: -5 });
  });

  it('is null when nothing in the list has a known gmpPct', () => {
    const stats = computeQuickStats([{ status: 'open', gmpPct: null }, { status: 'upcoming' }]);
    expect(stats.topGmp).toBeNull();
  });
});

describe('shortFinancialLabel', () => {
  it('collapses a "FY yyyy-yy" range to the 4-digit ending year', () => {
    expect(shortFinancialLabel('FY 2021-22')).toBe('2022');
    expect(shortFinancialLabel('FY 2022-23')).toBe('2023');
  });

  it('rolls the century over correctly for a century-crossing range', () => {
    expect(shortFinancialLabel('FY 1999-00')).toBe('2000');
  });

  it('handles the range with no space after "FY"', () => {
    expect(shortFinancialLabel('FY2021-22')).toBe('2022');
  });

  it('expands a short "FYyy" form to the 4-digit ending year', () => {
    expect(shortFinancialLabel('FY22')).toBe('2022');
    expect(shortFinancialLabel('FY 26')).toBe('2026');
  });

  it('extracts the year from a "Mon yyyy" / "d Mon yyyy" period-end label', () => {
    expect(shortFinancialLabel('Mar 2026')).toBe('2026');
    expect(shortFinancialLabel('31 Mar 2026')).toBe('2026');
  });

  it('passes through anything it does not recognize unchanged', () => {
    expect(shortFinancialLabel('2026')).toBe('2026');
  });

  it('is null-safe', () => {
    expect(shortFinancialLabel(null)).toBeNull();
    expect(shortFinancialLabel(undefined)).toBeNull();
    expect(shortFinancialLabel('')).toBe('');
  });
});

describe('websiteDomain', () => {
  it('strips the scheme, path, and a leading "www."', () => {
    expect(websiteDomain('https://www.paytm.com/ipo')).toBe('paytm.com');
    expect(websiteDomain('https://zomato.com')).toBe('zomato.com');
  });

  it('falls back to the raw string when it cannot be parsed as a URL', () => {
    expect(websiteDomain('paytm.com')).toBe('paytm.com');
  });

  it('is null-safe', () => {
    expect(websiteDomain(null)).toBeNull();
    expect(websiteDomain(undefined)).toBeNull();
    expect(websiteDomain('')).toBeNull();
  });
});

describe('orderSubscriptionCategories', () => {
  it('sorts the classic trio into QIB, NII, Retail regardless of input order', () => {
    expect(orderSubscriptionCategories(['Retail', 'QIB', 'NII'])).toEqual(['QIB', 'NII', 'Retail']);
  });

  it('matches the preferred list case-insensitively', () => {
    expect(orderSubscriptionCategories(['retail', 'qib', 'nii'])).toEqual(['qib', 'nii', 'retail']);
  });

  it('places extra categories after the preferred trio, in the preferred list\'s own order', () => {
    expect(orderSubscriptionCategories(['Anchor', 'Retail', 'Shareholder', 'QIB', 'Employee', 'NII']))
      .toEqual(['QIB', 'NII', 'Retail', 'Employee', 'Shareholder', 'Anchor']);
  });

  it('sorts unrecognized categories alphabetically after every preferred one', () => {
    expect(orderSubscriptionCategories(['Zeta', 'QIB', 'Alpha', 'Retail']))
      .toEqual(['QIB', 'Retail', 'Alpha', 'Zeta']);
  });

  it('treats HNI as an alias for NII and RII as an alias for Retail (same rank as the canonical name)', () => {
    expect(orderSubscriptionCategories(['HNI', 'QIB', 'RII'])).toEqual(['QIB', 'HNI', 'RII']);
  });

  it('is null-safe and never mutates the input array', () => {
    const input = ['Retail', 'QIB'];
    expect(orderSubscriptionCategories(null)).toEqual([]);
    expect(orderSubscriptionCategories(undefined)).toEqual([]);
    expect(orderSubscriptionCategories([])).toEqual([]);
    orderSubscriptionCategories(input);
    expect(input).toEqual(['Retail', 'QIB']);
  });
});


describe('computeLotBreakdown', () => {
  it('returns the mainboard tranches as ranges, with B-HNI open-ended (lot 34 @ ₹425)', () => {
    const { minBidShares, lotValue, tranches } = computeLotBreakdown(34, 425, 'mainboard');
    expect(minBidShares).toBe(34);
    expect(lotValue).toBe(14450);
    expect(tranches).toEqual([
      {
        key: 'retail', label: 'Retail', group: 'retail',
        minLots: 1, maxLots: 13, minShares: 34, maxShares: 442, minAmount: 14450, maxAmount: 187850,
      },
      {
        key: 'shni', label: 'S-HNI', group: 'hni',
        minLots: 14, maxLots: 69, minShares: 476, maxShares: 2346, minAmount: 202300, maxAmount: 997050,
      },
      {
        key: 'bhni', label: 'B-HNI', group: 'hni',
        minLots: 70, maxLots: null, minShares: 2380, maxShares: null, minAmount: 1011500, maxAmount: null,
      },
    ]);
  });

  it('keeps every tranche inside its SEBI cap', () => {
    const { tranches } = computeLotBreakdown(34, 425, 'mainboard');
    const [retail, shni, bhni] = tranches;
    expect(retail.maxAmount).toBeLessThanOrEqual(200000);
    expect(shni.minAmount).toBeGreaterThan(200000);
    expect(shni.maxAmount).toBeLessThanOrEqual(1000000);
    expect(bhni.minAmount).toBeGreaterThan(1000000);
  });

  it('gives SME a single open-ended HNI tranche above the retail cap (no 2L/10L split)', () => {
    const { tranches } = computeLotBreakdown(1200, 100, 'sme'); // lot value ₹1,20,000
    expect(tranches.map((t) => t.label)).toEqual(['Retail', 'HNI']);
    // One lot is ₹1,20,000 — a second would breach ₹2L, so retail is a single-lot "range".
    expect(tranches[0]).toMatchObject({ minLots: 1, maxLots: 1 });
    expect(tranches[1]).toMatchObject({ minLots: 2, maxLots: null, maxAmount: null });
  });

  it('is null when lot size or price is missing/zero', () => {
    expect(computeLotBreakdown(null, 425, 'mainboard')).toBeNull();
    expect(computeLotBreakdown(34, 0, 'mainboard')).toBeNull();
    expect(computeLotBreakdown(0, 425, 'mainboard')).toBeNull();
  });
});

describe('dayOverDayDelta', () => {
  it('reports an "up" direction for an increase', () => {
    expect(dayOverDayDelta(55, 50)).toEqual({ delta: 5, direction: 'up' });
  });

  it('reports a "down" direction for a decrease', () => {
    expect(dayOverDayDelta(45, 50)).toEqual({ delta: -5, direction: 'down' });
  });

  it('reports "flat" for no change', () => {
    expect(dayOverDayDelta(50, 50)).toEqual({ delta: 0, direction: 'flat' });
  });

  it('is null when either side is missing (e.g. the earliest row)', () => {
    expect(dayOverDayDelta(50, null)).toBeNull();
    expect(dayOverDayDelta(null, 50)).toBeNull();
  });
});


describe('formatAmount', () => {
  it('groups the Indian way and drops paise', () => {
    expect(formatAmount(14950)).toBe('₹14,950');
    expect(formatAmount(1011500)).toBe('₹10,11,500');
    expect(formatAmount(14449.6)).toBe('₹14,450');
  });

  it('is null-safe', () => {
    expect(formatAmount(null)).toBeNull();
    expect(formatAmount(undefined)).toBeNull();
  });

  it('formats a genuine zero rather than treating it as missing', () => {
    expect(formatAmount(0)).toBe('₹0');
  });
});

describe('minInvestment', () => {
  it('is one lot at the cut-off price', () => {
    expect(minInvestment(26, 575)).toBe(14950);
  });

  it('is null when either input is missing or non-positive', () => {
    expect(minInvestment(null, 575)).toBeNull();
    expect(minInvestment(26, null)).toBeNull();
    expect(minInvestment(0, 575)).toBeNull();
    expect(minInvestment(26, 0)).toBeNull();
    expect(minInvestment(-26, 575)).toBeNull();
  });
});

describe('biddingProgressPct', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY)); // 2026-07-24
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts whole days inclusively — the open day is day 1 of the window', () => {
    // 24-28 Jul is a 5-day window; today is the open day.
    expect(biddingProgressPct('2026-07-24', '2026-07-28')).toBeCloseTo(20);
  });

  it('reports the midpoint part-way through', () => {
    // 22-26 Jul: today (24th) is day 3 of 5.
    expect(biddingProgressPct('2026-07-22', '2026-07-26')).toBeCloseTo(60);
  });

  it('clamps to 0 before the window opens and 100 once it has closed', () => {
    expect(biddingProgressPct('2026-07-28', '2026-08-01')).toBe(0);
    expect(biddingProgressPct('2026-07-14', '2026-07-18')).toBe(100);
  });

  it('handles a single-day window', () => {
    expect(biddingProgressPct('2026-07-24', '2026-07-24')).toBe(100);
  });

  it('is null when a date is missing or the window is inverted', () => {
    expect(biddingProgressPct(null, '2026-07-28')).toBeNull();
    expect(biddingProgressPct('2026-07-24', null)).toBeNull();
    expect(biddingProgressPct('2026-07-28', '2026-07-24')).toBeNull();
  });
});

describe('detailFigures', () => {
  const open = {
    status: 'open', gmp: 330, gmpPct: 57.4, subTotal: 12.3,
    priceMin: 546, priceMax: 575, lotSize: 26,
  };

  it('leads an open IPO with the grey market, then subscription, band and cost', () => {
    expect(detailFigures(open)).toEqual(['gmp', 'subscription', 'priceBand', 'minInvestment']);
  });

  it('leads a listed IPO with its listing gain', () => {
    expect(detailFigures({
      status: 'listed', listingGainPct: 12.5, listingPrice: 647, subTotal: 30, priceMax: 575,
    })).toEqual(['listingGain', 'listingPrice', 'subscription', 'priceBand']);
  });

  it('leads a closed IPO with the final subscription', () => {
    expect(detailFigures({ status: 'closed', subTotal: 30, gmp: 100, priceMax: 575, lotSize: 26 })[0])
      .toBe('subscription');
  });

  it('never offers a figure whose value is missing, so nothing can render as an em dash', () => {
    // An upcoming IPO with no grey market yet falls through to what it does have.
    expect(detailFigures({ status: 'upcoming', priceMin: 100, priceMax: 120, lotSize: 100 }))
      .toEqual(['priceBand', 'minInvestment']);
    expect(detailFigures({ status: 'open' })).toEqual([]);
  });

  it('caps how many figures the hero shows', () => {
    expect(detailFigures(open, 2)).toEqual(['gmp', 'subscription']);
  });

  it('falls back to the upcoming order for an unrecognised status, and is null-safe', () => {
    expect(detailFigures({ status: 'weird', priceMin: 100, priceMax: 120 })).toEqual(['priceBand']);
    expect(detailFigures(null)).toEqual([]);
  });
});

describe('detailTabsFor', () => {
  it('gives an upcoming IPO with no grey market the overview alone', () => {
    expect(detailTabsFor({ status: 'upcoming' })).toEqual(['overview']);
  });

  it('adds GMP as soon as any grey-market figure exists', () => {
    expect(detailTabsFor({ status: 'upcoming', gmpRating: 4 })).toEqual(['overview', 'gmp']);
    expect(detailTabsFor({ status: 'upcoming', estimatedListingPrice: 900 })).toEqual(['overview', 'gmp']);
  });

  it('adds subscription only once bids have been reported', () => {
    expect(detailTabsFor({ status: 'open' })).toEqual(['overview', 'allotment']);
    expect(detailTabsFor({ status: 'open', subTotal: 1.2 })).toEqual(['overview', 'subscription', 'allotment']);
  });

  it('withholds allotment until bidding has opened', () => {
    expect(detailTabsFor({ status: 'upcoming', subTotal: 1.2 })).toEqual(['overview', 'subscription']);
    expect(detailTabsFor({ status: 'listed', gmp: 10, subTotal: 30 }))
      .toEqual(['overview', 'gmp', 'subscription', 'allotment']);
  });

  it('still offers a tab when a history exists without its summary figure', () => {
    expect(detailTabsFor({ status: 'closed' }, { gmp: 4, subscription: 3 }))
      .toEqual(['overview', 'gmp', 'subscription', 'allotment']);
  });

  it('is null-safe, and defaults the history counts', () => {
    expect(detailTabsFor(null)).toEqual(['overview']);
    expect(detailTabsFor(undefined)).toEqual(['overview']);
    expect(detailTabsFor({ status: 'closed' }, {})).toEqual(['overview', 'allotment']);
  });
});
