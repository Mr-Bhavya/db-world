import { WebPlugin } from '@capacitor/core';
import api from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

const STORAGE_KEY = 'dbworld_web_downloads';

function loadStored() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persist(list) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

class MyDownloadManagerWeb extends WebPlugin {
  constructor() {
    super();
    this.downloads = loadStored().map((item) => item.status === 'success' && !item.bytesTotal
      ? { ...item, status: 'acknowledged', canPlay: false } : item);
  }

  async ensurePermissions() {
    return {};
  }

  async startDownload(options) {
    const { url, fileName } = options;
    if (!url) throw new Error('URL is required');
    const download = {
      downloadId:      crypto.randomUUID(),
      fileName:        fileName || 'download',
      title:           options?.title || fileName || 'Download',
      status:          'pending',
      progress:        0,
      bytesDownloaded: 0,
      bytesTotal:      0,
      url,
      localUri:        '',
      playableUri:     '',
      mimeType:        '',
      canPlay:         false,
      source:          options.source || 'cinema',
      jobId:           options.jobId || '',
      thumbnailUrl:    options.thumbnailUrl || '',
      addedAt:         Date.now(),
    };
    this.downloads = [download, ...this.downloads];
    persist(this.downloads);
    this.notifyListeners('downloadAdded', download);
    await this.dispatch();
    return { downloadId: download.downloadId };
  }

  async dispatch() {
    if (this.dispatching || this.downloads.some((item) => item.status === 'handed_off')) return;
    this.dispatching = true;
    try {
      let next;
      while ((next = [...this.downloads].reverse().find((item) => item.status === 'pending'))) {
        try {
          let url = next.url;
          if (next.jobId) {
            const { data } = await api.post('/api/downloader/tickets', { ids: [next.jobId], name: next.fileName });
            url = `${getApiBaseUrl()}${data.url}`;
          }
          const link = document.createElement('a');
          link.href = url;
          link.download = next.fileName;
          link.referrerPolicy = 'no-referrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          next.status = 'handed_off';
          this.notifyListeners('downloadStateChanged', next);
          break;
        } catch (error) {
          next.status = 'failed';
          next.errorMessage = error?.response?.data?.message || 'The browser could not start this download. Retry from the ready file.';
          this.notifyListeners('downloadError', next);
        }
      }
    } finally { this.dispatching = false; persist(this.downloads); }
  }

  async completeBrowserDownload({ downloadId }) {
    const item = this.downloads.find((entry) => entry.downloadId === downloadId);
    if (item?.status === 'handed_off') {
      item.status = 'acknowledged';
      persist(this.downloads);
      this.notifyListeners('downloadStateChanged', item);
      await this.dispatch();
    }
  }

  async listDownloads() {
    return { downloads: this.downloads };
  }

  async pauseDownload()  {}
  async resumeDownload() {}
  async retryDownload({ downloadId }) {
    const item = this.downloads.find((entry) => entry.downloadId === downloadId);
    if (item && ['failed', 'cancelled'].includes(item.status)) {
      item.status = 'pending';
      item.errorMessage = '';
      persist(this.downloads);
      await this.dispatch();
    }
    return { downloadId };
  }
  async setNetworkPolicy() {}
  async getSettings() { return { wifiOnly: false, concurrentLimit: 1, maxConcurrentLimit: 1 }; }
  async setConcurrentLimit() { return { concurrentLimit: 1 }; }
  async consumePendingRoute() { return { route: '' }; }

  async cancelDownload({ downloadId }) {
    const item = this.downloads.find((entry) => entry.downloadId === downloadId);
    if (item?.status === 'handed_off') throw new Error('Stop this download in the browser, then close its transfer entry.');
    if (item) item.status = 'cancelled';
    persist(this.downloads);
    await this.dispatch();
  }

  async deleteDownload({ downloadId }) {
    this.downloads = this.downloads.filter(d => d.downloadId !== downloadId);
    persist(this.downloads);
    await this.dispatch();
  }

  async openDownloadedFile({ localUri, playableUri }) {
    const target = playableUri || localUri;
    if (target) window.open(target, '_blank', 'noopener,noreferrer');
  }

  // Wallet direct-save surface (native-only in practice; web callers use an anchor download).
  async saveDocument({ fileName, mimeType }) {
    return { uri: '', mimeType: mimeType || '', fileName: fileName || 'document' };
  }

  async openFile({ uri }) {
    if (uri) window.open(uri, '_blank', 'noopener,noreferrer');
  }
}

export default MyDownloadManagerWeb;
