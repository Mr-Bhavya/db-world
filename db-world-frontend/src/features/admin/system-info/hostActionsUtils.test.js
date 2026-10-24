import { describe, it, expect } from 'vitest';
import {
  FAST_POLL_MS, SLOW_POLL_MS, activeActions, buildCleanupArgs, buildWake, buildWhen, checkShutdownPlan,
  confirmMatches, defaultCategorySelection, describeAction, finishedToast, formatCountdown, formatHostTime,
  formatKb, formatOffset, isFinished, normalizeActionStatus, normalizePreview, pollInterval, powerBanner,
  resolveWake, resolveWhen, selectedKb, toHostLocalInput,
} from './hostActionsUtils';

/** 2026-10-04 19:10 on the Pi (IST, UTC+05:30). */
const NOW = Date.parse('2026-10-04T13:40:00Z');
const IST = 19_800;
const ist = (local) => Date.parse(`${local}+05:30`);

describe('pollInterval', () => {
  it('polls every 3 s while anything is queued or running', () => {
    expect(pollInterval([{ status: 'done' }, { status: 'queued' }])).toBe(FAST_POLL_MS);
    expect(pollInterval([{ status: 'running' }])).toBe(FAST_POLL_MS);
  });

  it('polls every 30 s when everything has finished, or there is nothing', () => {
    expect(pollInterval([{ status: 'done' }, { status: 'failed' }, { status: 'rejected' }, { status: 'unknown' }])).toBe(SLOW_POLL_MS);
    expect(pollInterval([])).toBe(SLOW_POLL_MS);
    expect(pollInterval(undefined)).toBe(SLOW_POLL_MS);
  });

  it('lists the actions still in flight', () => {
    const busy = activeActions([{ action: 'doctor', status: 'running' }, { action: 'backup-start', status: 'done' }]);
    expect([...busy]).toEqual(['doctor']);
  });
});

describe('status', () => {
  it('reads anything unexpected as unknown', () => {
    expect(normalizeActionStatus('done')).toBe('done');
    expect(normalizeActionStatus('exploded')).toBe('unknown');
    expect(normalizeActionStatus('toString')).toBe('unknown');
  });

  it('counts done, failed and rejected as finished, not queued, running or unknown', () => {
    expect(['done', 'failed', 'rejected'].every(isFinished)).toBe(true);
    expect(['queued', 'running', 'unknown'].some(isFinished)).toBe(false);
  });
});

describe('resolveWhen', () => {
  it('reads now and +N minutes', () => {
    expect(resolveWhen('now', NOW, IST)).toBe(NOW);
    expect(resolveWhen('+30', NOW, IST)).toBe(ist('2026-10-04T19:40'));
  });

  it('takes HH:MM as the next time the Pi clock shows it', () => {
    expect(resolveWhen('23:00', NOW, IST)).toBe(ist('2026-10-04T23:00'));
    expect(resolveWhen('04:30', NOW, IST)).toBe(ist('2026-10-05T04:30'));
    // This very minute has started already, so it means tomorrow.
    expect(resolveWhen('19:10', NOW, IST)).toBe(ist('2026-10-05T19:10'));
  });

  it('uses the Pi offset, not the browser zone', () => {
    // A Pi on UTC: at 13:40 there, 04:30 has passed (tomorrow) and 23:00 has not (today).
    expect(resolveWhen('04:30', NOW, 0)).toBe(Date.parse('2026-10-05T04:30:00Z'));
    expect(resolveWhen('23:00', NOW, 0)).toBe(Date.parse('2026-10-04T23:00:00Z'));
  });

  it('is null for anything else', () => {
    expect(resolveWhen('4:30', NOW, IST)).toBeNull();
    expect(resolveWhen('soon', NOW, IST)).toBeNull();
    expect(resolveWhen(undefined, NOW, IST)).toBeNull();
  });
});

