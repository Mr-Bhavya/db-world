/**
 * Shorter wording for the System Info stat cards, so each value fits on one line: a value
 * that wrapped made its card taller than the ones beside it. No React, so it is tested
 * on its own.
 */

const unitOf = (s) => String(s ?? '').trim().match(/\s(\S+)$/)?.[1];

/** "3.47 GB" and "7.75 GB" → "3.47 / 7.75 GB": one unit is enough when both share it. */
export function compactRatio(used, total) {
  const u = unitOf(used);
  if (u && u === unitOf(total)) {
    const amount = String(used).trim().slice(0, -u.length).trim();
    return `${amount} / ${String(total).trim()}`;
  }
  return `${used} / ${total}`;
}

/**
 * "23h 27m 9s" → "23h 27m", "2d 4h 5m 7s" → "2d 4h 5m": seconds are noise next to hours
 * or days. Shorter uptimes ("12m 9s") keep them. Anything else is returned unchanged.
 */
export function compactUptime(uptime) {
  if (uptime == null) return uptime;
  const s = String(uptime);
  return /\d+\s*[dh]\b/i.test(s) ? s.replace(/\s*\d+\s*s$/i, '') : uptime;
}
