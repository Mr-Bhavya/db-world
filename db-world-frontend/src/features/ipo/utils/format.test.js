import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  daysLeftLabel, subscriptionLabel, subscriptionMeta, ipoTypeMeta,
  formatStageDate, buildTimelineStages, expectedListingPrice, dayOverDayDelta, formatExchange,
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

  it('reaches an unknown-date stage as "current" once every earlier dated stage is done', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-10', closeDate: '2026-07-14', // both past → done
      allotmentDate: null, refundDate: null, dematDate: null, listingDate: null,
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

  it('promotes the final stage to "current" once fully listed, so there is always exactly one', () => {
    const stages = buildTimelineStages({
      openDate: '2026-07-01', closeDate: '2026-07-05',
      allotmentDate: '2026-07-10', refundDate: '2026-07-12',
      dematDate: '2026-07-13', listingDate: '2026-07-15', // all past
    });
    expect(stages.map((s) => s.status)).toEqual([
      'done', 'done', 'done', 'done', 'done', 'current',
    ]);
    expect(stages.filter((s) => s.status === 'current')).toHaveLength(1);
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