describe('resolveWake', () => {
  it('reads +N minutes and Pi-local date-times', () => {
    expect(resolveWake('+60', NOW, IST)).toBe(ist('2026-10-04T20:10'));
    expect(resolveWake('2026-10-05T06:00', NOW, IST)).toBe(ist('2026-10-05T06:00'));
  });

  it('refuses dates that do not exist instead of rolling them over', () => {
    expect(resolveWake('2026-02-30T06:00', NOW, IST)).toBeNull();
    expect(resolveWake('2026-10-05T24:00', NOW, IST)).toBeNull();
    expect(resolveWake('2026-10-05T06:60', NOW, IST)).toBeNull();
    expect(resolveWake('tomorrow', NOW, IST)).toBeNull();
  });
});

describe('formatting times', () => {
  it('names the day only when it is not today, like the phone push', () => {
    expect(formatHostTime(ist('2026-10-04T23:00'), IST, NOW)).toBe('23:00');
    expect(formatHostTime(ist('2026-10-05T06:00'), IST, NOW)).toBe('06:00 tomorrow');
    expect(formatHostTime(ist('2026-10-06T06:00'), IST, NOW)).toBe('Tue 6 Oct 06:00');
    expect(formatHostTime(null, IST, NOW)).toBeNull();
  });

  it('counts down in the coarsest useful unit', () => {
    expect(formatCountdown(20_000)).toBe('under a minute');
    expect(formatCountdown(45 * 60_000)).toBe('45 min');
    expect(formatCountdown(130 * 60_000)).toBe('2 h 10 min');
    expect(formatCountdown(120 * 60_000)).toBe('2 h');
    expect(formatCountdown(27 * 3_600_000)).toBe('1 day 3 h');
    expect(formatCountdown(48 * 3_600_000)).toBe('2 days');
    expect(formatCountdown(-5)).toBe('under a minute');
  });

  it('formats the offset and a datetime-local value on the Pi clock', () => {
    expect(formatOffset(IST)).toBe('UTC+05:30');
    expect(formatOffset(-18_000)).toBe('UTC−05:00');
    expect(toHostLocalInput(NOW, IST)).toBe('2026-10-04T19:10');
  });
});

describe('buildWhen', () => {
  it('builds now, +N and HH:MM', () => {
    expect(buildWhen('now')).toEqual({ when: 'now', error: null });
    expect(buildWhen('in', '30')).toEqual({ when: '+30', error: null });
    expect(buildWhen('at', '', '04:30')).toEqual({ when: '04:30', error: null });
  });

  it('keeps minutes within 1 to 1440 and whole', () => {
    expect(buildWhen('in', '1').when).toBe('+1');
    expect(buildWhen('in', '1440').when).toBe('+1440');
    expect(buildWhen('in', '0').error).toMatch(/1 to 1440/);
    expect(buildWhen('in', '1441').error).toMatch(/1 to 1440/);
    expect(buildWhen('in', '2.5').error).toBeTruthy();
    expect(buildWhen('in', '').error).toBeTruthy();
  });

  it('wants a 24-hour HH:MM', () => {
    expect(buildWhen('at', '', '4:30').error).toBeTruthy();
    expect(buildWhen('at', '', '24:00').error).toBeTruthy();
    expect(buildWhen('at', '', '').error).toBeTruthy();
  });
});

describe('buildWake', () => {
  it('turns hours from now into +minutes', () => {
    expect(buildWake('in', '8')).toEqual({ wake: '+480', error: null });
    expect(buildWake('in', '1.5')).toEqual({ wake: '+90', error: null });
  });

  it('keeps the wake between 5 minutes and 7 days', () => {
    expect(buildWake('in', '168').wake).toBe('+10080');
    expect(buildWake('in', '169').error).toBeTruthy();
    expect(buildWake('in', '0.05').error).toBeTruthy();
    expect(buildWake('in', 'x').error).toBeTruthy();
  });

  it('takes a datetime-local value, dropping seconds a browser may add', () => {
    expect(buildWake('at', '', '2026-10-05T06:00')).toEqual({ wake: '2026-10-05T06:00', error: null });
    expect(buildWake('at', '', '2026-10-05T06:00:00').wake).toBe('2026-10-05T06:00');
    expect(buildWake('at', '', '').error).toBeTruthy();
  });

  it('has no "no wake" option', () => {
    expect(buildWake(undefined).error).toMatch(/needs a wake time/);
  });
});

