import { Capacitor } from '@capacitor/core';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl, publicShareUrl } from '@shared/config/apiBaseUrl';
import { fetchBinaryBlobNative } from '@platform/android/nativeHttp';
import Constants from '@shared/constants';

const isNative = () => Capacitor?.isNativePlatform?.() ?? false;

const BASE = '/api/wallet';
const unwrap = (r) => r.data?.data ?? r.data;

export const fetchDocumentTypes = () =>
  axiosInstance.get(`${BASE}/document-types`).then(unwrap);

export const fetchDocuments = ({ typeId, q } = {}) =>
  axiosInstance.get(`${BASE}/documents`, {
    params: { typeId: typeId || undefined, q: q || undefined },
  }).then(unwrap);

export const fetchDocument = (id) =>
  axiosInstance.get(`${BASE}/documents/${id}`).then(unwrap);

export const addDocument = (values, onProgress) => {
  const fd = new FormData();
  fd.append('file', values.file);
  fd.append('typeId', values.typeId);
  if (values.label)      fd.append('label', values.label);
  if (values.number)     fd.append('number', values.number);
  if (values.issueDate)  fd.append('issueDate', values.issueDate);
  if (values.expiryDate) fd.append('expiryDate', values.expiryDate);
  if (values.notes)      fd.append('notes', values.notes);
  if (values.holderName) fd.append('holder', values.holderName);
  return axiosInstance.post(`${BASE}/documents`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
  }).then(unwrap);
};

export const updateDocument = (id, body) =>
  axiosInstance.put(`${BASE}/documents/${id}`, body).then(unwrap);

export const replaceDocumentFile = (id, file, onProgress) => {
  const fd = new FormData();
  fd.append('file', file);
  return axiosInstance.put(`${BASE}/documents/${id}/file`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
  }).then(unwrap);
};

export const deleteDocument = (id) =>
  axiosInstance.delete(`${BASE}/documents/${id}`).then((r) => r.data);

/**
 * Authenticated content fetch as a Blob (used for both inline preview and download). On native we
 * bypass the CapacitorHttp fetch patch (which corrupts binary bodies) via a direct base64 fetch.
 */
export const fetchContentBlob = (id, disposition = 'inline') => {
  const path = `${BASE}/documents/${id}/content`;
  if (isNative()) return fetchBinaryBlobNative(`${getApiBaseUrl()}${path}`, { params: { disposition } });
  return axiosInstance.get(path, { params: { disposition }, responseType: 'blob' }).then((r) => r.data);
};

/** Small JPEG thumbnail (owner-auth). Only present when the summary's `hasThumbnail` is true. */
export const fetchThumbnailBlob = (id) => {
  const path = `${BASE}/documents/${id}/thumbnail`;
  if (isNative()) return fetchBinaryBlobNative(`${getApiBaseUrl()}${path}`);
  return axiosInstance.get(path, { responseType: 'blob' }).then((r) => r.data);
};

export const createShare = (id, body) =>
  axiosInstance.post(`${BASE}/documents/${id}/shares`, body).then(unwrap);
export const fetchShares = (id) =>
  axiosInstance.get(`${BASE}/documents/${id}/shares`).then(unwrap);
export const revokeShare = (shareId) =>
  axiosInstance.delete(`${BASE}/shares/${shareId}`).then((r) => r.data);

/** Full external URL for a share token, built from the page origin + the app route constant. */
export const buildShareUrl = (token) => {
  let origin;
  try { origin = new URL(publicShareUrl()).origin; }
  catch { origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''; }
  return `${origin}${Constants.DB_WALLET_SHARE_ROUTE.replace(':token', encodeURIComponent(token))}`;
};

export const fetchSharedInfo = (token) =>
  axiosInstance.get(`${BASE}/shared/${encodeURIComponent(token)}/info`).then(unwrap);
export const sharedContentUrl = (token, disposition = 'inline') =>
  `${getApiBaseUrl()}${BASE}/shared/${encodeURIComponent(token)}/content?disposition=${disposition}`;

/** Public content fetch as a Blob (no auth — used by the public share preview page). */
export const fetchSharedContentBlob = (token, disposition = 'inline') => {
  const path = `${BASE}/shared/${encodeURIComponent(token)}/content`;
  if (isNative()) return fetchBinaryBlobNative(`${getApiBaseUrl()}${path}`, { params: { disposition }, auth: false });
  return axiosInstance.get(path, { params: { disposition }, responseType: 'blob' }).then((r) => r.data);
};
