import { describe, it, expect } from 'vitest';
import {
  allocate, allocateEqually, toPaise, fromPaise, sumAmounts, addsUp, previewShares, redistribute,
} from './tallyMath';

/**
 * These fixtures are deliberately the same ones as `TallyAllocatorTest` on the server.
 *
 * The dialog previews what everyone will owe before the expense is saved, which means two
 * implementations of one set of rules. That is only safe while they agree to the paisa — a
 * preview that disagrees with the saved result shows the user one number and charges another.
 * If a case is added on either side, add it on both.
 */

const members = (n) => Array.from({ length: n }, (_, i) => `m${i + 1}`);
const amounts = (rows) => rows.map((r) => r.amount);
const total = (rows) => sumAmounts(amounts(rows));

describe('toPaise / fromPaise', () => {
  it('round-trips rupees through whole paise', () => {
    expect(toPaise('100.00')).toBe(10000n);
    expect(toPaise('0.01')).toBe(1n);
    expect(toPaise(250)).toBe(25000n);
    expect(fromPaise(3334n)).toBe('33.34');
    expect(fromPaise(0n)).toBe('0.00');
    expect(fromPaise(5n)).toBe('0.05');
  });

  it('refuses anything finer than the currency can express', () => {
    // MySQL in strict mode errors where H2 rounds, so sub-paisa input has to die at the edge
    // rather than become a balance that will not close.
    expect(() => toPaise('10.001')).toThrow();
    expect(() => toPaise('abc')).toThrow();
  });
});

describe('equal splits', () => {
  it('keeps the stray paisa when 100 will not divide by 3', () => {
    const out = allocateEqually('100.00', members(3));
    expect(amounts(out)).toEqual(['33.34', '33.33', '33.33']);
    expect(total(out)).toBe('100.00');
  });

  it('does not over-allocate when 100 will not divide by 6', () => {
    // The other direction of the same bug: rounding each share up gives 100.02.
    const out = allocateEqually('100.00', members(6));
    expect(amounts(out)).toEqual(['16.67', '16.67', '16.67', '16.67', '16.66', '16.66']);
    expect(total(out)).toBe('100.00');
  });

  it('preserves the total for every amount up to 100 rupees across every group size to 12', () => {
    for (let paise = 1; paise <= 10000; paise += 7) {
      for (let n = 1; n <= 12; n += 1) {
        const rupees = fromPaise(BigInt(paise));
        const out = allocateEqually(rupees, members(n));
        expect(out).toHaveLength(n);
        expect(total(out), `${rupees} across ${n}`).toBe(rupees);
      }
    }
  });

  it('never lets two shares of an equal split differ by more than a paisa', () => {
    for (let paise = 1; paise <= 2000; paise += 3) {
      for (let n = 1; n <= 9; n += 1) {
        const out = allocateEqually(fromPaise(BigInt(paise)), members(n));
        const values = out.map((r) => r.paise);
        expect(values.reduce((a, b) => (a > b ? a : b)) - values.reduce((a, b) => (a < b ? a : b)))
          .toBeLessThanOrEqual(1n);
      }
    }
  });

  it('gives one participant the whole amount', () => {
    expect(amounts(allocateEqually('77.77', ['a']))).toEqual(['77.77']);
  });

  it('allocates zero to everyone for a zero total', () => {
    expect(amounts(allocateEqually('0.00', members(4)))).toEqual(['0.00', '0.00', '0.00', '0.00']);
  });
});

describe('determinism', () => {
  it('allocates identically on repeated calls', () => {
    // Voiding an expense re-runs this to write its reversal. A second run that disagreed by a
    // paisa would be written into an append-only ledger and stay wrong.
    for (let paise = 1; paise <= 500; paise += 1) {
      const rupees = fromPaise(BigInt(paise));
      expect(allocateEqually(rupees, members(7))).toEqual(allocateEqually(rupees, members(7)));
    }
  });

  it('breaks ties on member id, not insertion order', () => {
    const extra = (ids) => allocateEqually('100.00', ids).find((r) => r.amount === '33.34').memberId;
    expect(extra(['a', 'b', 'c'])).toBe('a');
    expect(extra(['c', 'b', 'a'])).toBe('a');
  });

  it('returns rows in the caller\'s order', () => {
    // The dialog renders in this order; re-sorting here would make rows jump while typing.
    const out = allocateEqually('10.00', ['z', 'a', 'm']);
    expect(out.map((r) => r.memberId)).toEqual(['z', 'a', 'm']);
  });
});

describe('weighted splits', () => {
  it('divides in proportion to shares', () => {
    const out = allocate('300.00', [{ memberId: 'a', weight: 2 }, { memberId: 'b', weight: 1 }]);
    expect(amounts(out)).toEqual(['200.00', '100.00']);
  });

  it('holds the total for percentages that cannot divide cleanly', () => {
    const out = allocate('100.00', [
      { memberId: 'a', weight: '33.3333' },
      { memberId: 'b', weight: '33.3333' },
      { memberId: 'c', weight: '33.3334' },
    ]);
    expect(total(out)).toBe('100.00');
  });

  it('preserves the total across many amounts with fractional weights', () => {
    const weights = [
      { memberId: 'a', weight: '1' }, { memberId: 'b', weight: '2' },
      { memberId: 'c', weight: '3' }, { memberId: 'd', weight: '0.5' },
    ];
    for (let paise = 1; paise <= 3000; paise += 11) {
      const rupees = fromPaise(BigInt(paise));
      expect(total(allocate(rupees, weights)), rupees).toBe(rupees);
    }
  });

  it('gives a zero-weight participant nothing', () => {
    const out = allocate('100.00', [{ memberId: 'a', weight: 1 }, { memberId: 'b', weight: 0 }]);
    expect(amounts(out)).toEqual(['100.00', '0.00']);
  });

  it('refuses weights that all sum to zero', () => {
    expect(() => allocate('10.00', [{ memberId: 'a', weight: 0 }])).toThrow();
  });

  it('refuses a negative total', () => {
    expect(() => allocateEqually('-1.00', members(2))).toThrow();
  });
});

