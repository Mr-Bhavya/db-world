import { describe, it, expect } from 'vitest';
import {
  clockTime, completionMessage, counterLabel, describeSchedule, formatDuration,
  highlightCounters, isFailureCounter, outcomeText, relativeTime, runPace,
} from './schedulerUtils';

const NOW = new Date('2026-09-13T21:00:00+05:30').getTime();
const at = (iso) => new Date(iso).toISOString();

/**
 * An instant at `hh:mm` LOCAL time, `dayOffset` days from `base`.
 *
 * clockTime renders in the viewer's own timezone, which is right for the UI but
 * makes a fixed UTC instant mean a different calendar day depending on where the
 * test runs. Pinning one broke CI: 02:00 IST is the PREVIOUS day at 20:30 UTC, so
 * the "same day" assertion held on a laptop in India and failed on a UTC runner.
 * Building the input from local-time parts asserts the actual contract -- same
 * local day versus not -- in any timezone.
 */
function localAt(base, dayOffset, hh, mm) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

describe('formatDuration', () => {
  it('keeps sub-second runs in milliseconds', () => {
    expect(formatDuration(185)).toBe('185 ms');
  });

  it('shows one decimal under ten seconds, none above', () => {
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(42000)).toBe('42s');
  });

  it('splits minutes and seconds, dropping a zero remainder', () => {
    expect(formatDuration(411507)).toBe('6m 52s');
    expect(formatDuration(120000)).toBe('2m');
  });

  it('rolls over into hours', () => {
    expect(formatDuration(3900000)).toBe('1h 5m');
  });

  it('renders a missing duration rather than NaN', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });
});

describe('relativeTime', () => {
  it('describes the past', () => {
    expect(relativeTime(at('2026-09-13T17:00:00+05:30'), NOW)).toBe('4h ago');
    expect(relativeTime(at('2026-09-13T20:30:00+05:30'), NOW)).toBe('30m ago');
    expect(relativeTime(at('2026-09-11T21:00:00+05:30'), NOW)).toBe('2d ago');
  });

  it('describes the future', () => {
    expect(relativeTime(at('2026-09-14T17:00:00+05:30'), NOW)).toBe('in 20h');
    expect(relativeTime(at('2026-09-13T21:45:00+05:30'), NOW)).toBe('in 45m');
  });

  /** A card that refreshes every few seconds must not flicker through second counts. */
  it('collapses the last minute to a stable phrase', () => {
    expect(relativeTime(at('2026-09-13T20:59:40+05:30'), NOW)).toBe('just now');
    expect(relativeTime(at('2026-09-13T21:00:20+05:30'), NOW)).toBe('any moment');
  });

  it('returns null for a missing or unparseable value', () => {
    expect(relativeTime(null, NOW)).toBeNull();
    expect(relativeTime('not a date', NOW)).toBeNull();
  });
});

describe('clockTime', () => {
  it('shows just the time for today', () => {
    expect(clockTime(localAt(NOW, 0, 2, 0), NOW)).toBe('02:00');
  });

  it('prefixes the weekday when it is not today', () => {
    expect(clockTime(localAt(NOW, 1, 2, 0), NOW)).toMatch(/^\w{3} 02:00$/);
  });

  it('returns null when there is no next run', () => {
    expect(clockTime(null, NOW)).toBeNull();
  });
});

describe('counterLabel', () => {
  it('turns camelCase into words', () => {
    expect(counterLabel('filesOnDisk')).toBe('files on disk');
    expect(counterLabel('synced')).toBe('synced');
    expect(counterLabel('ruleTagsFailed')).toBe('rule tags failed');
  });
});

describe('highlightCounters', () => {
  const summary = (counters) => ({ counters });

  it('puts failures first, however far down the map they sit', () => {
    const out = highlightCounters(summary({ changed: 400, synced: 398, failed: 2 }));
    expect(out[0]).toEqual({ key: 'failed', value: 2 });
  });

  it('drops zero-valued counters so a quiet run does not read as a report of nothing', () => {
    expect(highlightCounters(summary({ added: 0, removed: 0, filesOnDisk: 0 }))).toEqual([]);
  });

  it('ignores a zero failure count', () => {
    const out = highlightCounters(summary({ synced: 12, failed: 0 }));
    expect(out).toEqual([{ key: 'synced', value: 12 }]);
  });

  it('caps how many it returns', () => {
    const out = highlightCounters(summary({ a: 1, b: 2, c: 3, d: 4 }), 2);
    expect(out).toHaveLength(2);
  });

  it('tolerates a run with no summary at all', () => {
    expect(highlightCounters(undefined)).toEqual([]);
    expect(highlightCounters({})).toEqual([]);
  });
});

