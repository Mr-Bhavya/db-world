import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl, publicShareUrl } from '@shared/config/apiBaseUrl';

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
  return axiosInstance.post(`${BASE}/documents`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total ?? 1))),
  }).then(unwrap);
};

export const updateDocument = (id, body) =>
  axiosInstance.put(`${BASE}/documents/${id}`, body).then(unwrap);

export const deleteDocument = (id) =>
  axiosInstance.delete(`${BASE}/documents/${id}`).then((r) => r.data);

/** Authenticated content fetch as a Blob (used for both inline preview and download). */
export const fetchContentBlob = (id, disposition = 'inline') =>
  axiosInstance.get(`${BASE}/documents/${id}/content`, {
    params: { disposition }, responseType: 'blob',
  }).then((r) => r.data);

export const createShare = (id, body) =>
  axiosInstance.post(`${BASE}/documents/${id}/shares`, body).then(unwrap);
export const fetchShares = (id) =>
  axiosInstance.get(`${BASE}/documents/${id}/shares`).then(unwrap);
export const revokeShare = (shareId) =>
  axiosInstance.delete(`${BASE}/shares/${shareId}`).then((r) => r.data);

/** Full external URL for a share token. NOTE: verify publicShareUrl() returns the web origin. */
export const buildShareUrl = (token) => `${publicShareUrl()}/db-world/shared-doc/${token}`;

export const fetchSharedInfo = (token) =>
  axiosInstance.get(`${BASE}/shared/${token}/info`).then(unwrap);
export const sharedContentUrl = (token, disposition = 'inline') =>
  `${getApiBaseUrl()}${BASE}/shared/${encodeURIComponent(token)}/content?disposition=${disposition}`;
