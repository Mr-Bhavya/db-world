import { registerPlugin } from '@capacitor/core';
import MyDownloadManagerWeb from './MyDownloadManagerWeb';

/** Native Android video player (VideoPlayerActivity / ExoPlayer Media3) */
const DbWorldPlayer = registerPlugin('DbWorldPlayer');

/** File download manager */
const DbWorldDownload = registerPlugin('DbWorldDownload', {
  web: () => new MyDownloadManagerWeb(),
});

/**
 * Launch the native Android player.
 *
 * @param {object} opts
 * @param {string}      opts.url             - Stream URL
 * @param {string}      [opts.title]         - Show/movie title
 * @param {string}      [opts.fileName]      - File name for display
 * @param {string}      [opts.fileId]        - Unique ID used as resume key
 * @param {string}      [opts.preferredAudio='Hindi'] - Preferred audio language
 * @param {string|null} [opts.preferredSub=null]      - Preferred subtitle (null = off)
 */
async function launchNativePlayer(opts = {}) {
  return DbWorldPlayer.launch({
    url:            opts.url            ?? '',
    title:          opts.title          ?? '',
    fileName:       opts.fileName       ?? '',
    fileId:         opts.fileId         ?? opts.url ?? '',
    preferredAudio: opts.preferredAudio ?? 'Hindi',
    preferredSub:   opts.preferredSub   ?? null,
  });
}

export default {
  DbWorldPlayer,
  DbWorldDownload,
  launchNativePlayer,

  // Backward compatibility — old calls used MyMedia3Player(url, fileName)
  MyMedia3Player: {
    launch: (url, fileName) => launchNativePlayer({ url, fileName }),
  },
};
