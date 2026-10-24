/**
 * Host health helpers — ordering, grouping and wording for the `dbworldctl doctor`
 * report. No React, no MUI, so the ordering rules stay testable on their own.
 */

/** TanStack Query key, shared so the page's refresh button can invalidate it too. */
export const HOST_HEALTH_QUERY_KEY = ['server-host-health'];

/** Worst first. Unknown sits above ok: a check that could not run is worth a look. */
const STATUS_RANK = { fail: 0, warn: 1, unknown: 2, ok: 3 };

/** The report is written by a shell script; anything unexpected reads as unknown. */
export const normalizeStatus = (status) =>
  (Object.hasOwn(STATUS_RANK, status) ? status : 'unknown');

export const statusRank = (status) => STATUS_RANK[normalizeStatus(status)];

export const STATUS_LABEL = { ok: 'OK', warn: 'Warning', fail: 'Failing', unknown: 'Unknown' };

/** The doctor's groups in the order a person would scan them when nothing is wrong. */
const GROUP_ORDER = ['Disks', 'Hardware', 'Services', 'Backups', 'Security', 'Network', 'System'];
const groupRank = (group) => {
  const i = GROUP_ORDER.indexOf(group);
  return i < 0 ? GROUP_ORDER.length : i;
};

/**
 * Checks grouped by `group`, problems first.
 *
 * Within a group, fail then warn then unknown then ok; ties keep the doctor's own order
 * (Array.prototype.sort is stable). Groups holding a failure come before groups holding
 * only warnings, and so on, so whatever is broken is at the top without scrolling. Groups
 * that are equally healthy fall back to the fixed order above, so an all-green report
 * always reads the same way.
 *
 * @returns {{group: string, worst: string, checks: object[]}[]}
 */
export function groupChecks(checks) {
  const byGroup = new Map();
  for (const check of checks ?? []) {
    if (!check) continue;
    const group = check.group || 'System';
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(check);
  }

  return [...byGroup.entries()]
    .map(([group, items]) => {
      const sorted = [...items].sort((a, b) => statusRank(a.status) - statusRank(b.status));
      return { group, worst: normalizeStatus(sorted[0]?.status), checks: sorted };
    })
    .sort((a, b) => statusRank(a.worst) - statusRank(b.worst)
      || groupRank(a.group) - groupRank(b.group)
      || a.group.localeCompare(b.group));
}

/** A group card is never narrower than this; the columns are as many as fit (max 3). */
export const GROUP_MIN_WIDTH = 340;
export const GROUP_GAP = 12;

/** How many group columns fit a container `width` px wide: 1 to 3. */
export function columnsForWidth(width, min = GROUP_MIN_WIDTH, gap = GROUP_GAP, max = 3) {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return 1;
  return Math.max(1, Math.min(max, Math.floor((w + gap) / (min + gap))));
}

/**
 * Splits groups into `columns` stacks of about equal height, for a masonry layout. In a
 * grid every row is as tall as its tallest card, so the 14-row Services group left the
 * cards beside it with a tall empty gap underneath.
 *
 * Greedy and order-keeping: each group, in the order given (problems first), goes to the
 * column that is shortest so far, ties to the left. Height is estimated rather than
 * measured: the header counts as two rows, and a row with a problem counts twice because
 * it opens with its detail and hint. Measuring would make a card hop to another column
 * when someone expands a row.
 *
 * @returns {object[][]} exactly `columns` arrays, some possibly empty
 */
export function distributeGroups(groups, columns) {
  const n = Math.max(1, Math.floor(Number(columns)) || 1);
  const stacks = Array.from({ length: n }, () => ({ height: 0, groups: [] }));
  for (const g of groups ?? []) {
    if (!g) continue;
    const checks = g.checks ?? [];
    const open = checks.filter((c) => normalizeStatus(c?.status) !== 'ok').length;
    let target = stacks[0];
    for (const s of stacks) if (s.height < target.height) target = s;
    target.groups.push(g);
    target.height += 2 + checks.length + open;
  }
  return stacks.map((s) => s.groups);
}

/** "just now", "4 min ago", "3 h ago", "2 days ago". Null when the age is unknown. */
export function formatAge(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null;
  const s = Math.max(0, Number(seconds));
  if (s < 60) return 'just now';
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/** "15 min", "1 h", "90 s". Null when unknown. */
export function formatInterval(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return null;
  const s = Number(seconds);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = s / 3600;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}
