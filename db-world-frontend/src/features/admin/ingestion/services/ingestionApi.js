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

/** Release a queued job from the download queue so it downloads immediately, in parallel. */
export const releaseJob = async (jobId) => {
  const res = await axiosInstance.put(`/api/ingestion/${jobId}/release`);
  return res.data;
};

/**
 * Rerun a job. With no body it reuses the original stored request (secrets preserved); with an
 * `overrides` body (from the edit dialog) the server merges the edits and backfills any secrets the
 * params snapshot couldn't echo (passwords, .torrent bytes).
 */
export const rerunJob = async (jobId, overrides) => {
  const res = await axiosInstance.post(`/api/ingestion/${jobId}/rerun`, overrides ?? undefined);
  return res.data;
};

/** Re-editable snapshot of a job's original request (for rerun-with-edit). */
export const getJobParams = async (jobId) => {
  const res = await axiosInstance.get(`/api/ingestion/${jobId}/params`);
  return res.data;
};

/** Live-edit safe fields (season/episode) on a still-running job. */
export const editJobParams = async (jobId, body) => {
  const res = await axiosInstance.patch(`/api/ingestion/${jobId}/params`, body);
  return res.data;
};

// ── Interactive track review (audio/subtitle selection while AWAITING_INPUT) ───

/** Detected audio/subtitle tracks + smart-default suggestion for a parked job. */
export const getJobTracks = async (jobId) => {
  const res = await axiosInstance.get(`/api/ingestion/${jobId}/tracks`);
  return res.data;
};

/** Submit the chosen audio/subtitle languages, unparking the job to continue processing. */
export const submitJobTracks = async (jobId, selection) => {
  const res = await axiosInstance.post(`/api/ingestion/${jobId}/tracks`, selection);
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
  // Admin autocomplete: unlike the public one it does NOT filter out DRAFT/UNLISTED records, so an
  // admin can link media to a not-yet-published record. Also matches substrings ("Ironman" → "The Ironman").
  const res = await axiosInstance.get('/api/cinema/admin/catalog/autocomplete', { params: { q } });
  return res.data;
};

/**
 * Full record, including tmdb.seasons[].episodes[].
 *
 * The autocomplete above returns a summary with no season data, so the season
 * and episode pickers need this second call once a TV record is chosen.
 */
export const getRecordDetail = async (id) => {
  const res = await axiosInstance.get(`/api/cinema/catalog/${id}`);
  return res.data?.data ?? res.data;
};
