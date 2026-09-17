import { describe, expect, it } from 'vitest';
import { cumulativeSeries, todayIso } from './chartSeries';

/** A period of `n` days starting at `from`, with `amounts` laid over the front of it. */
function days(from, n, amounts = []) {
  const start = new Date(`${from}T00:00:00`);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { start: todayIso(date), amount: amounts[i] ?? 0 };
  });
}

describe('todayIso', () => {
  it('reads the local date, not the UTC one', () => {
    // 00:30 on the 16th in IST is still the 15th in UTC. toISOString() would say the 15th and
    // the running total would stop a day early for everybody east of Greenwich.
    expect(todayIso(new Date(2026, 8, 16, 0, 30))).toBe('2026-09-16');
  });

  it('pads single-digit months and days, so the strings sort', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('cumulativeSeries', () => {
  it('adds up as it goes', () => {
    const { current } = cumulativeSeries(days('2026-09-01', 4, [100, 50, 0, 25]), [], '2026-09-30');

    expect(current).toEqual([100, 150, 150, 175]);
  });

  it('stops at today rather than running flat to the end of the period', () => {
    const buckets = days('2026-09-01', 30, [100, 50, 0, 25]);

    const { current } = cumulativeSeries(buckets, [], '2026-09-04');

    // Four points, then nothing. The 5th onwards are days that have not happened, and drawing
    // them as a flat line says the spending stopped.
    expect(current.slice(0, 4)).toEqual([100, 150, 150, 175]);
    expect(current.slice(4).every((v) => v === null)).toBe(true);
  });

  it('runs to the end of a period that is already over', () => {
    const buckets = days('2026-08-01', 31, [10, 20]);

    const { current } = cumulativeSeries(buckets, [], '2026-09-16');

    expect(current.at(-1)).toBe(30);
    expect(current).not.toContain(null);
  });

  it('drops the previous period days that this one has no room for', () => {
    // 31 days of August against 30 of September: the 31st has nothing to sit beside.
    const september = days('2026-09-01', 30);
    const august = days('2026-08-01', 31, Array(31).fill(10));

    const { previous } = cumulativeSeries(september, august, '2026-09-30');

    expect(previous).toHaveLength(30);
    expect(previous.at(-1)).toBe(300);
  });

  it('leaves the previous period short rather than dropping it to zero', () => {
    // 28 days of February against 31 of March. The tail must be null: a zero would draw the
    // grey line falling off a cliff on the 29th, which reads as a month that stopped spending.
    const march = days('2026-03-01', 31);
    const february = days('2026-02-01', 28, Array(28).fill(5));

    const { previous } = cumulativeSeries(march, february, '2026-03-31');

    expect(previous).toHaveLength(31);
    expect(previous[27]).toBe(140);
    expect(previous.slice(28)).toEqual([null, null, null]);
  });

  it('aligns the two periods by index, so day one meets day one', () => {
    const september = days('2026-09-01', 30, [0, 0, 300]);
    const august = days('2026-08-01', 31, [100]);

    const { current, previous } = cumulativeSeries(september, august, '2026-09-30');

    // By the 1st, last month was already at 100 and this month at nothing -- the comparison is
    // against where August had got to by ITS first day, not against its final total.
    expect(previous[0]).toBe(100);
    expect(current[0]).toBe(0);
    expect(current[2]).toBe(300);
  });

  it('says there is nothing to compare against when the previous period is empty', () => {
    const buckets = days('2026-09-01', 30, [100]);

    expect(cumulativeSeries(buckets, [], '2026-09-30').hasPrevious).toBe(false);
    // A month of zeroes is not a comparison either -- that is a group that did not exist yet.
    expect(cumulativeSeries(buckets, days('2026-08-01', 31), '2026-09-30').hasPrevious)
      .toBe(false);
    expect(cumulativeSeries(buckets, days('2026-08-01', 31, [1]), '2026-09-30').hasPrevious)
      .toBe(true);
  });

  it('survives an empty report and a server that sends no previous buckets at all', () => {
    expect(cumulativeSeries([], [], '2026-09-16')).toEqual({
      current: [], previous: [], hasPrevious: false,
    });
    expect(cumulativeSeries(days('2026-09-01', 2, [5]), undefined, '2026-09-16').previous)
      .toEqual([null, null]);
  });
});