describe('checkShutdownPlan', () => {
  it('accepts a wake at least 5 minutes after the shutdown', () => {
    expect(checkShutdownPlan('now', '+5', NOW, IST).error).toBeNull();
    expect(checkShutdownPlan('23:00', '2026-10-05T06:00', NOW, IST)).toEqual({
      atMs: ist('2026-10-04T23:00'), wakeMs: ist('2026-10-05T06:00'), error: null,
    });
  });

  it('refuses a wake too soon after, or before, the shutdown', () => {
    expect(checkShutdownPlan('+1', '+5', NOW, IST).error).toMatch(/at least 5 minutes/);
    expect(checkShutdownPlan('23:00', '2026-10-04T23:04', NOW, IST).error).toMatch(/at least 5 minutes/);
    expect(checkShutdownPlan('now', '2026-10-04T06:00', NOW, IST).error).toMatch(/at least 5 minutes/);
  });

  it('refuses an impossible wake date', () => {
    expect(checkShutdownPlan('now', '2026-02-30T06:00', NOW, IST).error).toMatch(/not a real date/);
  });
});

describe('confirmMatches', () => {
  it('needs the exact host name', () => {
    expect(confirmMatches('dbworldpi', 'dbworldpi')).toBe(true);
    expect(confirmMatches(' dbworldpi ', 'dbworldpi')).toBe(true);
    expect(confirmMatches('DBWORLDPI', 'dbworldpi')).toBe(false);
    expect(confirmMatches('dbworld', 'dbworldpi')).toBe(false);
  });

  it('never matches when the host is unknown', () => {
    expect(confirmMatches('', null)).toBe(false);
    expect(confirmMatches('', '')).toBe(false);
  });
});

describe('powerBanner', () => {
  const at = (local) => ({ at: `${local}:00+05:30`, atEpoch: ist(local) / 1000 });

  it('announces a pending reboot with its countdown', () => {
    const b = powerBanner({ available: true, scheduled: { mode: 'reboot', ...at('2026-10-04T21:20') } }, NOW, IST);
    expect(b).toEqual({ kind: 'reboot', title: 'Reboot at 21:20 (in 2 h 10 min)', detail: null });
  });

  it('adds the wake time to a shutdown', () => {
    const b = powerBanner({
      available: true,
      scheduled: { mode: 'poweroff', ...at('2026-10-04T23:00') },
      wakeAlarm: at('2026-10-05T06:00'),
    }, NOW, IST);
    expect(b).toEqual({ kind: 'shutdown', title: 'Shutdown at 23:00 (in 3 h 50 min)', detail: 'back on at 06:00 tomorrow' });
  });

  it('treats halt as a shutdown and copes without an epoch', () => {
    const b = powerBanner({ available: true, scheduled: { mode: 'halt', at: '2026-10-04T23:00:00+05:30' } }, NOW, IST);
    expect(b.kind).toBe('shutdown');
    expect(b.title).toBe('Shutdown at 23:00 (in 3 h 50 min)');
  });

  it('shows a wake alarm on its own', () => {
    const b = powerBanner({ available: true, scheduled: null, wakeAlarm: at('2026-10-05T06:00') }, NOW, IST);
    expect(b.kind).toBe('wake');
    expect(b.title).toBe('Wake alarm set for 06:00 tomorrow (in 10 h 50 min)');
  });

  it('shows nothing when nothing is pending, the state is unavailable, or the entry is long past', () => {
    expect(powerBanner({ available: true, scheduled: null, wakeAlarm: null }, NOW, IST)).toBeNull();
    expect(powerBanner({ available: false }, NOW, IST)).toBeNull();
    expect(powerBanner(undefined, NOW, IST)).toBeNull();
    expect(powerBanner({ available: true, scheduled: { mode: 'reboot', ...at('2026-10-04T18:00') } }, NOW, IST)).toBeNull();
  });
});