describe('isFailureCounter', () => {
  it('spots the failure counters the jobs actually emit', () => {
    expect(isFailureCounter('failed')).toBe(true);
    expect(isFailureCounter('ruleTagsFailed')).toBe(true);
    expect(isFailureCounter('sourcesFailed')).toBe(true);
    expect(isFailureCounter('synced')).toBe(false);
  });
});

describe('outcomeText', () => {
  it('leads with the error on a failed run', () => {
    expect(outcomeText({ lastStatus: 'FAILED', lastMessage: 'stream root missing' }))
      .toBe('stream root missing');
  });

  it('names a failure even when the message is empty', () => {
    expect(outcomeText({ lastStatus: 'FAILED' })).toBe('Failed');
  });

  it('summarises the counters on a successful run', () => {
    expect(outcomeText({ lastStatus: 'SUCCESS', lastSummary: { counters: { synced: 312, failed: 0 } } }))
      .toBe('synced 312');
  });

  it('falls back to the note when every counter is zero', () => {
    expect(outcomeText({
      lastStatus: 'SUCCESS',
      lastSummary: { counters: { added: 0, removed: 0 }, note: 'No changes' },
    })).toBe('No changes');
  });

  it('returns null when there is nothing to say', () => {
    expect(outcomeText({ lastStatus: 'SUCCESS' })).toBeNull();
    expect(outcomeText({})).toBeNull();
  });
});

describe('describeSchedule', () => {
  it('describes fixed-delay cadences', () => {
    expect(describeSchedule({ jobType: 'FIXED_DELAY', intervalSeconds: 60 })).toBe('Every minute');
    expect(describeSchedule({ jobType: 'FIXED_DELAY', intervalSeconds: 30 })).toBe('Every 30s');
    expect(describeSchedule({ jobType: 'FIXED_DELAY', intervalSeconds: 300 })).toBe('Every 5 minutes');
  });

  it('describes a daily cron, with its timezone', () => {
    expect(describeSchedule({ jobType: 'CRON', cronExpression: '0 0 2 * * *', timezone: 'Asia/Kolkata' }))
      .toBe('Daily at 2:00 Kolkata');
  });

  it('describes the every-N-hours shorthands', () => {
    expect(describeSchedule({ jobType: 'CRON', cronExpression: '0 0 */6 * * *' })).toBe('Every 6 hours');
  });

  it('falls back to the raw expression it cannot summarise', () => {
    const expr = '0 15/30 10-20 * * *';
    expect(describeSchedule({ jobType: 'CRON', cronExpression: expr })).toBe(expr);
  });

  it('handles a job with no schedule at all', () => {
    expect(describeSchedule({ jobType: 'CRON' })).toBe('—');
  });
});

describe('runPace', () => {
  it('reports the usual duration without crying wolf', () => {
    const pace = runPace(5 * 60_000, 4 * 60_000);
    expect(pace.expected).toBe('usually 4m');
    expect(pace.overrun).toBe(false);
  });

  /** Normal runs vary a lot, so only a large overshoot counts as suspicious. */
  it('flags an overrun only past twice the median', () => {
    expect(runPace(7 * 60_000, 4 * 60_000).overrun).toBe(false);
    expect(runPace(12 * 60_000, 4 * 60_000).overrun).toBe(true);
  });

  it('says nothing when there is no history to compare against', () => {
    expect(runPace(60_000, null)).toEqual({ expected: null, overrun: false });
    expect(runPace(null, 60_000)).toEqual({ expected: null, overrun: false });
  });
});

describe('completionMessage', () => {
  it('reports a success with what the run did', () => {
    const msg = completionMessage({
      name: 'TMDB Movie Sync', lastStatus: 'SUCCESS',
      lastSummary: { counters: { synced: 312, failed: 2 } },
    });
    expect(msg.severity).toBe('success');
    expect(msg.text).toContain('failed 2');
  });

  it('reports a failure with its reason', () => {
    const msg = completionMessage({
      name: 'Media File Sync', lastStatus: 'FAILED', lastMessage: 'stream root missing',
    });
    expect(msg.severity).toBe('error');
    expect(msg.text).toContain('stream root missing');
  });

  /** Stopping a job yourself is not an incident and must not be reported as one. */
  it('reports a cancellation as information, not an error', () => {
    const msg = completionMessage({ name: 'TMDB TV Sync', lastStatus: 'CANCELLED' });
    expect(msg.severity).toBe('info');
    expect(msg.text).toContain('cancelled');
  });

  it('still says something when the run reported nothing', () => {
    const msg = completionMessage({ name: 'Tag Scheduler', lastStatus: 'SUCCESS' });
    expect(msg.severity).toBe('success');
    expect(msg.text).toBe('Tag Scheduler finished');
  });
});
