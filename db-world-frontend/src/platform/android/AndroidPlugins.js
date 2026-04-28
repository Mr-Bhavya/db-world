import { registerPlugin } from '@capacitor/core';
import DbWorldDownload from './DbWorldDownload'; // single registration — don't re-register here
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

/** Native Android video player (VideoPlayerActivity / ExoPlayer Media3) */
const DbWorldPlayer = registerPlugin('DbWorldPlayer');

// When the native player closes, save watch position to the backend.
DbWorldPlayer.addListener('playerStopped', async (data) => {
  if (!data?.fileId || !data.positionMs) return;
  try {
    await axiosInstance.put(`/api/cinema/progress/${data.fileId}`, null, {
      params: {
        positionMs: data.positionMs,
        durationMs: data.durationMs || 0,
        audioLang: data.audioLang || undefined,
        subLang:   data.subLang   || undefined,
      },
    });
  } catch (e) {
    console.warn('[AndroidPlugins] progress save failed', e?.message);
  }
});

/**
 * Launch the native Android player.
 *
 * @param {object} opts
 * @param {string}        opts.url             - Stream URL
 * @param {string}        [opts.title]         - Show/movie title
 * @param {string}        [opts.fileName]      - File name for display
 * @param {string}        [opts.fileId]        - Unique ID used as resume key
 * @param {string}        [opts.preferredAudio='Hindi'] - Preferred audio language
 * @param {string|null}   [opts.preferredSub=null]      - Preferred subtitle (null = off)
 * @param {Array}         [opts.episodes=[]]   - Same-quality episode list for in-player nav
 *                        Each item: { fileId, url, title, quality }
 */
async function launchNativePlayer(opts = {}) {
  return DbWorldPlayer.launch({
    url:            opts.url            ?? '',
    title:          opts.title          ?? '',
    fileName:       opts.fileName       ?? '',
    fileId:         opts.fileId         ?? opts.url ?? '',
    preferredAudio: opts.preferredAudio ?? 'Hindi',
    preferredSub:   opts.preferredSub   ?? null,
    episodesJson:   opts.episodes?.length ? JSON.stringify(opts.episodes) : '[]',
  });
}

export default {
  DbWorldPlayer,
  DbWorldDownload,
  launchNativePlayer,

  // Backward compatibility
  MyMedia3Player: {
    launch: (url, fileName) => launchNativePlayer({ url, fileName }),
  },
};
