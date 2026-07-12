import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

const BASE = '/api/admin/file-manager';

/* ─── Directory / search / info ─────────────────────────────────────── */

export const listDirectory = ({ locationId, path = '/', sortBy = 'name', order = 'asc' } = {}) =>
  axiosInstance
    .get(`${BASE}/list`, { params: { locationId, path, sortBy, order } })
    .then(r => r.data.data);

export const searchFiles = ({ locationId, q, path = '/', recursive = true } = {}) =>
  axiosInstance
    .get(`${BASE}/search`, { params: { locationId, q, path, recursive } })
    .then(r => r.data.data);

export const getFileInfo = ({ locationId, path } = {}) =>
  axiosInstance
    .get(`${BASE}/info`, { params: { locationId, path } })
    .then(r => r.data.data);

/* ─── File operations ───────────────────────────────────────────────── */

export const mkdir = ({ locationId, path, name }) =>
  axiosInstance.post(`${BASE}/mkdir`, { locationId, path, name }).then(r => r.data.data);

export const renameItem = ({ locationId, path, newName }) =>
  axiosInstance.post(`${BASE}/rename`, { locationId, path, newName }).then(r => r.data.data);

export const moveItem = ({ locationId, sourcePath, destinationPath }) =>
  axiosInstance.post(`${BASE}/move`, { locationId, sourcePath, destinationPath }).then(r => r.data.data);

export const copyItem = ({ locationId, sourcePath, destinationPath }) =>
  axiosInstance.post(`${BASE}/copy`, { locationId, sourcePath, destinationPath }).then(r => r.data.data);

export const deleteItem = ({ locationId, path }) =>
  axiosInstance
    .delete(`${BASE}/delete`, { params: { locationId, path } })
    .then(r => r.data.data);

/* ─── Locations ──────────────────────────────────────────────────────── */

export const listLocations = () =>
  axiosInstance.get(`${BASE}/locations`).then(r => r.data.data);

export const createLocation = (body) =>
  axiosInstance.post(`${BASE}/locations`, body).then(r => r.data.data);

export const updateLocation = (id, body) =>
  axiosInstance.put(`${BASE}/locations/${id}`, body).then(r => r.data.data);

export const deleteLocation = (id) =>
  axiosInstance.delete(`${BASE}/locations/${id}`).then(r => r.data.data);

/* ─── Resumable chunked uploads ──────────────────────────────────────── */

export const initUpload = (body) =>
  axiosInstance.post(`${BASE}/uploads/init`, body).then(r => r.data.data);

export const uploadChunk = (uploadId, index, blob, { onProgress, signal } = {}) =>
  axiosInstance
    .put(`${BASE}/uploads/${uploadId}/chunk`, blob, {
      headers: { 'Content-Type': 'application/octet-stream' },
      params: { index },
      onUploadProgress: onProgress,
      signal,
    })
    .then(r => r.data.data);

export const uploadStatus = (uploadId) =>
  axiosInstance.get(`${BASE}/uploads/${uploadId}`).then(r => r.data.data);

export const completeUpload = (uploadId) =>
  axiosInstance.post(`${BASE}/uploads/${uploadId}/complete`).then(r => r.data.data);

export const abortUpload = (uploadId) =>
  axiosInstance.delete(`${BASE}/uploads/${uploadId}`).then(r => r.data.data);

/* ─── Download / preview ─────────────────────────────────────────────── */

/**
 * Mints a one-time download ticket, then returns the absolute public stream
 * URL (ticketed, range-capable). Absolute API host because a relative href
 * would resolve against the page origin instead of the API origin.
 */
export const downloadTicketUrl = async ({ locationId, path }) => {
  const { data } = await axiosInstance.post(`${BASE}/download-ticket`, null, {
    params: { locationId, path },
  });
  const ticketId = data.data.ticketId;
  return `${getApiBaseUrl()}${BASE}/download/stream?ticket=${encodeURIComponent(ticketId)}`;
};

/** Builds the (unauthenticated-by-cookie/JWT-header) thumbnail URL — no network call here. */
export const thumbnailUrl = ({ locationId, path }) =>
  `${getApiBaseUrl()}${BASE}/thumbnail?locationId=${encodeURIComponent(locationId)}&path=${encodeURIComponent(path)}`;

export const fetchTextPreview = ({ locationId, path }) =>
  axiosInstance
    .get(`${BASE}/preview/text`, { params: { locationId, path } })
    .then(r => r.data.data);
