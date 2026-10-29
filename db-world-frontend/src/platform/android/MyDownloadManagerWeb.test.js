import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import MyDownloadManagerWeb from './MyDownloadManagerWeb';

vi.mock('@shared/components/ui/utils/AxiosInstants', () => ({ default: { post: vi.fn(async () => ({ data: { url: '/api/downloader/transfers/test' } })) } }));
vi.mock('@shared/config/apiBaseUrl', () => ({ getApiBaseUrl: () => 'https://api.example.com' }));

describe('shared browser download queue', () => {
  let clicked;
  beforeEach(() => {
    clicked = [];
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal('document', {
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      createElement: () => { const link = { click: () => clicked.push(link.href) }; return link; },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts one handoff and keeps other sources queued until it is closed', async () => {
    const manager = new MyDownloadManagerWeb();
    const first = await manager.startDownload({ url: 'https://cdn.example.com/cinema.mp4', source: 'cinema' });
    await manager.startDownload({ url: 'https://api.example.com/media.mp4', source: 'downloader' });
    expect(clicked).toHaveLength(1);
    expect((await manager.listDownloads()).downloads.map((item) => item.status)).toEqual(['pending', 'handed_off']);
    await manager.completeBrowserDownload(first);
    expect(clicked).toHaveLength(2);
    expect((await manager.listDownloads()).downloads.map((item) => item.status)).toEqual(['handed_off', 'acknowledged']);
  });

  it('does not claim a browser transfer succeeded or can be played locally', async () => {
    const manager = new MyDownloadManagerWeb();
    await manager.startDownload({ url: 'https://cdn.example.com/video.mp4' });
    const [item] = (await manager.listDownloads()).downloads;
    expect(item.status).toBe('handed_off');
    expect(item.progress).toBe(0);
    expect(item.canPlay).toBe(false);
    expect(item.localUri).toBe('');
  });

  it('does not pretend to cancel a transfer owned by the browser', async () => {
    const manager = new MyDownloadManagerWeb();
    const first = await manager.startDownload({ url: 'https://cdn.example.com/video.mp4' });
    await expect(manager.cancelDownload(first)).rejects.toThrow('browser');
    expect((await manager.getSettings()).maxConcurrentLimit).toBe(1);
    expect((await manager.setConcurrentLimit({ limit: 3 })).concurrentLimit).toBe(1);
  });

  it('cancels a queued item without starting it', async () => {
    const manager = new MyDownloadManagerWeb();
    const first = await manager.startDownload({ url: 'https://cdn.example.com/one.mp4' });
    const second = await manager.startDownload({ url: 'https://cdn.example.com/two.mp4' });
    await manager.cancelDownload(second);
    await manager.completeBrowserDownload(first);
    expect(clicked).toHaveLength(1);
    expect((await manager.listDownloads()).downloads[0].status).toBe('cancelled');
  });
});