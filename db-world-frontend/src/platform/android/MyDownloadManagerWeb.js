import { WebPlugin } from '@capacitor/core';

class MyDownloadManagerWeb extends WebPlugin {
  constructor() {
    super();
    this.downloads = [];
  }

  async ensurePermissions() {
    return {
      granted: true,
      permissions: {
        notifications: 'granted',
        storage: 'granted',
      },
    };
  }

  async startDownload(options) {
    const { url, fileName } = options;
    if (!url) {
      throw new Error("URL is required");
    }
    
    // For web, simulate a download by creating an anchor element and clicking it.
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName; // This sets the file name for download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const download = {
      downloadId: String(Date.now()),
      fileName: fileName || 'download',
      title: options?.title || fileName || 'Download',
      status: 'success',
      progress: 100,
      bytesDownloaded: 0,
      bytesTotal: 0,
      localUri: url,
      playableUri: url,
      mimeType: '',
      canPlay: true,
      updatedAt: Date.now(),
    };
    this.downloads = [download, ...this.downloads];

    return { downloadId: download.downloadId };
  }

  async listDownloads() {
    return { downloads: this.downloads };
  }

  async pauseDownload() {}

  async resumeDownload() {}

  async cancelDownload({ downloadId }) {
    this.downloads = this.downloads.filter((item) => item.downloadId !== downloadId);
  }

  async deleteDownload({ downloadId }) {
    this.downloads = this.downloads.filter((item) => item.downloadId !== downloadId);
  }

  async openDownloadedFile({ localUri, playableUri }) {
    const target = playableUri || localUri;
    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  }
}

export default MyDownloadManagerWeb;
