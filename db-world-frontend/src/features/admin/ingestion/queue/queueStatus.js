// Pure helpers for the live queue bar (GET /api/ingestion/queue). No React here — unit-tested.

export const LOW_DISK_RATIO = 0.1;
export const LOW_DISK_BYTES = 5 * 1024 ** 3;

/** A disk is "low" when under 10 % free OR under 5 GiB free — whichever trips first. */
export function isLowDisk(disk) {
  const free = Number(disk?.freeBytes);
  const total = Number(disk?.totalBytes);
  if (!Number.isFinite(free) || !Number.isFinite(total) || total <= 0) return false;
  return free < LOW_DISK_BYTES || free / total < LOW_DISK_RATIO;
}

/** Normalises the backend snapshot (raw or wrapped in ApiResponse) into what the bar and cards render. */
export function summarizeQueue(payload) {
  const data = payload && 'data' in payload && payload.data && typeof payload.data === 'object'
    ? payload.data : payload;
  const waiting = Array.isArray(data?.waiting) ? data.waiting : [];
  const positions = {};
  waiting.forEach((jobId, i) => { positions[jobId] = i + 1; });
  const disks = (Array.isArray(data?.disks) ? data.disks : []).map((d) => ({
    label: d.label,
    freeBytes: Number(d.freeBytes) || 0,
    totalBytes: Number(d.totalBytes) || 0,
    low: isLowDisk(d),
  }));
  const aria2 = data?.aria2 ?? {};
  return {
    slotJobId: data?.slotJobId ?? null,
    waitingCount: waiting.length,
    parallelCount: Number(data?.parallelCount) || 0,
    positions,
    aria2Online: !!aria2.online,
    downloadSpeed: Number(aria2.downloadSpeed) || 0,
    aria2Active: Number(aria2.numActive) || 0,
    aria2Waiting: Number(aria2.numWaiting) || 0,
    disks,
    lowDisks: disks.filter((d) => d.low),
  };
}

export const BULK_ACTIONS = [
  {
    key: 'pause-all', label: 'Pause all downloads', statuses: ['DOWNLOADING'],
    confirm: 'Pause every active aria2 download? yt-dlp jobs cannot be paused and are skipped.',
  },
  {
    key: 'resume-all', label: 'Resume all paused', statuses: ['PAUSED'],
    confirm: 'Resume every paused download?',
  },
  {
    key: 'retry-failed', label: 'Retry all failed', statuses: ['FAILED'],
    confirm: 'Start a fresh rerun for every failed job? The failed cards are replaced by the new runs.',
  },
  {
    key: 'clear-finished', label: 'Clear finished from list', statuses: ['SUCCESS', 'COMPLETED', 'FAILED', 'CANCELLED'],
    confirm: 'Remove finished, failed and cancelled cards from the live list? History and imported media are kept.',
  },
];

/** How many live jobs each bulk action would touch — used to disable no-op menu items. */
export function bulkTargetCounts(jobs) {
  const counts = Object.fromEntries(BULK_ACTIONS.map((a) => [a.key, 0]));
  (jobs ?? []).forEach((job) => {
    BULK_ACTIONS.forEach((a) => { if (a.statuses.includes(job?.status)) counts[a.key] += 1; });
  });
  return counts;
}
