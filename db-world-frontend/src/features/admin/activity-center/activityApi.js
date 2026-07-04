import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

// ─── Activity tracking (new) ──────────────────────────────────────────────────
// New unified admin activity-tracking endpoints. Replaces the legacy cinema
// activity + HTTP log endpoints below at cutover; kept side-by-side for now.

const ACTIVITY = '/api/admin/activity';

export const fetchActivityOverview = (days = 7) =>
  axiosInstance.get(`${ACTIVITY}/overview`, { params: { days } }).then(r => r.data.data);

export const fetchLiveSessions = (withinMinutes = 30) =>
  axiosInstance.get(`${ACTIVITY}/live`, { params: { withinMinutes } }).then(r => r.data.data);

export const fetchSessions = ({
  userId,
  activity,
  channel,
  clientApp,
  state,
  recordId,
  from,
  to,
  page = 0,
  size = 25,
  sort,
} = {}) =>
  axiosInstance.get(`${ACTIVITY}/sessions`, {
    params: {
      page, size,
      ...(userId != null && { userId }),
      ...(activity && { activity }),
      ...(channel && { channel }),
      ...(clientApp && { clientApp }),
      ...(state && { state }),
      ...(recordId != null && { recordId }),
      ...(from && { from }),
      ...(to && { to }),
      ...(sort && { sort }),
    },
  }).then(r => r.data.data);

export const fetchSessionEvents = (sessionId) =>
  axiosInstance.get(`${ACTIVITY}/sessions/${sessionId}/events`).then(r => r.data.data);

export const fetchActivityTrend = (days = 30) =>
  axiosInstance.get(`${ACTIVITY}/trend`, { params: { days } }).then(r => r.data.data);

export const fetchClientBreakdown = (days = 30) =>
  axiosInstance.get(`${ACTIVITY}/client-breakdown`, { params: { days } }).then(r => r.data.data);

export const fetchTopContent = (days = 30, limit = 20) =>
  axiosInstance.get(`${ACTIVITY}/top-content`, { params: { days, limit } }).then(r => r.data.data);

export const fetchTopUsers = (days = 30, limit = 20) =>
  axiosInstance.get(`${ACTIVITY}/top-users`, { params: { days, limit } }).then(r => r.data.data);

// ─── Cinema activity ──────────────────────────────────────────────────────────

const CINEMA = '/api/user-cinema-activity/admin';

export const fetchCinemaDashboard = (days = 7) =>
  axiosInstance.get(`${CINEMA}/dashboard-stats`, { params: { days } }).then(r => r.data.data);

export const fetchCinemaRecent = ({ limit = 100, activityType = '', hours = 24 } = {}) =>
  axiosInstance.get(`${CINEMA}/all-recent`, {
    params: { limit, hours, ...(activityType && { activityType }) },
  }).then(r => r.data.data);

export const fetchCinemaUsers = (hours = 24) =>
  axiosInstance.get(`${CINEMA}/user-list`, { params: { hours } }).then(r => r.data.data);

export const fetchUserActivities = ({ userEmail, limit = 50, activityType = '', hours = 24 } = {}) =>
  axiosInstance.get(`${CINEMA}/user-activities`, {
    params: { userEmail, limit, hours, ...(activityType && { activityType }) },
  }).then(r => r.data.data);

// ─── HTTP activity logs ───────────────────────────────────────────────────────

const API_LOGS = '/api/admin/activity-logs';

export const fetchApiLogs = ({ page = 0, size = 50, username = '', method = '', status = '', uri = '', sortBy = 'timestamp', sortDir = 'desc' } = {}) =>
  axiosInstance.get(API_LOGS, {
    params: {
      page, size,
      ...(username && { username }),
      ...(method   && { method }),
      ...(status   && { status }),
      ...(uri      && { uri }),
      sortBy,
      sortDir,
    },
  }).then(r => r.data.data);

// ─── Shared helpers ───────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  { value: '',         label: 'All Types'  },
  { value: 'DOWNLOAD', label: 'Downloads'  },
  { value: 'STREAM',   label: 'Streams'    },
  { value: 'SEARCH',   label: 'Searches'   },
];

export const TIME_RANGES = [
  { value: 1,   label: 'Last hour'    },
  { value: 24,  label: 'Last 24 h'   },
  { value: 168, label: 'Last 7 days' },
  { value: 720, label: 'Last 30 days'},
];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export const TYPE_META = {
  DOWNLOAD: { color: '#0d9488', label: 'Download' },
  STREAM:   { color: '#3b82f6', label: 'Stream'   },
  SEARCH:   { color: '#f59e0b', label: 'Search'   },
};

export const METHOD_COLOR = {
  GET:    '#10b981',
  POST:   '#3b82f6',
  PUT:    '#f59e0b',
  PATCH:  '#f59e0b',
  DELETE: '#ef4444',
};

export const fmtBytes = (b) => {
  if (!b || b === 0) return '—';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
};

export const fmtAgo = (ts) => {
  if (!ts) return '—';
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const fmtDuration = (ms) => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
};

export const fileName = (p) => (p ? p.split(/[/\\]/).pop() || p : '—');

export const statusColor = (s) => {
  if (!s) return '#6b7280';
  if (s < 300) return '#10b981';
  if (s < 400) return '#f59e0b';
  if (s < 500) return '#ef4444';
  return '#8b5cf6';
};
