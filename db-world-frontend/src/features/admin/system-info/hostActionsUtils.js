/**
 * Server actions helpers — validation, time maths and wording for the host action broker.
 * No React, no MUI, so the rules stay testable on their own.
 *
 * Times an admin types (04:30, 2026-10-05T06:00) mean the Pi's local time, because that is how
 * the host reads them. The server sends the Pi's current UTC offset with the action list, and
 * everything here works from that offset rather than the browser's zone, so an admin abroad
 * still sees the time the Pi will act on.
 */

/** TanStack Query keys. */
export const HOST_ACTIONS_QUERY_KEY = ['server-host-actions'];
export const HOST_POWER_QUERY_KEY = ['server-host-power'];
export const hostActionQueryKey = (id) => ['server-host-action', id];

/** Poll fast while the host is working on something, slowly otherwise. */
export const FAST_POLL_MS = 3_000;
export const SLOW_POLL_MS = 30_000;

/** How the list names each action. */
export const ACTION_LABEL = {
  doctor: 'Health check',
  'backup-start': 'System backup',
  'backup-verify': 'Backup verification',
  'cleanup-preview': 'Cleanup preview',
  'cleanup-apply': 'Cleanup',
  'service-restart': 'Service restart',
  'power-reboot': 'Reboot',
  'power-shutdown': 'Shutdown',
  'power-cancel': 'Cancel power action',
  'power-status': 'Power status',
};

export const actionLabel = (action) => ACTION_LABEL[action] ?? (action || 'Unknown action');

/** The services the host lets the app restart. `id` is the systemd unit, `label` is for people. */
export const SERVICES = [
  { id: 'nginx', label: 'nginx', note: 'The site and API drop for a second or two.' },
  { id: 'redis-server', label: 'Redis', note: 'Caches empty and sessions held in Redis are re-read.' },
  { id: 'aria2', label: 'aria2', note: 'Running downloads pause and resume from their control files.' },
  { id: 'smbd', label: 'Samba', note: 'Open network shares disconnect and reconnect.' },
];

export const serviceLabel = (id) => SERVICES.find((s) => s.id === id)?.label ?? id;

/** Cleanup categories `cleanup-apply` accepts. Ingestion leftovers go in `temp` instead. */
export const CLEANUP_CATEGORIES = ['journal', 'apt', 'logs', 'runner', 'snap', 'artefacts'];
export const TEMP_CATEGORY = 'temp';

/* ── Status ──────────────────────────────────────────────────── */

export const STATUS_LABEL = {
  queued: 'Queued', running: 'Running', done: 'Done', failed: 'Failed', rejected: 'Rejected', unknown: 'Unknown',
};

export const normalizeActionStatus = (status) => (Object.hasOwn(STATUS_LABEL, status) ? status : 'unknown');

/** Still in the host's hands. */
export const isActive = (status) => status === 'queued' || status === 'running';

/** Finished one way or another: the moment to tell whoever started it. */
export const isFinished = (status) => status === 'done' || status === 'failed' || status === 'rejected';

/** 3 s while anything is queued or running, 30 s otherwise. */
export const pollInterval = (items) =>
  ((items ?? []).some((i) => isActive(i?.status)) ? FAST_POLL_MS : SLOW_POLL_MS);

/** Action names that are queued or running right now, to keep their buttons from double-firing. */
export const activeActions = (items) =>
  new Set((items ?? []).filter((i) => isActive(i?.status)).map((i) => i.action));

/* ── Time maths in the Pi's zone ─────────────────────────────── */

const MINUTE = 60_000;
const DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

/** A Date whose UTC fields read as the Pi's wall clock. Only ever read with getUTC*. */
const wallClock = (epochMs, offsetSec) => new Date(epochMs + (offsetSec ?? 0) * 1000);

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LOCAL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const IN_MINUTES_RE = /^\+(\d{1,6})$/;

/**
 * When a `when` value takes effect, in epoch ms: `now`, `+N` minutes, or the next HH:MM on the
 * Pi's clock (a time already passed today, or this very minute, means tomorrow). Null when the
 * value is not one of those.
 */
