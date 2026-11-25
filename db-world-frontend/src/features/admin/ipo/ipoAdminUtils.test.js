import { describe, expect, it } from 'vitest';
import { formatAge, sourceHealthTier } from './ipoAdminUtils';

const NOW = Date.parse('2026-11-26T00:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();

describe('sourceHealthTier', () => {
  it('is healthy only when the last success is recent', () => {
    const row = { lastPolledAt: hoursAgo(1), lastSuccessAt: hoursAgo(1), lastStatus: 'OK', consecutiveFailures: 0 };
    expect(sourceHealthTier(row, NOW)).toBe('healthy');
    expect(sourceHealthTier({ ...row, lastPolledAt: hoursAgo(30), lastSuccessAt: hoursAgo(30) }, NOW)).toBe('stale');
  });

  it('flags a source that has never succeeded as stale, and repeated failures as failing', () => {
    expect(sourceHealthTier({ lastPolledAt: hoursAgo(1), lastStatus: 'FAILED', consecutiveFailures: 1 }, NOW)).toBe('stale');
    expect(sourceHealthTier({ lastPolledAt: hoursAgo(1), lastSuccessAt: hoursAgo(2), lastStatus: 'FAILED', consecutiveFailures: 1 }, NOW))
      .toBe('warning');
    expect(sourceHealthTier({ lastPolledAt: hoursAgo(1), lastSuccessAt: hoursAgo(2), lastStatus: 'FAILED', consecutiveFailures: 3 }, NOW))
      .toBe('failing');
  });

  it('keeps unknown and not-configured sources out of the stale check', () => {
    expect(sourceHealthTier({}, NOW)).toBe('unknown');
    expect(sourceHealthTier({ lastPolledAt: hoursAgo(1), lastStatus: 'NOT_CONFIGURED' }, NOW)).toBe('notConfigured');
  });
});

describe('formatAge', () => {
  it('formats minutes, hours and days', () => {
    expect(formatAge(hoursAgo(0.5), NOW)).toBe('30m ago');
    expect(formatAge(hoursAgo(5), NOW)).toBe('5h ago');
    expect(formatAge(hoursAgo(72), NOW)).toBe('3d ago');
    expect(formatAge(null, NOW)).toBe('—');
  });
});
