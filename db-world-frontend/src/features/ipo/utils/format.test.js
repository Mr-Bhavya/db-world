import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  daysLeftLabel, subscriptionLabel, subscriptionMeta, ipoTypeMeta,
  formatStageDate, buildTimelineStages, expectedListingPrice, dayOverDayDelta, formatExchange,
  averageSubscription, computeQuickStats, shortFinancialLabel, websiteDomain,
  orderSubscriptionCategories, subscriptionCategoryColor,
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

describe('subscriptionLabel', () => {
  it('formats to 1 decimal with the × sign', () => {
    expect(subscriptionLabel(2.4)).toBe('2.4× subscribed');
    expect(subscriptionLabel(0.65)).toBe('0.7× subscribed');
    expect(subscriptionLabel(15)).toBe('15.0× subscribed');
  });

  it('is null when subTotal is null/undefined', () => {
    expect(subscriptionLabel(null)).toBeNull();
    expect(subscriptionLabel(undefined)).toBeNull();
  });
});

describe('subscriptionMeta', () => {
  const T = {
    textFaint: 'faint', glassHover: 'faintBg',
    teal: 'teal', tealBg: 'tealBg',
    success: 'green', successBg: 'greenBg',
    warning: 'orange', warningBg: 'orangeBg',
  };

  it('is null when subTotal is null', () => {
    expect(subscriptionMeta(null, T)).toBeNull();
  });

  it('tiers <1x as muted/grey with a partial fill', () => {
    const meta = subscriptionMeta(0.4, T);
    expect(meta.color).toBe('faint');
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

describe('averageSubscription', () => {
  it('averages every known value', () => {
    expect(averageSubscription([1, 2, 3])).toBe(2);
  });

  it('ignores null/undefined entries rather than treating them as zero', () => {
    expect(averageSubscription([2, null, 4, undefined])).toBe(3);
  });

  it('is null when nothing is known yet', () => {
    expect(averageSubscription([null, undefined])).toBeNull();
    expect(averageSubscription([])).toBeNull();
    expect(averageSubscription(undefined)).toBeNull();
  });

  it('coerces numeric strings', () => {
    expect(averageSubscription(['2', '4'])).toBe(3);
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

describe('subscriptionCategoryColor', () => {
  it('gives the same well-known category the same color regardless of index', () => {
    expect(subscriptionCategoryColor('QIB', 0)).toBe(subscriptionCategoryColor('qib', 3));
  });

  it('gives different well-known categories different colors', () => {
    const colors = new Set([
      subscriptionCategoryColor('QIB'), subscriptionCategoryColor('NII'),
      subscriptionCategoryColor('Retail'), subscriptionCategoryColor('Anchor'),
    ]);
    expect(colors.size).toBe(4);
  });

  it('cycles the fallback palette by index for an unrecognized category', () => {
    expect(subscriptionCategoryColor('SomeNewCategory', 0)).not.toBe(subscriptionCategoryColor('SomeNewCategory', 1));
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
