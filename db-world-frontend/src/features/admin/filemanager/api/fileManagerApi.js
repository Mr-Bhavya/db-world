import { Capacitor } from '@capacitor/core';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

const BASE = '/api/admin/file-manager';

const isNative = () => Capacitor?.isNativePlatform?.() ?? false;

/** Reads a Blob/File to base64 (no data: prefix). */
const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

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

export const uploadChunk = async (uploadId, index, blob, { onProgress, signal } = {}) => {
  // Native must send base64/JSON — CapacitorHttp corrupts binary octet-stream bodies, which changed
  // the chunk length and caused "Upload incomplete: size mismatch". base64 is ASCII and survives.
  if (isNative()) {
    const dataBase64 = await blobToBase64(blob);
    const r = await axiosInstance.put(`${BASE}/uploads/${uploadId}/chunk/base64`,
      { index, dataBase64 }, { onUploadProgress: onProgress, signal });
    return r.data.data;
  }
  const r = await axiosInstance.put(`${BASE}/uploads/${uploadId}/chunk`, blob, {
    headers: { 'Content-Type': 'application/octet-stream' },
    params: { index },
    onUploadProgress: onProgress,
    signal,
  });
  return r.data.data;
};

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
export const downloadTicketUrl = async ({ locationId, path, download = false }) => {
  const { data } = await axiosInstance.post(`${BASE}/download-ticket`, null, {
    params: { locationId, path },
  });
  const ticketId = data.data.ticketId;
  // download=1 makes the server send Content-Disposition: attachment + the real filename, so the
  // browser saves it (not opens inline) and it isn't named "stream". Omit it for inline previews.
  const dl = download ? '&download=1' : '';
  return `${getApiBaseUrl()}${BASE}/download/stream?ticket=${encodeURIComponent(ticketId)}${dl}`;
};

/** Builds the (unauthenticated-by-cookie/JWT-header) thumbnail URL — no network call here. */
export const thumbnailUrl = ({ locationId, path }) =>
  `${getApiBaseUrl()}${BASE}/thumbnail?locationId=${encodeURIComponent(locationId)}&path=${encodeURIComponent(path)}`;

/**
 * Fetches the thumbnail as an authenticated Blob. The `/thumbnail` endpoint is
 * `@AdminAccess`, so a plain `<img src={thumbnailUrl(...)}>` 401s — callers
 * must fetch the bytes through axios (which carries the auth header) and
 * render them via `URL.createObjectURL` (see `components/ThumbnailImage.jsx`).
 */
export const fetchThumbnailBlob = ({ locationId, path }) =>
  axiosInstance
    .get(`${BASE}/thumbnail`, { params: { locationId, path }, responseType: 'blob' })
    .then(r => r.data);

export const fetchTextPreview = ({ locationId, path }) =>
  axiosInstance
    .get(`${BASE}/preview/text`, { params: { locationId, path } })
    .then(r => r.data.data);
