import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

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
