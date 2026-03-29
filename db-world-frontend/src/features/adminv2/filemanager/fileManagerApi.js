import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

const BASE = '/api/admin/file-manager';

export const listDirectory = ({ path = '/', sortBy = 'name', order = 'asc' } = {}) =>
  axiosInstance.get(`${BASE}/list`, { params: { path, sortBy, order } }).then(r => r.data.data);

export const searchFiles = ({ q, path = '/', recursive = true }) =>
  axiosInstance.get(`${BASE}/search`, { params: { q, path, recursive } }).then(r => r.data.data);

export const getFileInfo = (path) =>
  axiosInstance.get(`${BASE}/info`, { params: { path } }).then(r => r.data.data);

export const downloadFile = (path, filename) =>
  axiosInstance.get(`${BASE}/download`, { params: { path }, responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(r.data);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });

export const uploadFiles = (path, files, onProgress) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return axiosInstance.post(`${BASE}/upload`, fd, {
    params: { path },
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded * 100) / (e.total ?? 1))),
  }).then(r => r.data.data);
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
