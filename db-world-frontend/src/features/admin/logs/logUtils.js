/**
 * Pure helpers for the Log Viewer — level/method/status colours, entry shape
 * detection, formatting, and the client-side filter + sort pipeline. No React.
 *
 * Entries are either structured objects (app JSON: info/debug/error/request) or
 * plain strings (raw nginx/aria2/mysql, or format=RAW). Every helper tolerates both.
 */

export const SLOW_THRESHOLD_MS = 1000;

const up = (s) => String(s ?? '').toUpperCase();

// ── Rendering mode from the current selection ────────────────────────────────
export const viewMode = (source, type, format) => {
  if (source === 'app' && format === 'JSON') return type === 'request' ? 'request' : 'app';
  return 'raw';
};

// ── Colour palettes (mode-aware: pass `dark` = T.bg === '#000000') ────────────
const LEVEL_COLORS = {
  ERROR: ['#dc2626', '#f87171'],
  WARN:  ['#d97706', '#fbbf24'],
  INFO:  ['#0284c7', '#38bdf8'],
  DEBUG: ['#64748b', '#94a3b8'],
  TRACE: ['#94a3b8', '#94a3b8'],
};
const METHOD_COLORS = {
  GET:     ['#059669', '#34d399'],
  POST:    ['#2563eb', '#60a5fa'],
  PUT:     ['#d97706', '#fbbf24'],
  PATCH:   ['#7c3aed', '#a78bfa'],
  DELETE:  ['#dc2626', '#f87171'],
  HEAD:    ['#64748b', '#94a3b8'],
  OPTIONS: ['#64748b', '#94a3b8'],
};
const STATUS_COLORS = {
  '1xx': ['#64748b', '#94a3b8'],
  '2xx': ['#059669', '#34d399'],
  '3xx': ['#0284c7', '#38bdf8'],
  '4xx': ['#d97706', '#fbbf24'],
  '5xx': ['#dc2626', '#f87171'],
};

export const levelColor  = (lvl, dark) => (LEVEL_COLORS[up(lvl)] || LEVEL_COLORS.INFO)[dark ? 1 : 0];
export const methodColor = (m, dark)   => (METHOD_COLORS[up(m)] || METHOD_COLORS.HEAD)[dark ? 1 : 0];

export const statusClass = (s) => {
  const n = Number(s);
  if (!n) return 'none';
  if (n >= 500) return '5xx';
  if (n >= 400) return '4xx';
  if (n >= 300) return '3xx';
  if (n >= 200) return '2xx';
  return '1xx';
};
export const statusColor = (s, dark) => {
  const c = STATUS_COLORS[statusClass(s)];
  return c ? c[dark ? 1 : 0] : (dark ? '#94a3b8' : '#64748b');
};

// ── Field accessors (tolerate the derived numeric getters or the raw strings) ─
export const numStatus   = (e) => (typeof e?.statusCode === 'number' ? e.statusCode : parseInt(e?.status, 10)) || 0;
export const numDuration = (e) => (typeof e?.durationMs === 'number' ? e.durationMs : parseInt(e?.duration, 10)) || 0;
export const levelOf     = (e) => up(e?.level) || rawLevel(e);
export const isRequestEntry = (e) =>
  !!e && typeof e === 'object' && (!!(e.method && e.uri) || String(e.logger || '').includes('JwtAuthenticationFilter'));
export const isSlow = (e, ms = SLOW_THRESHOLD_MS) => numDuration(e) >= ms;

// Keyword sniff for raw (string) lines — best-effort only.
export function rawLevel(line) {
  const s = up(typeof line === 'string' ? line : '');
  if (/\bERROR\b|\bSEVERE\b|\bFATAL\b/.test(s)) return 'ERROR';
  if (/\bWARN\b/.test(s)) return 'WARN';
  if (/\bDEBUG\b/.test(s)) return 'DEBUG';
  return 'INFO';
}