describe('cleanup preview', () => {
  const data = {
    categories: [
      { id: 'temp', label: 'Ingestion leftovers', kb: 162529280,
        items: [{ name: '2228-Heroes', kb: 41127504, lastWritten: '2026-07-06' }, { name: '', kb: 1 }, null], skipped: '' },
      { id: 'journal', label: 'systemd journal', kb: 512000, items: [], skipped: '' },
      { id: 'apt', label: 'apt cache', kb: 0, items: [], skipped: '' },
      { id: 'runner', label: 'Runner work dirs', kb: 900, items: [], skipped: 'A CI job is running right now' },
      { id: 'mystery', label: 'From a newer host', kb: 10, items: [], skipped: '' },
      { label: 'no id' },
    ],
    totalKb: 163000000,
  };

  it('reads the preview leniently', () => {
    const p = normalizePreview(data);
    expect(p.categories.map((c) => c.id)).toEqual(['temp', 'journal', 'apt', 'runner', 'mystery']);
    expect(p.categories[0].items).toEqual([{ name: '2228-Heroes', kb: 41127504, lastWritten: '2026-07-06' }]);
    expect(p.categories[0].selectable).toBe(false);
    expect(p.categories[4].selectable).toBe(false);
    expect(p.totalKb).toBe(163000000);
    expect(normalizePreview(null)).toEqual({ categories: [], totalKb: 0 });
  });

  it('pre-ticks only routine categories that free something and were evaluated', () => {
    expect(defaultCategorySelection(normalizePreview(data))).toEqual(['journal']);
  });

  it('builds apply arguments, refusing an empty pick and anything path-like', () => {
    expect(buildCleanupArgs(['journal', 'journal', 'temp'], ['2228-Heroes'])).toEqual({ categories: ['journal'], temp: ['2228-Heroes'] });
    expect(buildCleanupArgs([], ['../etc', 'a/b'])).toBeNull();
    expect(buildCleanupArgs([], [])).toBeNull();
  });

  it('adds up what the pick frees', () => {
    expect(selectedKb(normalizePreview(data), ['journal'], ['2228-Heroes'])).toBe(512000 + 41127504);
  });

  it('formats KB figures', () => {
    expect(formatKb(162529280)).toBe('155 GB');
    expect(formatKb(41127504)).toBe('39.2 GB');
    expect(formatKb(900)).toBe('900 KB');
    expect(formatKb(0)).toBe('0 B');
  });
});

describe('describing actions', () => {
  it('words each action with its arguments', () => {
    expect(describeAction({ action: 'service-restart', args: { service: 'smbd' } })).toBe('Restart Samba');
    expect(describeAction({ action: 'power-reboot', args: { when: '+30' } })).toBe('Reboot in 30 min');
    expect(describeAction({ action: 'power-reboot', args: { when: '04:30' } })).toBe('Reboot at 04:30');
    expect(describeAction({ action: 'power-shutdown', args: { when: 'now', wake: '+480' } })).toBe('Shutdown now, wake in 8 h');
    expect(describeAction({ action: 'power-shutdown', args: { when: '23:00', wake: '2026-10-05T06:00' } }))
      .toBe('Shutdown at 23:00, wake 2026-10-05 06:00');
    expect(describeAction({ action: 'cleanup-apply', args: { categories: ['journal', 'apt'], temp: ['a', 'b'] } }))
      .toBe('Cleanup: journal, apt + 2 folders');
    expect(describeAction({ action: 'doctor', args: {} })).toBe('Health check');
    expect(describeAction({ action: 'something-new' })).toBe('something-new');
  });

  it('toasts finished actions by outcome', () => {
    expect(finishedToast({ action: 'doctor', status: 'done', message: 'All checks ran' }))
      .toEqual({ variant: 'success', message: 'Health check finished: All checks ran' });
    expect(finishedToast({ action: 'backup-start', status: 'failed', message: 'Disk full' }).variant).toBe('error');
    // A backup is "done" as soon as it has started, so it must not be toasted as finished.
    expect(finishedToast({ action: 'backup-start', status: 'done' }).message).toBe('System backup started');
    expect(finishedToast({ action: 'power-reboot', args: { when: 'now' }, status: 'rejected' }))
      .toEqual({ variant: 'warning', message: 'Reboot now was refused by the host' });
    expect(finishedToast({ action: 'doctor', status: 'running' })).toBeNull();
  });
});
