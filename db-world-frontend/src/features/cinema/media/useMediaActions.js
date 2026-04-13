import { useCallback, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import AndroidPlugins from '@platform/android/AndroidPlugins';
import CommonServices from '@shared/services/CommonServices';

const DbWorldDownload = registerPlugin('DbWorldDownload');

/**
 * Shared hook for play and download actions used across all media screens.
 *
 * @param {object} mediaInfo  - Media info object from convertMediaInfoToCustomFormat
 * @param {object} [record]   - Optional record with tmdb title
 * @returns {{ handlePlay, handleDownload, playerOpen, setPlayerOpen }}
 */
export function useMediaActions(mediaInfo, record = null) {
  const [playerOpen, setPlayerOpen] = useState(false);

  const handlePlay = useCallback(() => {
    if (!mediaInfo) return;
    const { general } = mediaInfo;
    if (Capacitor.getPlatform() === 'android') {
      AndroidPlugins.launchNativePlayer({
        url: mediaInfo.streamUrl,
        title: record?.tmdb?.title || record?.title || general?.fileName || '',
        fileName: general?.fileName || '',
        fileId: String(mediaInfo.id || ''),
        preferredAudio: 'Hindi',
        preferredSub: null,
      });
    } else {
      setPlayerOpen(true);
    }
  }, [mediaInfo, record]);

  const handleDownload = useCallback(() => {
    if (!mediaInfo) return;
    const { general } = mediaInfo;
    if (Capacitor.getPlatform() === 'android') {
      DbWorldDownload.startDownload({
        url: mediaInfo.downloadUrl,
        fileName: general?.fileName || 'download',
      }).catch(e => console.error('Download failed', e));
    } else {
      CommonServices.handleDownload(mediaInfo.downloadUrl, {
        fileName: general?.fileName,
        openInNewTab: true,
      });
    }
  }, [mediaInfo]);

  return { handlePlay, handleDownload, playerOpen, setPlayerOpen };
}
