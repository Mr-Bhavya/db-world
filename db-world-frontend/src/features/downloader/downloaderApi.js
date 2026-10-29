import { useQuery } from '@tanstack/react-query';
import api from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import { Capacitor } from '@capacitor/core';

export const DOWNLOADS_KEY = ['media-downloads'];
export const activeStatuses = ['QUEUED', 'DOWNLOADING', 'CONVERTING'];
export const errorMessage = (error) => error?.response?.data?.message || error?.response?.data?.detail || error?.message || 'The request failed. Please retry.';

export function useMediaJobs(admin = false, enabled = true) {
  return useQuery({
    queryKey: [...DOWNLOADS_KEY, admin ? 'admin' : 'mine'],
    queryFn: async () => (await api.get(`/api/downloader/${admin ? 'admin/' : ''}jobs`)).data,
    enabled,
    refetchInterval: (query) => query.state.data?.some((job) => activeStatuses.includes(job.status)) ? 2000 : 15000,
  });
}

export const inspectMedia = async (url, playlist) => (await api.post('/api/downloader/inspect', { url, playlist }, { timeout: 150000 })).data;
export const createMediaJobs = async (request) => (await api.post('/api/downloader/jobs', request)).data;
export const mediaFiles = async (id) => (await api.get(`/api/downloader/jobs/${id}/files`)).data;
export const cleanupMedia = async () => (await api.post('/api/downloader/admin/cleanup')).data;

export async function jobAction(id, action, admin = false) {
  const path = `/api/downloader/${admin ? 'admin/' : ''}jobs/${id}`;
  if (action === 'delete' && !admin) return api.delete(path);
  return api.post(`${path}/${action}`);
}

export async function saveMedia(jobs, name) {
  const nativeClient = Capacitor.isNativePlatform();
  const { data } = await api.post('/api/downloader/tickets', { ids: jobs.map((job) => job.id), name, nativeClient });
  const url = `${getApiBaseUrl()}${data.url}`;
  await DbWorldDownload.ensurePermissions();
  await DbWorldDownload.setConcurrentLimit({ limit: 1 });
  return DbWorldDownload.startDownload({
    url,
    fileName: jobs.length > 1 ? 'media-downloads.zip' : name || jobs[0].fileName,
    title: jobs.length > 1 ? `${jobs.length} media files` : jobs[0].title,
    thumbnailUrl: jobs[0].thumbnail || '',
    source: 'downloader',
    jobId: jobs.length === 1 ? jobs[0].id : '',
  });
}

export function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '--';
  const unit = Math.min(4, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** unit).toFixed(unit ? 1 : 0)} ${['B', 'KB', 'MB', 'GB', 'TB'][unit]}`;
}

export function formatEta(seconds) {
  if (seconds == null || seconds < 0 || !Number.isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`;
}

export const statusLabel = (job) => ({
  QUEUED: `Queued${job.queuePosition ? ` #${job.queuePosition}` : ''}`,
  DOWNLOADING: 'Downloading to server', CONVERTING: 'Converting', READY: 'Ready to save',
  FAILED: 'Failed', CANCELLED: 'Cancelled', EXPIRED: 'Expired', DELETED: 'Server copy deleted',
}[job.status] || job.status);