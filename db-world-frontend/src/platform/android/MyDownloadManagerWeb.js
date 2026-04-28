import { WebPlugin } from '@capacitor/core';

const STORAGE_KEY = 'dbworld_web_downloads';

function loadStored() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persist(list) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

class MyDownloadManagerWeb extends WebPlugin {
  constructor() {
    super();
    this.downloads = loadStored();
  }

  async startDownload(options) {
    const { url, fileName } = options;
    if (!url) throw new Error('URL is required');

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const download = {
      downloadId:      String(Date.now()),
      fileName:        fileName || 'download',
      title:           options?.title || fileName || 'Download',
      status:          'success',
      progress:        100,
      bytesDownloaded: 0,
      bytesTotal:      0,
      localUri:        url,
      playableUri:     url,
      mimeType:        '',
      canPlay:         true,
      addedAt:         Date.now(),
    };
    this.downloads = [download, ...this.downloads];
    persist(this.downloads);
    return { downloadId: download.downloadId };
  }

  async listDownloads() {
    return { downloads: this.downloads };
  }

  async pauseDownload()  {}
  async resumeDownload() {}

  async cancelDownload({ downloadId }) {
    this.downloads = this.downloads.filter(d => d.downloadId !== downloadId);
    persist(this.downloads);
  }

  async deleteDownload({ downloadId }) {
    this.downloads = this.downloads.filter(d => d.downloadId !== downloadId);
    persist(this.downloads);
  }

  async openDownloadedFile({ localUri, playableUri }) {
    const target = playableUri || localUri;
    if (target) window.open(target, '_blank', 'noopener,noreferrer');
  }
}

export default MyDownloadManagerWeb;
