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

export const STATUS_LABEL = {
  upcoming: 'Upcoming',
  open: 'Open',
  closed: 'Closed',
  listed: 'Listed',
};

/**
 * Status → themed accent, resolved against the live design tokens (`useT()`) so it's
 * correct in both AMOLED dark and pure-white light: upcoming = info/blue (announced,
 * not live yet), open = success/green (live now), closed = warning/amber (subscription
 * over, awaiting listing), listed = teal/accent (done — matches the brand accent).
 */
export const statusMeta = (status, T) => {
  const label = STATUS_LABEL[status] ?? status ?? 'Unknown';
  switch (status) {
    case 'upcoming': return { label, color: T.info, bg: T.infoBg };
    case 'open':     return { label, color: T.success, bg: T.successBg };
    case 'closed':   return { label, color: T.warning, bg: T.warningBg };
    case 'listed':   return { label, color: T.teal, bg: T.tealBg };
    default:         return { label, color: T.textFaint, bg: T.glassHover };
  }
};
