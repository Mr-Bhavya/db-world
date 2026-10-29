import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '@shared/components/ui/utils/AxiosInstants';
import { errorMessage, inspectMedia } from './downloaderApi';

vi.mock('@shared/components/ui/utils/AxiosInstants', () => ({ default: { post: vi.fn() } }));
vi.mock('@platform/android/DbWorldDownload', () => ({ default: {} }));
vi.mock('@shared/config/apiBaseUrl', () => ({ getApiBaseUrl: () => 'https://api.example.com' }));

afterEach(() => vi.clearAllMocks());

describe('media inspection requests', () => {
  it('passes a cancellation signal and a bounded request timeout', async () => {
    const controller = new AbortController();
    api.post.mockResolvedValue({ data: { title: 'Video' } });
    expect(await inspectMedia('https://example.com/video', false, controller.signal)).toEqual({ title: 'Video' });
    expect(api.post).toHaveBeenCalledWith('/api/downloader/inspect', { url: 'https://example.com/video', playlist: false }, { timeout: 90000, signal: controller.signal });
  });

  it('preserves the server failure reason rather than replacing it with a generic status', () => {
    expect(errorMessage({ response: { status: 504, data: { message: 'Inspection exceeded 75 seconds.' } } })).toBe('Inspection exceeded 75 seconds.');
  });
});