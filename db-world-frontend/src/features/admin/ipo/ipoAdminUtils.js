/** A source with no successful poll for this long is shown as stale even if its last run said OK. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Health tier for one source row: unknown / notConfigured / healthy / stale / warning / failing.
 * Stale catches a source whose poll stopped running altogether — its counters never change, so
 * without an age check it would read "Healthy" forever.
 */
export function sourceHealthTier(row, now = Date.now()) {
  if (!row?.lastPolledAt) return 'unknown';
  if (row.lastStatus === 'NOT_CONFIGURED') return 'notConfigured';
  const failures = row.consecutiveFailures ?? 0;
  if (failures > 2) return 'failing';
  const lastSuccess = row.lastSuccessAt ? Date.parse(row.lastSuccessAt) : NaN;
  if (Number.isNaN(lastSuccess) || now - lastSuccess > STALE_AFTER_MS) return 'stale';
  if (failures === 0 && row.lastStatus === 'OK') return 'healthy';
  return 'warning';
}

/** Short relative age such as "5m ago", "3h ago", "2d ago"; em dash when unknown. */
export function formatAge(iso, now = Date.now()) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return '—';
  const minutes = Math.max(0, Math.floor((now - t) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
