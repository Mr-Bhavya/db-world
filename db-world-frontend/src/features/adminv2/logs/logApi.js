import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

export const LOG_SOURCES = ['app', 'nginx', 'aria2c'];
export const LOG_TYPES   = ['ERROR', 'INFO', 'DEBUG', 'REQUEST'];

export const fetchLogs = ({ source = 'app', type = 'INFO', format = 'JSON', lines = 200, minutes } = {}) =>
  axiosInstance
    .get(`/api/logs/${source}/${type}`, { params: { format, lines, minutes } })
    .then(r => r.data.data);
