// db-world-frontend/src/features/adminv2/activity/activityApi.js
import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

const BASE = '/api/user-cinema-activity/admin';

export const fetchDashboardStats = (days = 7) =>
  axiosInstance.get(`${BASE}/dashboard-stats`, { params: { days } }).then(r => r.data.data);

export const fetchAllRecent = ({ limit = 100, activityType = '', hours = 24 } = {}) =>
  axiosInstance.get(`${BASE}/all-recent`, { params: { limit, ...(activityType && { activityType }), hours } }).then(r => r.data.data);

export const fetchUserList = (hours = 24) =>
  axiosInstance.get(`${BASE}/user-list`, { params: { hours } }).then(r => r.data.data);

export const fetchActivityStats = (days = 7) =>
  axiosInstance.get(`${BASE}/activity-stats`, { params: { days } }).then(r => r.data.data);

export const fetchUserActivities = ({ userEmail, limit = 50, activityType = '', hours = 24 } = {}) =>
  axiosInstance.get(`${BASE}/user-activities`, { params: { userEmail, limit, ...(activityType && { activityType }), hours } }).then(r => r.data.data);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  { value: '',         label: 'All Types' },
  { value: 'DOWNLOAD', label: 'Downloads' },
  { value: 'STREAM',   label: 'Streams'   },
  { value: 'SEARCH',   label: 'Searches'  },
];

export const TIME_RANGES = [
  { value: 1,    label: 'Last Hour'    },
  { value: 24,   label: 'Last 24h'    },
  { value: 168,  label: 'Last 7 days' },
  { value: 720,  label: 'Last 30 days'},
];

export const TYPE_META = {
  DOWNLOAD: { color: '#0d9488', bg: 'rgba(13,148,136,0.1)',  label: 'Download' },
  STREAM:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Stream'   },
  SEARCH:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Search'   },
};

export const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatTimeAgo = (ts) => {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const getFileName = (filePath) => {
  if (!filePath) return '—';
  return filePath.split(/[/\\]/).pop() || filePath;
};
