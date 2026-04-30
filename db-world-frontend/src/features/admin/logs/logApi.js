import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

// ── Static source/type config (mirrors backend LogSource enum) ─────────────
export const LOG_SOURCES_CONFIG = [
  {
    id: 'app', label: 'Application',
    supportsJson: true, supportsHistory: true,
    subTypes: [
      { id: 'info',    label: 'INFO',    color: '#0d9488' },
      { id: 'error',   label: 'ERROR',   color: '#ef4444' },
      { id: 'debug',   label: 'DEBUG',   color: '#10b981' },
      { id: 'request', label: 'REQUEST', color: '#3b82f6' },
    ],
  },
  {
    id: 'nginx', label: 'Nginx',
    supportsJson: false, supportsHistory: false,
    subTypes: [
      { id: 'access',     label: 'Access',    color: '#8b5cf6' },
      { id: 'api_access', label: 'API Access', color: '#f59e0b' },
      { id: 'cdn_access', label: 'CDN Access', color: '#06b6d4' },
      { id: 'cdn_error',  label: 'CDN Error',  color: '#f43f5e' },
    ],
  },
  {
    id: 'aria2', label: 'Aria2c',
    supportsJson: false, supportsHistory: false,
    subTypes: [
      { id: 'main', label: 'Main', color: '#ec4899' },
    ],
  },
];

export const getSourceConfig  = (id)     => LOG_SOURCES_CONFIG.find(s => s.id === id);
export const getSubTypeConfig = (src, t) => getSourceConfig(src)?.subTypes.find(s => s.id === t);

// ── API calls ──────────────────────────────────────────────────────────────

/** Fetch logs: date=YYYY-MM-DD for historical, omit for today */
export const fetchLogs = ({ source = 'app', type = 'info', format = 'JSON', lines = 500, date } = {}) =>
  axiosInstance
    .get(`/api/admin/logs/${source}/${type}`, { params: { format, lines, date } })
    .then(r => r.data.data);

/** Available dates for source/type history picker */
export const fetchAvailableDates = ({ source = 'app', type = 'info', format = 'JSON' } = {}) =>
  axiosInstance
    .get(`/api/admin/logs/${source}/${type}/dates`, { params: { format } })
    .then(r => r.data.data);

// Legacy compat — old LogsController endpoints
export const LOG_SOURCES = ['app', 'nginx', 'aria2c'];
export const LOG_TYPES   = ['ERROR', 'INFO', 'DEBUG', 'REQUEST'];
