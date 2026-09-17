import { describe, it, expect } from 'vitest';
import {
  bucketLabel, formatReportWindow, reportCaption, spendingTrend,
} from './tallyFormat';

/**
 * The wording around the spending report.
 *
 * Mostly guarding date handling. An ISO date read as UTC renders as the day before anywhere west
 * of Greenwich, which would label September's report "August" — so every date here goes through
 * the local-midnight parse, and these fixtures pin the first and last day of a period where that
 * mistake would show.
 */

const september = { period: 'MONTH', from: '2026-09-01', to: '2026-09-30', nextAnchor: null };

describe('formatReportWindow', () => {
  it('names the month, from its own first day', () => {
    expect(formatReportWindow(september)).toBe('September 2026');
  });

  it('names the year', () => {
    expect(formatReportWindow({ period: 'YEAR', from: '2026-01-01', to: '2026-12-31' }))
      .toBe('2026');
  });

  // The month abbreviation is matched loosely on purpose: en-IN shortens September to "Sept",
  // not "Sep", and which of those ICU produces is its business and can move between Node
  // versions. What these two are actually pinning is whether the START keeps its month.
  it('drops the repeated month when a week sits inside one', () => {
    expect(formatReportWindow({ period: 'WEEK', from: '2026-09-14', to: '2026-09-20' }))
      .toMatch(/^14 – 20 Sept? 2026$/);
  });

  it('keeps both months when a week straddles them', () => {
    // The common case at the turn of a month, and the one where "28 – 4 Oct" would be nonsense.
    expect(formatReportWindow({ period: 'WEEK', from: '2026-09-28', to: '2026-10-04' }))
      .toMatch(/^28 Sept? – 4 Oct 2026$/);
  });

  it('says nothing rather than Invalid Date when there is no window yet', () => {
    expect(formatReportWindow(undefined)).toBe('');
    expect(formatReportWindow({ period: 'MONTH' })).toBe('');
  });
});

describe('bucketLabel', () => {
  // Takes the bucket's own width, not the report's period. A custom range has no period, and
  // eleven weeks is charted per month while a fortnight is charted per day -- so the label has
  // to follow what a column actually covers rather than what the window is called.
  it('labels by how wide the column is', () => {
    expect(bucketLabel('WEEKDAY', '2026-09-14')).toBe('Mon');
    expect(bucketLabel('DAY', '2026-09-03')).toBe('3');
    expect(bucketLabel('MONTH', '2026-02-01')).toBe('Feb');
    expect(bucketLabel('YEAR', '2024-01-01')).toBe('2024');
  });

  it('falls back to the date for an unrecognised width', () => {
    expect(bucketLabel(undefined, '2026-09-03')).toBe('3');
  });

  it('holds the first of the month on the first of the month', () => {
    // Parsed as UTC this reads as the 31st of August in any negative offset, which would shift
    // every bar in the chart by a day.
    expect(bucketLabel('DAY', '2026-09-01')).toBe('1');
  });
});

describe('reportCaption', () => {
  it('says "so far" while the period is still running', () => {
    expect(reportCaption(september)).toBe('so far this month');
    expect(reportCaption({ ...september, period: 'WEEK' })).toBe('so far this week');
  });

  it('names the window once the period is behind us', () => {
    // A next anchor is the server saying there is a later period to step into, so this one is
    // finished -- the client never works that out from today's date itself.
    expect(reportCaption({ ...september, nextAnchor: '2026-10-01' })).toBe('in September 2026');
  });
});

describe('spendingTrend', () => {
  it('compares against the period before', () => {
    expect(spendingTrend(1200, 1000, 'MONTH')).toMatchObject({
      direction: 'up', percent: 20, label: '20% more than last month',
    });
    expect(spendingTrend(800, 1000, 'WEEK')).toMatchObject({
      direction: 'down', percent: 20, label: '20% less than last week',
    });
  });

  it('has nothing to say about a first period', () => {
    // "Up 100%" from zero sounds like information and is not: everything is up infinitely from
    // nothing, and the reader has no earlier month to picture.
    expect(spendingTrend(1200, 0)).toBeNull();
    expect(spendingTrend(1200, null)).toBeNull();
  });

  it('calls an identical total flat rather than 0% more', () => {
    expect(spendingTrend(1000, 1000, 'YEAR')).toMatchObject({
      direction: 'flat', label: 'same as last year',
    });
  });
});
