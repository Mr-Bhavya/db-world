const SERVER_ACTIVE = new Set(['QUEUED', 'DOWNLOADING', 'CONVERTING']);
const DEVICE_ACTIVE = new Set(['pending', 'running', 'paused', 'handed_off']);
const SERVER_READY = new Set(['READY']);
const DEVICE_READY = new Set(['success', 'acknowledged']);
const SERVER_ATTENTION = new Set(['FAILED', 'CANCELLED', 'EXPIRED']);
const DEVICE_ATTENTION = new Set(['failed', 'cancelled']);
export const ADMIN_JOB_STATUSES = ['QUEUED', 'DOWNLOADING', 'CONVERTING', 'READY', 'FAILED', 'CANCELLED', 'EXPIRED', 'DELETED'];
const TABS = ['all', 'active', 'ready', 'failed'];

function itemMatchesTab(item, isServer, tab) {
  if (tab === 'all') return true;
  const statuses = isServer
    ? { active: SERVER_ACTIVE, ready: SERVER_READY, failed: SERVER_ATTENTION }
    : { active: DEVICE_ACTIVE, ready: DEVICE_READY, failed: DEVICE_ATTENTION };
  return statuses[tab]?.has(item.status) ?? false;
}

function selectedDeviceSource(item, source) {
  if (source === 'all') return true;
  return (item.source === 'downloader' ? 'downloader' : 'cinema') === source;
}

export function filterDownloads(jobs = [], downloads = [], source = 'all', tab = 'all') {
  return {
    serverJobs: (source === 'all' || source === 'downloader')
      ? jobs.filter((job) => itemMatchesTab(job, true, tab))
      : [],
    deviceDownloads: downloads.filter((item) => selectedDeviceSource(item, source) && itemMatchesTab(item, false, tab)),
  };
}

export function countDownloadTabs(jobs = [], downloads = [], source = 'all') {
  const counts = Object.fromEntries(TABS.map((tab) => [tab, 0]));
  for (const tab of TABS) {
    const filtered = filterDownloads(jobs, downloads, source, tab);
    counts[tab] = filtered.serverJobs.length + filtered.deviceDownloads.length;
  }
  return counts;
}

export function summarizeDownloads(jobs = [], downloads = []) {
  const activeJobs = jobs.filter((job) => SERVER_ACTIVE.has(job.status));
  const activeDevices = downloads.filter((item) => DEVICE_ACTIVE.has(item.status));
  const readyJobs = jobs.filter((job) => SERVER_READY.has(job.status));
  const readyDevices = downloads.filter((item) => DEVICE_READY.has(item.status));
  const failedJobs = jobs.filter((job) => job.status === 'FAILED');
  const failedDevices = downloads.filter((item) => item.status === 'failed');
  const knownReadyBytes = [
    ...readyJobs.map((job) => job.bytesTotal),
    ...readyDevices.map((item) => item.bytesTotal || item.bytesDownloaded),
  ].filter((size) => Number.isFinite(size) && size > 0);
  // Paused device items keep their last aria2 speed; only items actually moving bytes count.
  const positive = (value) => (Number(value) > 0 ? Number(value) : 0);
  const liveSpeed = activeJobs.reduce((sum, job) => sum + positive(job.speed), 0)
    + activeDevices.filter((item) => item.status === 'running')
      .reduce((sum, item) => sum + positive(item.speedBytesPerSec), 0);
  return {
    active: activeJobs.length + activeDevices.length,
    ready: readyJobs.length + readyDevices.length,
    failed: failedJobs.length + failedDevices.length,
    readyBytes: knownReadyBytes.reduce((total, size) => total + size, 0),
    readyBytesKnown: knownReadyBytes.length > 0,
    liveSpeed,
  };
}

export function pruneReadySelection(selected = [], jobs = []) {
  const readyIds = new Set(jobs.filter((job) => job.status === 'READY').map((job) => job.id));
  return selected.filter((id) => readyIds.has(id));
}

export function formatRelativeTime(value, reference = Date.now(), direction = 'past') {
  if (!value) return direction === 'future' ? 'Expiration unavailable' : 'Date unavailable';
  const timestamp = new Date(value).getTime();
  const now = reference instanceof Date ? reference.getTime() : Number(reference);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return direction === 'future' ? 'Expiration unavailable' : 'Date unavailable';
  const delta = timestamp - now;
  const absSeconds = Math.floor(Math.abs(delta) / 1000);
  const units = absSeconds < 60
    ? [Math.max(1, absSeconds), 'min']
    : absSeconds < 3600
      ? [Math.floor(absSeconds / 60), 'min']
      : absSeconds < 86400
        ? [Math.floor(absSeconds / 3600), 'h']
        : [Math.floor(absSeconds / 86400), 'd'];
  if (direction === 'future') {
    return delta < 0 ? `Expired ${units[0]} ${units[1]} ago` : `Expires in ${units[0]} ${units[1]}`;
  }
  return delta > 0 ? 'Added just now' : `Added ${units[0]} ${units[1]} ago`;
}

export function formatAbsoluteTime(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '';
  return new Date(value).toLocaleString();
}

export function matchesLocalDate(value, date) {
  if (!date) return true;
  if (!value) return false;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) return false;
  return timestamp.getFullYear() === year && timestamp.getMonth() === month - 1 && timestamp.getDate() === day;
}

export function countJobStatuses(jobs = []) {
  return Object.fromEntries(ADMIN_JOB_STATUSES.map((status) => [
    status,
    jobs.filter((job) => job.status === status).length,
  ]));
}

export function filterAdminJobs(jobs = [], { status = 'all', date = '', search = '' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return jobs.filter((job) => {
    const searchable = [job.owner, job.source, job.title, job.id, job.fileName]
      .filter((value) => value != null)
      .join(' ')
      .toLocaleLowerCase();
    return (status === 'all' || job.status === status)
      && (!date || matchesLocalDate(job.createdAt, date))
      && (!query || searchable.includes(query));
  });
}

const finiteNumber = (value) => {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
};

/**
 * Normalises live transfer numbers for display. aria2 and native download managers can report
 * downloaded > total or a missing ETA, so values are clamped and ETA falls back to remaining/speed.
 */
export function transferStats({ bytesDownloaded, bytesTotal, speed, eta, percent } = {}) {
  const totalValue = finiteNumber(bytesTotal);
  const total = totalValue != null && totalValue > 0 ? totalValue : null;
  const doneValue = finiteNumber(bytesDownloaded);
  const downloaded = doneValue != null && doneValue >= 0 ? (total ? Math.min(doneValue, total) : doneValue) : null;
  const percentValue = finiteNumber(percent);
  let shownPercent = null;
  if (percentValue != null) shownPercent = Math.max(0, Math.min(100, Math.floor(percentValue)));
  else if (total && downloaded != null) shownPercent = Math.floor((downloaded / total) * 100);
  const remaining = total && downloaded != null ? total - downloaded : null;
  const speedValue = finiteNumber(speed);
  const rate = speedValue != null && speedValue > 0 ? speedValue : null;
  const etaValue = finiteNumber(eta);
  let secondsLeft = etaValue != null && etaValue >= 0 ? etaValue : null;
  if (secondsLeft == null && remaining != null && rate) secondsLeft = Math.ceil(remaining / rate);
  return { percent: shownPercent, downloaded, total, remaining, speed: rate, eta: secondsLeft };
}
