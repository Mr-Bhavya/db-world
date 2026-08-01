import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

// ── Source/type config (mirrors backend LogSource enum) ──────────────────────
// app is the only source parsed into structured JSON (info/debug/error/request)
// with historical dates; the rest are raw text tails.
export const LOG_SOURCES_CONFIG = [
  {
    id: 'app', label: 'Application',
    supportsJson: true, supportsHistory: true,
    subTypes: [
      { id: 'info',    label: 'Info',    color: '#0284c7' },
      { id: 'error',   label: 'Error',   color: '#dc2626' },
      { id: 'debug',   label: 'Debug',   color: '#64748b' },
      { id: 'request', label: 'Request', color: '#0d9488' },
    ],
  },
  {
    id: 'nginx', label: 'Nginx',
    supportsJson: false, supportsHistory: false,
    subTypes: [
      { id: 'access',     label: 'Access',     color: '#8b5cf6' },
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
  {
    id: 'mysql', label: 'MySQL',
    supportsJson: false, supportsHistory: false,
    subTypes: [
      { id: 'backup', label: 'Backup', color: '#f59e0b' },
    ],
  },
];

export const getSourceConfig  = (id)      => LOG_SOURCES_CONFIG.find(s => s.id === id);
export const getSubTypeConfig = (src, t)  => getSourceConfig(src)?.subTypes.find(s => s.id === t);

// ── API calls ────────────────────────────────────────────────────────────────

/** Fetch a tail of logs. date=YYYY-MM-DD for a historical day (app only), omit for today.
 *  Resolves { entries, count, fileFound, source, type, format, date }. */
export const fetchLogs = ({ source = 'app', type = 'info', format = 'JSON', lines = 500, date } = {}) =>
  axiosInstance
    .get(`/api/admin/logs/${source}/${type}`, { params: { format, lines, date } })
    .then(r => r.data.data);

/** Available history dates (newest first) for the date picker. */
export const fetchAvailableDates = ({ source = 'app', type = 'info', format = 'JSON' } = {}) =>
  axiosInstance
    .get(`/api/admin/logs/${source}/${type}/dates`, { params: { format } })
    .then(r => r.data.data);

/** Absolute SSE follow URL. The live tail is consumed via fetch+ReadableStream so
 *  it can carry the Bearer token (EventSource can't set headers). One long-lived
 *  connection — no repeated polling. */
export const followUrl = (source, type, format = 'JSON') =>
  `${getApiBaseUrl()}/api/admin/logs/${source}/${type}/follow?format=${format}`;
