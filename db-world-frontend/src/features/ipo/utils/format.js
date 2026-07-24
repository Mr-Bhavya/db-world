import { format, parseISO } from 'date-fns';

/** LocalDate ("yyyy-MM-dd") → "24 Jul 2026". */
export const formatShortDate = (dateStr) => {
  if (!dateStr) return null;
  try { return format(parseISO(dateStr), 'dd MMM yyyy'); } catch { return null; }
};

/** Instant (ISO) → "HH:MM" in IST, regardless of the viewer's local timezone. */
export const formatIstTime = (isoInstant) => {
  if (!isoInstant) return null;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(isoInstant));
  } catch { return null; }
};

export const formatCurrency = (n) =>
  (n == null ? null : `₹${Number(n).toLocaleString('en-IN')}`);

export const formatPriceBand = (min, max) => {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? formatCurrency(min) : `₹${min}–₹${max}`;
  return formatCurrency(min ?? max);
};

export const formatPct = (n) =>
  (n == null ? null : `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%`);

export const formatMultiplier = (n) =>
  (n == null ? null : `${Number(n).toFixed(2)}x`);

export const IPO_TYPE_LABEL = {
  mainboard: 'Mainboard',
  sme: 'SME',
};

export const STATUS_META = {
  upcoming: { label: 'Upcoming', color: '#38bdf8', bg: 'rgba(56,189,248,0.14)' },
  open:     { label: 'Open',     color: '#10b981', bg: 'rgba(16,185,129,0.14)' },
  closed:   { label: 'Closed',   color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
  listed:   { label: 'Listed',   color: '#a855f7', bg: 'rgba(168,85,247,0.14)' },
};

export const statusMeta = (status) => STATUS_META[status] ?? { label: status ?? 'Unknown', color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' };
