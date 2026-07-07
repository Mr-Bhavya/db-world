/**
 * Ingestion pipeline API — all endpoints use the new /api/ingestion/* paths.
 */
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

// ── Job lifecycle ────────────────────────────────────────────────────────────

/** Start one or more ingestion jobs. */
export const startIngestion = async (body) => {
  const res = await axiosInstance.post('/api/ingestion', body);
  return res.data;
};

export const pauseJob = async (jobId) => {
  const res = await axiosInstance.put(`/api/ingestion/${jobId}/pause`);
  return res.data;
};

export const resumeJob = async (jobId) => {
  const res = await axiosInstance.put(`/api/ingestion/${jobId}/resume`);
  return res.data;
};

export const cancelJob = async (jobId) => {
  const res = await axiosInstance.put(`/api/ingestion/${jobId}/cancel`);
  return res.data;
};

export const rerunJob = async (jobId) => {
  const res = await axiosInstance.post(`/api/ingestion/${jobId}/rerun`);
  return res.data;
};

/** Re-editable snapshot of a job's original request (for rerun-with-edit). */
export const getJobParams = async (jobId) => {
  const res = await axiosInstance.get(`/api/ingestion/${jobId}/params`);
  return res.data;
};

export const deleteJob = async (jobId) => {
  const res = await axiosInstance.delete(`/api/ingestion/${jobId}`);
  return res.data;
};

// ── Status / reports ────────────────────────────────────────────────────────

export const getJobStatus = async () => {
  const res = await axiosInstance.get('/api/ingestion/status');
  return res.data;
};

export const getJobReport = async (jobId) => {
  const res = await axiosInstance.get(`/api/ingestion/${jobId}/report`);
  return res.data;
};

// ── History ─────────────────────────────────────────────────────────────────

export const getJobHistory = async ({ page = 0, size = 50 } = {}) => {
  const res = await axiosInstance.get('/api/ingestion/history', { params: { page, size } });
  return res.data;
};

export const getJobHistoryByRecord = async (recordId) => {
  const res = await axiosInstance.get(`/api/ingestion/history/record/${recordId}`);
  return res.data;
};

// ── YouTube formats ─────────────────────────────────────────────────────────

export const fetchYtFormats = async (url) => {
  const res = await axiosInstance.get('/api/ingestion/yt/formats', { params: { url } });
  return res.data;
};

export const fetchPlaylist = async (url) => {
  const res = await axiosInstance.get('/api/ingestion/yt/playlist', { params: { url } });
  return res.data;
};

// ── File browser ─────────────────────────────────────────────────────────────

export const browseFiles = async (root, subPath = '') => {
  const res = await axiosInstance.get('/api/ingestion/files/browse', {
    params: { root, subPath },
  });
  return res.data;
};

// ── Link existing file ────────────────────────────────────────────────────────

export const linkExistingFile = async (body) => {
  const res = await axiosInstance.post('/api/ingestion/link-existing', body);
  return res.data;
};

// ── Unassigned media files ────────────────────────────────────────────────────

export const getUnassignedFiles = async (q = '') => {
  const res = await axiosInstance.get('/api/media/info/unassigned', {
    params: q ? { q } : {},
  });
  return res.data;
};

export const linkFileToRecord = async (mediaFileId, recordId) => {
  const res = await axiosInstance.patch(`/api/media/info/${mediaFileId}/link-record`, null, {
    params: { recordId },
  });
  return res.data;
};

// ── Record search ─────────────────────────────────────────────────────────────

export const searchRecords = async (q) => {
  const res = await axiosInstance.get('/api/cinema/catalog/autocomplete', { params: { q } });
  return res.data;
};
