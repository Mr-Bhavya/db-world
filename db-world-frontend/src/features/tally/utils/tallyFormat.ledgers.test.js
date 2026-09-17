import { describe, it, expect } from 'vitest';
import { lastActivity, splitLedgers } from './tallyFormat';

/**
 * How the home screen decides what you see first.
 *
 * This is the whole redesign in one function: the old page sorted by recent activity and
 * filtered by People-or-Groups, which put a settled trip above an open debt. Getting the split
 * wrong buries the one ledger that needs somebody, and it fails quietly — the page still looks
 * fine, it just answers the wrong question.
 */

const ledger = (over = {}) => ({
  id: over.name ?? 'l1',
  name: 'A ledger',
  kind: 'GROUP',
  myBalance: '0.00',
  archived: false,
  memberCount: 3,
  updatedAt: '2026-09-10T10:00:00Z',
  ...over,
});

describe('splitLedgers', () => {
  it('puts anything with a balance in needsYou and the rest in settled', () => {
    const { needsYou, settled } = splitLedgers([
      ledger({ name: 'Square', myBalance: '0.00' }),
      ledger({ name: 'Owing', myBalance: '-65000.00' }),
      ledger({ name: 'Owed', myBalance: '120.00' }),
    ]);

    expect(needsYou.map((l) => l.name)).toEqual(['Owing', 'Owed']);
    expect(settled.map((l) => l.name)).toEqual(['Square']);
  });

  it('sorts needsYou by size, ignoring the direction', () => {
    // Being owed ₹9,000 and owing ₹9,000 are equally worth acting on; the top row should be
    // the biggest number either way, not the biggest debt.
    const { needsYou } = splitLedgers([
      ledger({ name: 'Small debt', myBalance: '-50.00' }),
      ledger({ name: 'Big credit', myBalance: '9000.00' }),
      ledger({ name: 'Medium debt', myBalance: '-400.00' }),
    ]);

    expect(needsYou.map((l) => l.name)).toEqual(['Big credit', 'Medium debt', 'Small debt']);
  });

  it('keeps personal out of both lists', () => {
    // It never has a balance -- one member cannot owe themselves -- so in `settled` it would
    // pad the collapsed count with something that can never be anything else.
    const { personal, needsYou, settled } = splitLedgers([
      ledger({ name: 'Your spending', kind: 'PERSONAL' }),
      ledger({ name: 'Trip', myBalance: '-10.00' }),
    ]);

    expect(personal.name).toEqual('Your spending');
    expect(needsYou.map((l) => l.name)).toEqual(['Trip']);
    expect(settled).toEqual([]);
  });

  it('separates archived, whatever their balance says', () => {
    const { needsYou, settled, archived } = splitLedgers([
      ledger({ name: 'Old trip', myBalance: '-500.00', archived: true }),
      ledger({ name: 'Live', myBalance: '-10.00' }),
    ]);

    expect(archived.map((l) => l.name)).toEqual(['Old trip']);
    expect(needsYou.map((l) => l.name)).toEqual(['Live']);
    expect(settled).toEqual([]);
  });

  it('nets only the live shared ledgers', () => {
    // Archived balances are deliberately out: the hero figure is what needs doing now, and an
    // archived group is finished. Personal is out because it is always zero.
    const { net } = splitLedgers([
      ledger({ name: 'A', myBalance: '-65000.00' }),
      ledger({ name: 'B', myBalance: '5000.00' }),
      ledger({ name: 'Archived', myBalance: '-999.00', archived: true }),
      ledger({ name: 'Mine', kind: 'PERSONAL', myBalance: '0.00' }),
    ]);

    expect(net).toBe(-60000);
  });

  it('survives an empty list rather than throwing on the first render', () => {
    const { personal, needsYou, settled, archived, net } = splitLedgers([]);

    expect(personal).toBeNull();
    expect(needsYou).toEqual([]);
    expect(settled).toEqual([]);
    expect(archived).toEqual([]);
    expect(net).toBe(0);
  });

  it('does not mutate the array it was handed', () => {
    // It sorts, and sort is in place -- on the array TanStack Query is caching.
    const groups = [
      ledger({ name: 'Small', myBalance: '-1.00' }),
      ledger({ name: 'Big', myBalance: '-900.00' }),
    ];
    const order = groups.map((l) => l.name);

    splitLedgers(groups);

    expect(groups.map((l) => l.name)).toEqual(order);
  });
});

describe('lastActivity', () => {
  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

  it('reads as words, coarsely', () => {
    expect(lastActivity(daysAgo(0))).toBe('today');
    expect(lastActivity(daysAgo(1))).toBe('yesterday');
    expect(lastActivity(daysAgo(3))).toBe('3 days ago');
    expect(lastActivity(daysAgo(10))).toBe('last week');
    expect(lastActivity(daysAgo(21))).toBe('3 weeks ago');
    expect(lastActivity(daysAgo(200))).toBe('6 months ago');
    expect(lastActivity(daysAgo(400))).toBe('a year ago');
    expect(lastActivity(daysAgo(900))).toBe('2 years ago');
  });

  it('says nothing rather than Invalid Date', () => {
    expect(lastActivity(null)).toBe('');
    expect(lastActivity('not a date')).toBe('');
  });
});
