import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDocDate, daysUntil, expiryState, expiryLabel, formatFileSize,
  computeWalletStats, sortDocuments, filterDocsByStatus, EXPIRING_SOON_DAYS,
} from './walletFormat';

/** Fixed "today" so day-math is deterministic regardless of when the suite runs. */
const TODAY = '2026-07-24T09:00:00';

const withFixedToday = () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TODAY));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
};

describe('formatDocDate', () => {
  it('renders a LocalDate in the app’s short form', () => {
    expect(formatDocDate('2026-07-24')).toBe('24 Jul 2026');
  });

  it('is null for a missing or unparseable date rather than throwing', () => {
    expect(formatDocDate(null)).toBeNull();
    expect(formatDocDate('')).toBeNull();
    expect(formatDocDate('not-a-date')).toBeNull();
  });
});

describe('daysUntil', () => {
  withFixedToday();

  it('floors both ends to midnight, so tomorrow is exactly 1 whatever the time of day', () => {
    expect(daysUntil('2026-07-25')).toBe(1);
    expect(daysUntil('2026-07-24')).toBe(0);
    expect(daysUntil('2026-07-23')).toBe(-1);
  });

  it('is null-safe', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil('nonsense')).toBeNull();
  });
});

describe('expiryState', () => {
  withFixedToday();

  it('treats "no expiry" as a real answer, not a missing one', () => {
    // A birth certificate or a PAN card never expires; the card renders nothing for this.
    expect(expiryState(null)).toEqual({ key: 'none', days: null });
    expect(expiryState(undefined)).toEqual({ key: 'none', days: null });
  });

  it('is expired the day after it lapses, and on the day itself is still expiring', () => {
    expect(expiryState('2026-07-23').key).toBe('expired');
    expect(expiryState('2026-07-24').key).toBe('expiring');
  });

  it('holds the expiring window open to exactly EXPIRING_SOON_DAYS', () => {
    const inWindow = new Date('2026-07-24');
    inWindow.setDate(inWindow.getDate() + EXPIRING_SOON_DAYS);
    const past = new Date('2026-07-24');
    past.setDate(past.getDate() + EXPIRING_SOON_DAYS + 1);
    const iso = (d) => d.toISOString().slice(0, 10);
    expect(expiryState(iso(inWindow)).key).toBe('expiring');
    expect(expiryState(iso(past)).key).toBe('valid');
  });
});

describe('expiryLabel', () => {
  withFixedToday();

  it('names the day for the cases a count of days reads badly', () => {
    expect(expiryLabel('2026-07-24')).toBe('Expires today');
    expect(expiryLabel('2026-07-25')).toBe('Expires tomorrow');
    expect(expiryLabel('2026-07-23')).toBe('Expired yesterday');
  });

  it('counts days inside a month and months beyond it, and gets the singular right', () => {
    expect(expiryLabel('2026-08-13')).toBe('Expires in 20d');
    expect(expiryLabel('2026-08-31')).toBe('Expires in 1 month');
    expect(expiryLabel('2026-09-22')).toBe('Expires in 2 months');
  });

  it('states the date for something long-dated or long-lapsed', () => {
    expect(expiryLabel('2031-03-12')).toBe('Valid to 12 Mar 2031');
    expect(expiryLabel('2024-03-12')).toBe('Expired 12 Mar 2024');
  });

  it('is null when there is no expiry, so the caller renders no pill at all', () => {
    expect(expiryLabel(null)).toBeNull();
  });
});

describe('formatFileSize', () => {
  it('uses whole numbers below a megabyte and one decimal above', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(831488)).toBe('812 KB');
    expect(formatFileSize(1_468_006)).toBe('1.4 MB');
  });

  it('is null for a missing, zero or nonsense size rather than "0 B"', () => {
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(0)).toBeNull();
    expect(formatFileSize('abc')).toBeNull();
  });
});

describe('computeWalletStats', () => {
  withFixedToday();

  const docs = [
    { id: 'a', expiryDate: '2024-01-01' },                 // expired
    { id: 'b', expiryDate: '2026-08-01', shared: true },   // expiring + shared
    { id: 'c', expiryDate: '2031-01-01' },                 // valid
    { id: 'd', expiryDate: null, shared: true },           // no expiry + shared
  ];

  it('counts each state once', () => {
    expect(computeWalletStats(docs)).toEqual({ total: 4, expiring: 1, expired: 1, shared: 2 });
  });

  it('degrades to zeroes for a missing or non-array input rather than throwing', () => {
    expect(computeWalletStats(null)).toEqual({ total: 0, expiring: 0, expired: 0, shared: 0 });
    expect(computeWalletStats({ documents: [] })).toEqual({ total: 0, expiring: 0, expired: 0, shared: 0 });
  });
});

describe('sortDocuments', () => {
  withFixedToday();

  const docs = [
    { id: 'a', label: 'Passport', expiryDate: '2031-01-01', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', label: 'Aadhaar', expiryDate: null, createdAt: '2026-05-01T00:00:00Z' },
    { id: 'c', label: 'Licence', expiryDate: '2026-08-01', createdAt: '2026-03-01T00:00:00Z' },
  ];
  const ids = (list) => list.map((d) => d.id);

  it('puts the soonest expiry first and documents with NO expiry last', () => {
    // A null date is not an urgent one — ranking it explicitly avoids treating it as either
    // 0 (first) or Infinity-by-accident.
    expect(ids(sortDocuments(docs, 'expiry'))).toEqual(['c', 'a', 'b']);
  });

  it('sorts by name and by recency', () => {
    expect(ids(sortDocuments(docs, 'name'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortDocuments(docs, 'recent'))).toEqual(['b', 'c', 'a']);
  });

  it('never mutates the input, and is null-safe', () => {
    const input = [...docs];
    sortDocuments(input, 'name');
    expect(ids(input)).toEqual(['a', 'b', 'c']);
    expect(sortDocuments(null, 'name')).toEqual([]);
  });
});

describe('filterDocsByStatus', () => {
  withFixedToday();

  const docs = [
    { id: 'a', expiryDate: '2024-01-01' },
    { id: 'b', expiryDate: '2026-08-01', shared: true },
    { id: 'c', expiryDate: null },
  ];

  it('filters to one state at a time', () => {
    expect(filterDocsByStatus(docs, 'expired').map((d) => d.id)).toEqual(['a']);
    expect(filterDocsByStatus(docs, 'expiring').map((d) => d.id)).toEqual(['b']);
    expect(filterDocsByStatus(docs, 'shared').map((d) => d.id)).toEqual(['b']);
  });

  it('keeps everything for an empty or unknown status', () => {
    expect(filterDocsByStatus(docs, '')).toHaveLength(3);
    expect(filterDocsByStatus(docs, 'weird')).toHaveLength(3);
    expect(filterDocsByStatus(null, 'expired')).toEqual([]);
  });
});
