import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useSnackbar } from 'notistack';
import DbWorldDownload from '@platform/android/DbWorldDownload';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';
import { tmdbImg } from '../api/cinemaApi';
import { buildHybridEpisodes } from '../utils/episodeUtils';
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
  const navigate = useNavigate();

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
      if (!current?.streamUrl) throw new Error('No stream URL');
      // Quality variants for in-player switching (label from resolution, best effort).
      const variants = enriched
        .filter(f => f.streamUrl)
        .map(f => ({ url: f.streamUrl, label: f.quality || f.video?.resolution || f.general?.fileName || 'Source', mediaFileId: f.mediaFileId }));
      // Series episodes (same quality as the played file); [] for movies.
      const episodes = buildHybridEpisodes(enriched, current, record?.tmdb?.seasons);
      // Unified hybrid player (web + native) — full-screen route over a native surface.
      navigate(Constants.DB_PLAYER_ROUTE, {
        state: {
          media: {
            url:      current.streamUrl,
            fileId:   String(mediaInfo.id || mediaInfo.mediaFileId || ''),
            title:    record?.tmdb?.title || record?.title || mediaInfo.general?.fileName || '',
            fileName: mediaInfo.general?.fileName || '',
            recordId: record?.id || record?.recordId || null,
            variants,
            episodes,
          },
        },
      });
    } catch (_e) {
      enqueueSnackbar('Failed to prepare stream', { variant: 'error' });
    } finally {
      setResolving(false);
    }
  }, [mediaInfo, record, resolveAll, enqueueSnackbar, navigate]);

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
          // Persisted in Fetch extras so history survives restarts and can deep-link back.
          mediaFileId: String(mediaInfo.mediaFileId || mediaInfo.id || ''),
          recordId: String(record?.id || record?.recordId || res?.data?.recordId || ''),
          mimeType: res?.data?.mimeType || '',
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