// ── Formatting ───────────────────────────────────────────────────────────────
/** "HH:mm:ss.mmm" from the log's own timestamp string (keeps its timezone). */
export function fmtTime(ts) {
  if (!ts) return '';
  const m = String(ts).match(/T?(\d{2}:\d{2}:\d{2})(\.\d+)?/);
  if (m) return m[1] + (m[2] ? m[2].slice(0, 4) : '');
  return String(ts);
}
export function fmtDateTime(ts) {
  if (!ts) return '';
  const m = String(ts).match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?/);
  return m ? `${m[1]} ${m[2]}${m[3] ? m[3].slice(0, 4) : ''}` : String(ts);
}
/** "HH:mm:ss" (no millis) — for cramped mobile rows. */
export function fmtTimeShort(ts) {
  const m = String(ts ?? '').match(/(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : String(ts ?? '');
}

// Parse a standard log4j2 human-readable line so RAW rows can lead with the
// message instead of truncating it off the right edge. Handles the MDC
// key=value brackets ([traceId=…] [method=…] [status=…] …) that sit between the
// logger and the " - message", promoting known keys (method/uri/status/user/…)
// to the top level so request lines can render like the JSON request view.
// Returns the parsed object or null (nginx/aria2 lines don't match — their
// useful content is at the START and reads fine as-is).
const RAW_HEAD_RE = /^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+\[([^\]]*)\]\s+(?:\[[^\]]*\]\s+)?(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+(\S+)\s+([\s\S]*)$/;
const MDC_RE = /^\[([^=\]]+)=([^\]]*)\]\s*/;
export function parseRawLine(line) {
  if (typeof line !== 'string') return null;
  const m = line.match(RAW_HEAD_RE);
  if (!m) return null;
  const out = { timestamp: m[1], thread: m[2], level: m[3], logger: m[4] };
  let rest = m[5];
  let mm;
  while ((mm = rest.match(MDC_RE))) {
    out[mm[1].trim()] = mm[2].trim(); // user, traceId, requestId, method, uri, status, duration, md5…
    rest = rest.slice(mm[0].length);
  }
  const dash = rest.match(/^-\s+([\s\S]*)$/);
  out.message = dash ? dash[1] : rest;
  return out;
}
/** Split the "req=<hex>;res=<hex>" md5 fingerprint into parts. */
export function parseMd5(md5) {
  if (!md5) return null;
  const out = {};
  String(md5).split(';').forEach((p) => {
    const [k, v] = p.split('=');
    if (k && v) out[k.trim()] = v.trim();
  });
  return Object.keys(out).length ? out : { raw: String(md5) };
}
/** Last two dotted segments of a logger, e.g. "…filters.JwtAuthenticationFilter". */
export const shortLogger = (l) => String(l || '').split('.').slice(-2).join('.');

export const entryText = (e) => (typeof e === 'string' ? e : (() => { try { return JSON.stringify(e); } catch { return ''; } })());

// ── Filtering ────────────────────────────────────────────────────────────────
// filters: { levels:[], methods:[], statusClasses:[], user, traceId, requestId, slow:bool, search, dedupe:bool }
export function applyFilters(entries, f = {}) {
  const q = (f.search || '').trim().toLowerCase();
  const hasLevels  = f.levels?.length;
  const hasMethods = f.methods?.length;
  const hasStatus  = f.statusClasses?.length;

  let out = entries.filter((e) => {
    if (q && !entryText(e).toLowerCase().includes(q)) return false;
    if (typeof e === 'string') return true; // raw lines only support search
    if (hasLevels && !f.levels.includes(levelOf(e))) return false;
    if (hasMethods && !f.methods.includes(up(e.method))) return false;
    if (hasStatus && !f.statusClasses.includes(statusClass(numStatus(e)))) return false;
    if (f.user && e.user !== f.user) return false;
    if (f.traceId && e.traceId !== f.traceId) return false;
    if (f.requestId && e.requestId !== f.requestId) return false;
    if (f.slow && !isSlow(e)) return false;
    return true;
  });

  if (f.dedupe) out = dedupeBursts(out);
  return out;
}

/** Collapse consecutive identical entries into one carrying a `_burst` count. */
export function dedupeBursts(entries) {
  const out = [];
  for (const e of entries) {
    const prev = out[out.length - 1];
    if (prev && entryText(prev) === entryText(e)) {
      prev._burst = (prev._burst || 1) + 1;
    } else {
      out.push(typeof e === 'string' ? e : { ...e });
    }
  }
  return out;
}

// ── Sorting (request columns + generic) ──────────────────────────────────────
const ACCESSORS = {
  time:     (e) => (typeof e === 'string' ? '' : e.timestamp || ''),
  status:   (e) => numStatus(e),
  duration: (e) => numDuration(e),
  method:   (e) => (typeof e === 'string' ? '' : up(e.method)),
  uri:      (e) => (typeof e === 'string' ? '' : e.uri || ''),
  user:     (e) => (typeof e === 'string' ? '' : e.user || ''),
};

/** Stable sort by a column key + direction. key 'time'/null keeps file order (asc) or reverses (desc). */
export function sortEntries(entries, key, dir = 'desc') {
  const factor = dir === 'asc' ? 1 : -1;
  if (!key || key === 'time') {
    // File order is chronological asc; avoid a full sort for the common case.
    return dir === 'asc' ? entries : [...entries].reverse();
  }
  const get = ACCESSORS[key] || ACCESSORS.time;
  return [...entries]
    .map((e, i) => [e, i])
    .sort((a, b) => {
      const va = get(a[0]);
      const vb = get(b[0]);
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return a[1] - b[1]; // stable
    })
    .map((p) => p[0]);
}

// ── Facets derived from the loaded data (for the filter sheet) ────────────────
export function facets(entries) {
  const levels = new Set();
  const methods = new Set();
  const users = new Set();
  for (const e of entries) {
    if (typeof e === 'string') continue;
    if (e.level) levels.add(up(e.level));
    if (e.method) methods.add(up(e.method));
    if (e.user && e.user !== '-') users.add(e.user);
  }
  return {
    levels: [...levels],
    methods: [...methods],
    users: [...users].sort(),
  };
}
