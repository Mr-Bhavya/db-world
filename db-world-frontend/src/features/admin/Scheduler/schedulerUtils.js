/**
 * Scheduler page formatting helpers. No React, no MUI — the relative-time and
 * duration rules are the fiddly part and deserve to be testable on their own.
 */

/** Human duration for a run that took `ms`. Runs here span 200ms to ~7 minutes. */
export function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * "4h ago" / "in 20h", relative to `now`.
 *
 * Deliberately coarse: on a scheduler page the useful fact is the order of
 * magnitude, and a seconds-accurate label on a card that refreshes every few
 * seconds just flickers. `now` is injectable so the tests aren't clock-dependent.
 */
export function relativeTime(value, now = Date.now()) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;

  const diff = t - now;
  const future = diff > 0;
  const secs = Math.abs(diff) / 1000;

  const label =
      secs < 45        ? 'moments'
    : secs < 90        ? 'a minute'
    : secs < 3600      ? `${Math.round(secs / 60)}m`
    : secs < 86400     ? `${Math.round(secs / 3600)}h`
    : secs < 2592000   ? `${Math.round(secs / 86400)}d`
    :                    `${Math.round(secs / 2592000)}mo`;

  if (label === 'moments') return future ? 'any moment' : 'just now';
  return future ? `in ${label}` : `${label} ago`;
}

/** Short wall-clock for the next run, e.g. "02:00" or "Tue 02:00" if it isn't today. */
export function clockTime(value, now = Date.now()) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const hhmm = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return sameDay ? hhmm : `${d.toLocaleDateString('en-IN', { weekday: 'short' })} ${hhmm}`;
}

/** Full timestamp for tooltips. */
export function fullTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
}

/** camelCase counter key → readable label ("filesOnDisk" → "files on disk"). */
export const counterLabel = (key) =>
  String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

/**
 * The one or two counters worth putting on a card.
 *
 * A run summary can carry half a dozen counters; the card has room for a glance,
 * not a report. Anything naming a failure wins — that is the number someone is
 * scanning the page for — and zero-valued counters are dropped so a quiet run
 * says "no changes" instead of "added 0, removed 0, files on disk 0".
 *
 * @returns {{key: string, value: number}[]}
 */
export function highlightCounters(summary, limit = 2) {
  const counters = summary?.counters;
  if (!counters) return [];
  const entries = Object.entries(counters).map(([key, value]) => ({ key, value: Number(value) }));
  const failures = entries.filter((e) => /fail/i.test(e.key) && e.value > 0);
  const rest = entries.filter((e) => !/fail/i.test(e.key) && e.value > 0);
  return [...failures, ...rest].slice(0, limit);
}

/** True when a counter name means something went wrong. Drives its colour. */
export const isFailureCounter = (key) => /fail/i.test(String(key));

/**
 * The single line describing a job's outcome, for the card's "last run" column.
 * Falls back through summary note → error message → nothing.
 */
export function outcomeText(job) {
  if (job?.lastStatus === 'FAILED') return job?.lastMessage || 'Failed';
  const highlights = highlightCounters(job?.lastSummary, 2);
  if (highlights.length) {
    return highlights.map((h) => `${counterLabel(h.key)} ${h.value}`).join(' · ');
  }
  return job?.lastSummary?.note || null;
}

/**
 * Human-readable cadence for a job — works for both CRON (`0 0 2 * * *`) and
 * FIXED_DELAY (every N seconds). Falls back to the raw expression for anything
 * the shorthand does not recognise, so a hand-written cron still shows something.
 */
export function describeSchedule(job) {
  if (job?.jobType === 'FIXED_DELAY') {
    const s = job.intervalSeconds ?? 0;
    if (s < 60) return `Every ${s}s`;
    if (s % 60 === 0) {
      const m = s / 60;
      return m === 1 ? 'Every minute' : `Every ${m} minutes`;
    }
    return `Every ${s}s`;
  }
  const expr = job?.cronExpression;
  if (!expr) return '—';
  const parts = expr.split(' ');
  if (parts.length < 6) return expr;
  const [, min, hour] = parts;
  if (hour === '*/6') return 'Every 6 hours';
  if (hour === '*/2') return 'Every 2 hours';
  if (hour === '*/1') return 'Every hour';
  if (/^\d+$/.test(hour)) {
    const h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    return `Daily at ${h}:${String(m).padStart(2, '0')}${job.timezone ? ' ' + job.timezone.replace('Asia/', '') : ''}`;
  }
  return expr;
}
