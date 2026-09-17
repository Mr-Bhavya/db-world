import { describe, expect, it } from 'vitest';
import {
  canStep, customWindow, isCustom, periodWindow, shiftWindow, spanDays, steppedWindow,
  windowParams,
} from './reportWindow';

const TODAY = '2026-09-16';

describe('spanDays', () => {
  it('counts both ends', () => {
    expect(spanDays('2026-09-01', '2026-09-30')).toBe(30);
    expect(spanDays('2026-09-01', '2026-09-01')).toBe(1);
  });

  it('crosses a month, a year and a leap day without drifting', () => {
    expect(spanDays('2026-01-01', '2026-03-03')).toBe(62);
    expect(spanDays('2025-12-25', '2026-01-05')).toBe(12);
    // 2028 is a leap year: February has 29 days in it.
    expect(spanDays('2028-02-01', '2028-03-01')).toBe(30);
  });

  it('survives a daylight-saving boundary', () => {
    // India has no DST, but the browser's clock is the user's, not the server's. Parsing at
    // local midnight and counting whole days keeps a 23- or 25-hour day from rounding to 0.96
    // or 1.04 of one and losing a day over a long range.
    expect(spanDays('2026-03-28', '2026-03-30')).toBe(3);
    expect(spanDays('2026-10-24', '2026-10-27')).toBe(4);
  });
});

describe('shiftWindow', () => {
  it('slides a range by its own length, leaving no gap and no overlap', () => {
    const window = customWindow('2026-06-01', '2026-06-30');

    const back = shiftWindow(window, -1);
    expect(back).toMatchObject({ from: '2026-05-02', to: '2026-05-31' });
    // Contiguous: the step lands exactly where the "previous period" comparison was pointing.
    expect(spanDays(back.from, back.to)).toBe(30);
    expect(shiftWindow(back, 1)).toMatchObject({ from: '2026-06-01', to: '2026-06-30' });
  });

  it('does not round to the calendar', () => {
    // 47 days stays 47 days. Snapping to months here would make stepping twice skip a week.
    const window = customWindow('2026-03-10', '2026-04-25');
    expect(spanDays(window.from, window.to)).toBe(47);

    const back = shiftWindow(window, -1);
    expect(back).toMatchObject({ from: '2026-01-22', to: '2026-03-09' });
    expect(spanDays(back.from, back.to)).toBe(47);
  });
});

describe('canStep', () => {
  it('lets a calendar period step only where the server sent an anchor', () => {
    const month = periodWindow('MONTH');

    expect(canStep(month, { previousAnchor: '2026-08-01', nextAnchor: null }, -1, TODAY)).toBe(true);
    expect(canStep(month, { previousAnchor: '2026-08-01', nextAnchor: null }, 1, TODAY)).toBe(false);
    expect(canStep(month, { previousAnchor: null, nextAnchor: '2026-10-01' }, 1, TODAY)).toBe(true);
  });

  it('stops a range stepping into a future it has no data for', () => {
    // Already runs past today -- forward lands entirely in days that have not happened.
    expect(canStep(customWindow('2026-09-01', '2026-09-30'), null, 1, TODAY)).toBe(false);
    expect(canStep(customWindow('2026-06-01', '2026-06-30'), null, 1, TODAY)).toBe(true);
    expect(canStep(customWindow('2026-06-01', '2026-06-30'), null, -1, TODAY)).toBe(true);
  });
});

describe('steppedWindow', () => {
  it('hands a calendar period the server\'s own anchor rather than doing the maths', () => {
    const stepped = steppedWindow(periodWindow('MONTH'), { previousAnchor: '2026-08-01' }, -1);
    expect(stepped).toEqual({ period: 'MONTH', anchor: '2026-08-01', from: null, to: null });
  });

  it('stays put when there is no anchor to step to', () => {
    const month = periodWindow('MONTH');
    expect(steppedWindow(month, { previousAnchor: null }, -1)).toBe(month);
  });

  it('slides a range itself, with no server involvement', () => {
    expect(steppedWindow(customWindow('2026-06-01', '2026-06-30'), null, -1))
      .toMatchObject({ from: '2026-05-02', to: '2026-05-31' });
  });
});

describe('periodWindow', () => {
  it('drops the anchor and the dates, so changing size returns to the current period', () => {
    expect(periodWindow('WEEK')).toEqual({
      period: 'WEEK', anchor: null, from: null, to: null,
    });
  });
});

describe('windowParams', () => {
  it('sends a period and an anchor for a calendar window', () => {
    expect(windowParams({ period: 'YEAR', anchor: '2025-04-04' }))
      .toEqual({ period: 'YEAR', anchor: '2025-04-04' });
    expect(windowParams(periodWindow('WEEK')))
      .toEqual({ period: 'WEEK', anchor: undefined });
  });

  it('never sends CUSTOM, which the server has no such period for', () => {
    const params = windowParams(customWindow('2026-01-01', '2026-03-31'));

    expect(params.period).toBe('MONTH');
    expect(params).toMatchObject({ from: '2026-01-01', to: '2026-03-31' });
  });
});

describe('isCustom', () => {
  it('needs both ends — one date is a half-written range, not a range', () => {
    expect(isCustom(customWindow('2026-01-01', '2026-03-31'))).toBe(true);
    expect(isCustom({ period: 'CUSTOM', from: '2026-01-01', to: null })).toBe(false);
    expect(isCustom(periodWindow('MONTH'))).toBe(false);
    expect(isCustom(undefined)).toBe(false);
  });
});
