import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openDownloadedFile } from './DbWorldDownload';

const bridge = vi.hoisted(() => ({ openFile: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: () => bridge }));
vi.mock('./MyDownloadManagerWeb', () => ({ default: class {} }));

beforeEach(() => vi.clearAllMocks());

describe('saved download file opening', () => {
  it('uses the existing Android openFile method and prefers the saved content URI', async () => {
    bridge.openFile.mockResolvedValue(undefined);
    await openDownloadedFile({ localUri: 'content://media/external/downloads/1', playableUri: 'http://localhost/_capacitor_file_/video.mp4', mimeType: 'video/mp4' });
    expect(bridge.openFile).toHaveBeenCalledWith({ uri: 'content://media/external/downloads/1', mimeType: 'video/mp4' });
  });

  it('falls back to the available URI without requiring a new native plugin method', async () => {
    await openDownloadedFile({ playableUri: 'file:///storage/emulated/0/Download/audio.m4a' });
    expect(bridge.openFile).toHaveBeenCalledWith({ uri: 'file:///storage/emulated/0/Download/audio.m4a', mimeType: '' });
  });

  it('reports a missing saved location without invoking the native bridge', async () => {
    await expect(openDownloadedFile({})).rejects.toThrow('saved file location');
    expect(bridge.openFile).not.toHaveBeenCalled();
  });

  it('preserves Android viewer errors for the download page to display', async () => {
    bridge.openFile.mockRejectedValueOnce(new Error('No application can open this file'));
    await expect(openDownloadedFile({ localUri: 'content://media/1' })).rejects.toThrow('No application can open this file');
  });
});