describe('sumAmounts / addsUp', () => {
  it('adds decimals without touching a float', () => {
    // 0.1 + 0.2 in floating point is 0.30000000000000004, which would fail an exact check.
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts(['33.34', '33.33', '33.33'])).toBe('100.00');
  });

  it('ignores half-typed fields rather than throwing while somebody types', () => {
    expect(sumAmounts(['10.00', '', '5.00'])).toBe('15.00');
  });

  it('gates an EXACT split on the parts matching the whole', () => {
    expect(addsUp('100.00', ['40.00', '60.00'])).toBe(true);
    expect(addsUp('100.00', ['40.00', '40.00'])).toBe(false);
    expect(addsUp('100.00', ['99.99', '0.02'])).toBe(false);
  });
});

describe('previewShares', () => {
  const participants = [{ memberId: 'kid' }, { memberId: 'appa' }];

  it('applies the group\'s standing delegation to who owes', () => {
    const rows = previewShares({
      total: '100.00', method: 'EQUAL', participants,
      delegationOf: (id) => (id === 'kid' ? 'appa' : null),
    });
    expect(rows.map((r) => [r.memberId, r.owedByMemberId, r.amount])).toEqual([
      ['kid', 'appa', '50.00'],
      ['appa', 'appa', '50.00'],
    ]);
  });

  it('lets a per-expense override beat the standing delegation', () => {
    const rows = previewShares({
      total: '100.00',
      method: 'EQUAL',
      participants: [{ memberId: 'kid', owedByMemberId: 'kid' }, { memberId: 'appa' }],
      delegationOf: (id) => (id === 'kid' ? 'appa' : null),
    });
    expect(rows[0].owedByMemberId).toBe('kid');
  });

  it('passes EXACT amounts through untouched', () => {
    const rows = previewShares({
      total: '100.00',
      method: 'EXACT',
      participants: [
        { memberId: 'a', exactAmount: '70.00' },
        { memberId: 'b', exactAmount: '30.00' },
      ],
    });
    expect(amounts(rows)).toEqual(['70.00', '30.00']);
  });
});

describe('redistribute — the auto-fill that must not overwrite what you typed', () => {
  const ids = ['a', 'b', 'c'];
  const run = (total, locked, values) => redistribute({
    total, memberIds: ids, locked: new Set(locked), values,
  });

  it('fills every field evenly when nothing is locked', () => {
    const { values } = run('90.00', [], {});
    expect(values).toEqual({ a: '30.00', b: '30.00', c: '30.00' });
  });

  it('gives the odd paisa out rather than losing it', () => {
    const { values } = run('100.00', [], {});
    expect(sumAmounts(Object.values(values))).toBe('100.00');
    expect(values).toEqual({ a: '33.34', b: '33.33', c: '33.33' });
  });

  it('LEAVES A LOCKED FIELD ALONE and spreads the rest over the others', () => {
    // The whole point. Type 50 into `a`, and only b and c may move.
    const { values } = run('90.00', ['a'], { a: '50.00', b: '30.00', c: '30.00' });
    expect(values.a).toBe('50.00');
    expect(values).toEqual({ a: '50.00', b: '20.00', c: '20.00' });
  });

  it('never disturbs a second locked field when a third is edited', () => {
    // The exact failure reported: setting one value moved a value already set by hand.
    const { values } = run('100.00', ['a', 'b'], { a: '50.00', b: '20.00', c: '30.00' });
    expect(values.a).toBe('50.00');
    expect(values.b).toBe('20.00');
    expect(values.c).toBe('30.00');
  });

  it('reports the shortfall once every field is locked', () => {
    const { values, remainder, over } = run('100.00', ids, { a: '10.00', b: '20.00', c: '30.00' });
    expect(values).toEqual({ a: '10.00', b: '20.00', c: '30.00' });
    expect(remainder).toBe('40.00');
    expect(over).toBe(false);
  });

  it('zeroes the untouched fields and flags it when the locked ones already exceed the total', () => {
    const { values, over } = run('100.00', ['a'], { a: '150.00', b: '10.00', c: '10.00' });
    expect(values).toEqual({ a: '150.00', b: '0.00', c: '0.00' });
    expect(over).toBe(true);
  });

  it('works the same for percentages, where the whole is 100', () => {
    const even = run('100', [], {});
    expect(even.values).toEqual({ a: '33.34', b: '33.33', c: '33.33' });

    const withOneSet = run('100', ['a'], { a: '50', b: '0', c: '0' });
    expect(withOneSet.values).toEqual({ a: '50', b: '25.00', c: '25.00' });
  });

  it('treats a half-typed field as zero instead of throwing', () => {
    const { values } = run('60.00', ['a'], { a: '', b: '', c: '' });
    expect(values.b).toBe('30.00');
    expect(values.c).toBe('30.00');
  });
});