export function resolveWhen(when, nowMs, offsetSec) {
  if (when === 'now') return nowMs;
  const minutes = IN_MINUTES_RE.exec(when ?? '');
  if (minutes) return nowMs + Number(minutes[1]) * MINUTE;
  const clock = CLOCK_RE.exec(when ?? '');
  if (!clock) return null;
  const wall = wallClock(nowMs, offsetSec);
  const today = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), Number(clock[1]), Number(clock[2]))
    - (offsetSec ?? 0) * 1000;
  return today > nowMs ? today : today + DAY;
}

/** When a `wake` value falls, in epoch ms: `+N` minutes from now or a Pi-local date-time. Null otherwise. */
export function resolveWake(wake, nowMs, offsetSec) {
  const minutes = IN_MINUTES_RE.exec(wake ?? '');
  if (minutes) return nowMs + Number(minutes[1]) * MINUTE;
  const m = LOCAL_DATE_TIME_RE.exec(wake ?? '');
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  // Date.UTC rolls 2026-02-30 over into March; a date that does not survive the round trip is not real.
  const check = new Date(ms);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return ms - (offsetSec ?? 0) * 1000;
}

/**
 * "23:00", "06:00 tomorrow" or "Tue 6 Oct 06:00" on the Pi's clock — the same wording the
 * phone push uses, so the banner and the notification agree.
 */
