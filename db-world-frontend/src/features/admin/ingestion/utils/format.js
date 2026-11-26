// Shared formatters for the Media Ingestion module (cards, history, file pickers, queue bar).

const UNITS = ['KB', 'MB', 'GB', 'TB'];

/** Bytes → "1.2 GB". 0 renders as "0 B"; null / NaN / negative render as `empty`. */
export function formatBytes(value, empty = '—') {
  if (value === null || value === undefined || value === '') return empty;
  const b = Number(value);
  if (!Number.isFinite(b) || b < 0) return empty;
  if (b < 1024) return `${Math.round(b)} B`;
  let n = b / 1024;
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i >= 2 ? 2 : i === 0 ? 0 : 1)} ${UNITS[i]}`;
}

/** File sizes where 0 / missing means "unknown" → `empty` (null by default, so callers can hide it). */
export function formatSize(value, empty = null) {
  const b = Number(value);
  if (!value || !Number.isFinite(b) || b <= 0) return empty;
  return formatBytes(b, empty);
}

/** Bytes per second → "3.4 MB/s"; null when idle so callers can hide it. */
export function formatSpeed(bps) {
  const n = Number(bps);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${formatBytes(n)}/s`;
}

/** Seconds → "4m 12s" / "1h 5m"; null when unknown. */
export function formatEta(seconds) {
  const s = Math.floor(Number(seconds));
  if (!Number.isFinite(s) || s <= 0) return null;
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** Milliseconds → "1h 2m 3s" / "2m 3s" / "3s"; `empty` when missing. */
export function formatDurationMs(ms, empty = '—') {
  if (ms === null || ms === undefined) return empty;
  const total = Number(ms);
  if (!Number.isFinite(total) || total < 0) return empty;
  const s = Math.floor(total / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${ss}s`;
}
