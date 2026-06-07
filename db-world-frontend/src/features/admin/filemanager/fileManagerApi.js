import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

const BASE = '/api/admin/file-manager';

export const listDirectory = ({ path = '/', sortBy = 'name', order = 'asc' } = {}) =>
  axiosInstance.get(`${BASE}/list`, { params: { path, sortBy, order } }).then(r => r.data.data);

export const searchFiles = ({ q, path = '/', recursive = true }) =>
  axiosInstance.get(`${BASE}/search`, { params: { q, path, recursive } }).then(r => r.data.data);

export const getFileInfo = (path) =>
  axiosInstance.get(`${BASE}/info`, { params: { path } }).then(r => r.data.data);

/**
 * Stream-downloads a file without loading it into browser memory.
 * Gets a one-time ticket, then navigates to the stream URL so the browser
 * handles the download natively (works for files of any size).
 */
export const downloadFile = async (path) => {
  const { data } = await axiosInstance.post(`${BASE}/download-ticket`, null, { params: { path } });
  const ticketId = data.data.ticketId;
  // Absolute API host — a relative href would resolve against the page origin
  // (db-world.in / localhost in the app) instead of api.db-world.in.
  const url = `${getApiBaseUrl()}${BASE}/download/stream?ticket=${encodeURIComponent(ticketId)}`;
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const uploadFiles = (path, files, onProgress) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return axiosInstance.post(`${BASE}/upload`, fd, {
    params: { path },
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded * 100) / (e.total ?? 1))),
  }).then(r => r.data.data); // returns FileUploadResultDto { uploaded, errors, successCount, failureCount }
};

export const createDirectory = (path, name) =>
  axiosInstance.post(`${BASE}/mkdir`, { path, name }).then(r => r.data.data);

export const renameItem = (path, newName) =>
  axiosInstance.post(`${BASE}/rename`, { path, newName }).then(r => r.data.data);

export const moveItem = (sourcePath, destinationPath) =>
  axiosInstance.post(`${BASE}/move`, { sourcePath, destinationPath }).then(r => r.data.data);

export const copyItem = (sourcePath, destinationPath) =>
  axiosInstance.post(`${BASE}/copy`, { sourcePath, destinationPath }).then(r => r.data.data);

export const deleteItem = (path) =>
  axiosInstance.delete(`${BASE}/delete`, { params: { path } }).then(r => r.data);
