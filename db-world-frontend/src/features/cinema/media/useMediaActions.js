import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useSnackbar } from 'notistack';
import AndroidPlugins from '@platform/android/AndroidPlugins';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import CommonServices from '@shared/services/CommonServices';
import { tmdbImg } from '../api/cinemaApi';
import { resolveMediaUrl } from '@shared/services/ApiServices';

/**
 * Shared hook for play and download actions used across all media screens.
 *
 * @param {object} mediaInfo  - Media info object from convertMediaInfoToCustomFormat
 * @param {object} [record]   - Optional record with tmdb title
 * @param {Array}  [allFiles] - All quality variants (for player quality switching)
 * @returns {{ handlePlay, handleDownload, resolving, playerOpen, setPlayerOpen, enrichedFiles }}
 */
export function useMediaActions(mediaInfo, record = null, allFiles = []) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [enrichedFiles, setEnrichedFiles] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  const resolveAll = useCallback(async (type) => {
    const files = allFiles.length > 0 ? allFiles : (mediaInfo ? [mediaInfo] : []);
    return Promise.all(files.map(async (f) => {
      if (!f?.mediaFileId) return f;
      try {
        const res = await resolveMediaUrl(f.mediaFileId, type);
        const cdnUrl = res?.data?.cdnUrl;
        return cdnUrl ? { ...f, streamUrl: type === 'ONLINE' ? cdnUrl : f.streamUrl, downloadUrl: type === 'DOWNLOAD' ? cdnUrl : f.downloadUrl } : f;
      } catch { return f; }
    }));
  }, [mediaInfo, allFiles]);

  const handlePlay = useCallback(async () => {
    if (!mediaInfo) return;
    setResolving(true);
    try {
      const enriched = await resolveAll('ONLINE');
      setEnrichedFiles(enriched);
      const current = enriched.find(f => f.mediaFileId === mediaInfo.mediaFileId) ?? enriched[0];
      if (Capacitor.getPlatform() === 'android') {
        AndroidPlugins.launchNativePlayer({
          url: current?.streamUrl,
          title: record?.tmdb?.title || record?.title || mediaInfo.general?.fileName || '',
          fileName: mediaInfo.general?.fileName || '',
          fileId: String(mediaInfo.id || ''),
          preferredAudio: 'Hindi',
          preferredSub: null,
        });
      } else {
        setPlayerOpen(true);
      }
    } catch (_e) {
      enqueueSnackbar('Failed to prepare stream', { variant: 'error' });
    } finally {
      setResolving(false);
    }
  }, [mediaInfo, record, resolveAll, enqueueSnackbar]);

  const handleDownload = useCallback(async () => {
    if (!mediaInfo) return;
    setResolving(true);
    try {
      const res = await resolveMediaUrl(mediaInfo.mediaFileId, 'DOWNLOAD');
      const cdnUrl = res?.data?.cdnUrl;
      if (!cdnUrl) throw new Error('No CDN URL');
      if (Capacitor.getPlatform() === 'android') {
        await DbWorldDownload.ensurePermissions();
        const dlResult = await DbWorldDownload.startDownload({
          url: cdnUrl,
          fileName: mediaInfo.general?.fileName || 'download',
          title: record?.tmdb?.title || record?.title || mediaInfo.general?.fileName || 'Download',
          thumbnailUrl: tmdbImg(record?.tmdb?.posterPath, 'w185') || '',
        });
        if (dlResult?.alreadyDownloaded) {
          enqueueSnackbar(`Already downloaded: ${mediaInfo.general?.fileName || 'file'}`, { variant: 'info', autoHideDuration: 3000 });
        } else {
          enqueueSnackbar(`Added to downloads: ${mediaInfo.general?.fileName || 'file'}`, { variant: 'success', autoHideDuration: 3000 });
        }
      } else {
        CommonServices.handleDownload(cdnUrl, { fileName: mediaInfo.general?.fileName, openInNewTab: true });
      }
    } catch (e) {
      console.error('Download failed', e);
      enqueueSnackbar('Failed to start download', { variant: 'error' });
    } finally {
      setResolving(false);
    }
  }, [mediaInfo, enqueueSnackbar]);

  return { handlePlay, handleDownload, resolving, playerOpen, setPlayerOpen, enrichedFiles };
}