export function formatHostTime(epochMs, offsetSec, nowMs) {
  if (epochMs == null || !Number.isFinite(epochMs)) return null;
  const t = wallClock(epochMs, offsetSec);
  const now = wallClock(nowMs, offsetSec);
  const time = `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  const dayOf = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((dayOf(t) - dayOf(now)) / DAY);
  if (days === 0) return time;
  if (days === 1) return `${time} tomorrow`;
  return `${WEEKDAYS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${time}`;
}

/** The Pi's clock as `YYYY-MM-DDTHH:MM`, the shape a datetime-local input takes. */
export function toHostLocalInput(epochMs, offsetSec) {
  const t = wallClock(epochMs, offsetSec);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** "UTC+05:30". */
export function formatOffset(offsetSec) {
  const s = Number(offsetSec) || 0;
  const sign = s < 0 ? '−' : '+';
  const abs = Math.abs(s);
  return `UTC${sign}${pad(Math.floor(abs / 3600))}:${pad(Math.floor((abs % 3600) / 60))}`;
}

/** "2 h 10 min", "45 min", "1 day 3 h", "under a minute". */
export function formatCountdown(ms) {
  if (ms == null || !Number.isFinite(ms)) return null;
  const minutes = Math.round(Math.max(0, ms) / MINUTE);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return `${days} day${days !== 1 ? 's' : ''}${h ? ` ${h} h` : ''}`;
}

/* ── Validation (mirrors the host's rules) ───────────────────── */

export const REBOOT_DELAY = { min: 1, max: 1440 };
export const WAKE_MINUTES = { min: 5, max: 10080 };
export const MIN_WAKE_GAP_MS = 5 * MINUTE;

/**
 * The `when` argument from the dialog's fields.
 * @param {'now'|'in'|'at'} mode
 * @returns {{when: string|null, error: string|null}}
 */
export function buildWhen(mode, minutes, time) {
  if (mode === 'now') return { when: 'now', error: null };
  if (mode === 'in') {
    const n = Number(minutes);
    if (!Number.isInteger(n) || n < REBOOT_DELAY.min || n > REBOOT_DELAY.max) {
      return { when: null, error: `Minutes must be a whole number from ${REBOOT_DELAY.min} to ${REBOOT_DELAY.max}.` };
    }
    return { when: `+${n}`, error: null };
  }
  if (mode === 'at') {
    if (!CLOCK_RE.test(time ?? '')) return { when: null, error: 'Pick a time (24-hour HH:MM).' };
    return { when: time, error: null };
  }
  return { when: null, error: 'Pick when.' };
}

/**
 * The `wake` argument from the dialog's fields. "In N hours" counts from now, as the host does.
 * @param {'in'|'at'} mode
 * @returns {{wake: string|null, error: string|null}}
 */
export function buildWake(mode, hours, dateTime) {
  if (mode === 'in') {
    const h = Number(hours);
    const minutes = Math.round(h * 60);
    if (!Number.isFinite(h) || minutes < WAKE_MINUTES.min || minutes > WAKE_MINUTES.max) {
      return { wake: null, error: 'Wake time must be between 5 minutes and 7 days from now.' };
    }
    return { wake: `+${minutes}`, error: null };
  }
  if (mode === 'at') {
    // Some browsers append seconds when the picker has a step; the host takes minutes only.
    const value = (dateTime ?? '').slice(0, 16);
    if (!LOCAL_DATE_TIME_RE.test(value)) return { wake: null, error: 'Pick the date and time to power back on.' };
    return { wake: value, error: null };
  }
  return { wake: null, error: 'A shutdown needs a wake time.' };
}

/**
 * Whether a planned shutdown is acceptable as a whole: both values resolvable, and the wake at
 * least five minutes after the shutdown.
 * @returns {{atMs: number|null, wakeMs: number|null, error: string|null}}
 */
export function checkShutdownPlan(when, wake, nowMs, offsetSec) {
  const atMs = resolveWhen(when, nowMs, offsetSec);
  const wakeMs = resolveWake(wake, nowMs, offsetSec);
  if (atMs == null) return { atMs, wakeMs, error: 'Pick when to shut down.' };
  if (wakeMs == null) return { atMs, wakeMs, error: 'That wake time is not a real date.' };
  if (wakeMs - atMs < MIN_WAKE_GAP_MS) {
    return { atMs, wakeMs, error: 'The Pi must stay off for at least 5 minutes: pick a later wake time.' };
  }
  return { atMs, wakeMs, error: null };
}

/** The typed name must equal the host name exactly; stray spaces from a phone keyboard aside. */
export const confirmMatches = (typed, host) => Boolean(host) && (typed ?? '').trim() === host;

/* ── Power banner ────────────────────────────────────────────── */

/** An entry this far in the past is left over from before a reboot, not something pending. */
const STALE_MS = 2 * MINUTE;

const epochMsOf = (entry) => {
  if (!entry) return null;
  if (Number.isFinite(entry.atEpoch)) return entry.atEpoch * 1000;
  const parsed = Date.parse(entry.at ?? '');
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * What the scheduled-power banner says, or null when nothing is pending.
 * @returns {{kind: 'reboot'|'shutdown'|'wake', title: string, detail: string|null}|null}
 */
export function powerBanner(power, nowMs, offsetSec) {
  if (!power?.available) return null;
  const scheduled = power.scheduled;
  const atMs = epochMsOf(scheduled);
  const wakeMs = epochMsOf(power.wakeAlarm);
  const wakeLive = wakeMs != null && wakeMs > nowMs - STALE_MS;
  const when = (ms) => `${formatHostTime(ms, offsetSec, nowMs)} (in ${formatCountdown(ms - nowMs)})`;

  if (scheduled && (atMs == null || atMs > nowMs - STALE_MS)) {
    const reboot = scheduled.mode === 'reboot';
    const noun = reboot ? 'Reboot' : 'Shutdown';
    const title = atMs == null ? `${noun} scheduled` : `${noun} at ${when(atMs)}`;
    const detail = !reboot && wakeLive ? `back on at ${formatHostTime(wakeMs, offsetSec, nowMs)}` : null;
    return { kind: reboot ? 'reboot' : 'shutdown', title, detail };
  }
  if (wakeLive) {
    return { kind: 'wake', title: `Wake alarm set for ${when(wakeMs)}`, detail: null };
  }
  return null;
}

/* ── Cleanup preview ─────────────────────────────────────────── */

/** "155.0 GB" from the host's KB figures. */
export function formatKb(kb) {
  const n = Number(kb);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/**
 * The preview's `data`, read leniently: it is written by a shell script, so anything odd in it
 * becomes an empty or zero value instead of breaking the dialog.
 */
export function normalizePreview(data) {
  const categories = (Array.isArray(data?.categories) ? data.categories : [])
    .filter((c) => c && typeof c.id === 'string' && c.id)
    .map((c) => ({
      id: c.id,
      label: typeof c.label === 'string' && c.label ? c.label : c.id,
      kb: Number.isFinite(Number(c.kb)) ? Number(c.kb) : 0,
      skipped: typeof c.skipped === 'string' ? c.skipped : '',
      items: (Array.isArray(c.items) ? c.items : [])
        .filter((it) => it && typeof it.name === 'string' && it.name)
        .map((it) => ({
          name: it.name,
          kb: Number.isFinite(Number(it.kb)) ? Number(it.kb) : 0,
          lastWritten: typeof it.lastWritten === 'string' ? it.lastWritten : '',
        })),
      // Only the host's known categories can be applied; "temp" is chosen item by item.
      selectable: CLEANUP_CATEGORIES.includes(c.id),
    }));
  const total = Number(data?.totalKb);
  return {
    categories,
    totalKb: Number.isFinite(total) ? total : categories.reduce((s, c) => s + c.kb, 0),
  };
}

/**
 * Pre-ticked categories: the routine ones that would free something and were evaluated.
 * Ingestion leftovers are never pre-ticked; they may be a job someone still wants.
 */
export const defaultCategorySelection = (preview) =>
  (preview?.categories ?? []).filter((c) => c.selectable && c.kb > 0 && !c.skipped).map((c) => c.id);

/** The `cleanup-apply` arguments, or null when nothing is picked. */
export function buildCleanupArgs(categories, temp) {
  const cats = [...new Set((categories ?? []).filter((c) => CLEANUP_CATEGORIES.includes(c)))];
  const names = [...new Set((temp ?? []).filter((n) => typeof n === 'string' && n && !n.includes('/') && !n.includes('..')))];
  if (!cats.length && !names.length) return null;
  return { categories: cats, temp: names };
}

/** Space the picked categories and folders would free. */
export function selectedKb(preview, categories, temp) {
  const picked = new Set(categories ?? []);
  const names = new Set(temp ?? []);
  let kb = 0;
  for (const c of preview?.categories ?? []) {
    if (c.id === TEMP_CATEGORY) kb += c.items.filter((it) => names.has(it.name)).reduce((s, it) => s + it.kb, 0);
    else if (picked.has(c.id)) kb += c.kb;
  }
  return kb;
}

/* ── Recent actions ──────────────────────────────────────────── */

const describeWhen = (when) => {
  if (!when || when === 'now') return 'now';
  if (IN_MINUTES_RE.test(when)) return `in ${when.slice(1)} min`;
  return `at ${when}`;
};

const describeWake = (wake) => {
  if (!wake) return '—';
  if (IN_MINUTES_RE.test(wake)) return `in ${formatCountdown(Number(wake.slice(1)) * MINUTE)}`;
  return wake.replace('T', ' ');
};

/** "Restart nginx", "Reboot at 04:30", "Cleanup: journal, apt + 2 folders". */
export function describeAction(item) {
  const a = item?.args ?? {};
  switch (item?.action) {
    case 'service-restart': return `Restart ${serviceLabel(a.service)}`;
    case 'power-reboot': return `Reboot ${describeWhen(a.when)}`;
    case 'power-shutdown': return `Shutdown ${describeWhen(a.when)}, wake ${describeWake(a.wake)}`;
    case 'cleanup-apply': {
      const cats = Array.isArray(a.categories) ? a.categories : [];
      const temp = Array.isArray(a.temp) ? a.temp : [];
      const parts = [];
      if (cats.length) parts.push(cats.join(', '));
      if (temp.length) parts.push(`${temp.length} folder${temp.length !== 1 ? 's' : ''}`);
      return parts.length ? `Cleanup: ${parts.join(' + ')}` : 'Cleanup';
    }
    default: return actionLabel(item?.action);
  }
}

/** Seconds since an ISO time, or null. */
export const secondsSince = (iso, nowMs) => {
  const t = Date.parse(iso ?? '');
  return Number.isNaN(t) ? null : Math.max(0, Math.round((nowMs - t) / 1000));
};

/**
 * The toast for an action someone started from this page, once it finishes.
 * @returns {{variant: 'success'|'error'|'warning', message: string}|null}
 */
export function finishedToast(item) {
  if (!item || !isFinished(item.status)) return null;
  const what = describeAction(item);
  const why = item.message ? `: ${item.message}` : '';
  // The host reports a backup as done once it has STARTED; the image itself takes much longer.
  const doneVerb = item.action === 'backup-start' ? 'started' : 'finished';
  if (item.status === 'done') return { variant: 'success', message: `${what} ${doneVerb}${why}` };
  if (item.status === 'rejected') return { variant: 'warning', message: `${what} was refused by the host${why}` };
  return { variant: 'error', message: `${what} failed${why}` };
}

/** The server's readable message from a failed request, or a fallback. */
export const errorMessage = (e, fallback) => e?.response?.data?.message || fallback;
