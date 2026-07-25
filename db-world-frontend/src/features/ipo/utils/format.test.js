import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { daysLeftLabel, subscriptionLabel, subscriptionMeta, ipoTypeMeta } from './format';

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
  const T = { teal: 'teal', tealBg: 'tealBg' };

  it('labels mainboard distinctly from sme, never a generic "IPO"', () => {
    expect(ipoTypeMeta('mainboard', T)).toEqual({ label: 'Mainboard', color: 'teal', bg: 'tealBg' });
    expect(ipoTypeMeta('sme', T).label).toBe('SME');
    expect(ipoTypeMeta('sme', T).color).not.toBe('teal');
  });

  it('returns null (hide the chip) for an unrecognized/missing ipoType', () => {
    expect(ipoTypeMeta(null, T)).toBeNull();
    expect(ipoTypeMeta(undefined, T)).toBeNull();
    expect(ipoTypeMeta('bogus', T)).toBeNull();
  });
});
