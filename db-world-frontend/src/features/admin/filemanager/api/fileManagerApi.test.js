import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/components/ui/utils/AxiosInstants', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@shared/config/apiBaseUrl', () => ({
  getApiBaseUrl: () => 'https://api.test',
}));

import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import {
  listDirectory,
  searchFiles,
  getFileInfo,
  mkdir,
  renameItem,
  moveItem,
  copyItem,
  deleteItem,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  initUpload,
  uploadChunk,
  uploadStatus,
  completeUpload,
  abortUpload,
  downloadTicketUrl,
  thumbnailUrl,
  fetchThumbnailBlob,
  fetchTextPreview,
} from './fileManagerApi';

const BASE = '/api/admin/file-manager';

describe('fileManagerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listDirectory calls GET /list with params incl locationId and unwraps the envelope', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: { currentPath: '/', items: [] } } });

    const result = await listDirectory({ locationId: 'loc1', path: '/docs', sortBy: 'name', order: 'asc' });

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/list`, {
      params: { locationId: 'loc1', path: '/docs', sortBy: 'name', order: 'asc' },
    });
    expect(result).toEqual({ currentPath: '/', items: [] });
  });

  it('listDirectory defaults path/sortBy/order when omitted', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: {} } });

    await listDirectory({ locationId: 'loc1' });

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/list`, {
      params: { locationId: 'loc1', path: '/', sortBy: 'name', order: 'asc' },
    });
  });

  it('searchFiles calls GET /search with q/path/recursive', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: [] } });

    await searchFiles({ locationId: 'loc1', q: 'report', path: '/docs', recursive: false });

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/search`, {
      params: { locationId: 'loc1', q: 'report', path: '/docs', recursive: false },
    });
  });

  it('getFileInfo calls GET /info', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: { name: 'a.txt' } } });

    const result = await getFileInfo({ locationId: 'loc1', path: '/a.txt' });

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/info`, {
      params: { locationId: 'loc1', path: '/a.txt' },
    });
    expect(result).toEqual({ name: 'a.txt' });
  });

  it('mkdir posts locationId/path/name', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { data: { name: 'docs' } } });

    await mkdir({ locationId: 'loc1', path: '/', name: 'docs' });

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/mkdir`, { locationId: 'loc1', path: '/', name: 'docs' });
  });

  it('renameItem posts locationId/path/newName', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { data: {} } });

    await renameItem({ locationId: 'loc1', path: '/a.txt', newName: 'b.txt' });

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/rename`, {
      locationId: 'loc1', path: '/a.txt', newName: 'b.txt',
    });
  });

  it('moveItem posts locationId/sourcePath/destinationPath', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { data: {} } });

    await moveItem({ locationId: 'loc1', sourcePath: '/a.txt', destinationPath: '/dir' });

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/move`, {
      locationId: 'loc1', sourcePath: '/a.txt', destinationPath: '/dir',
    });
  });

  it('copyItem posts locationId/sourcePath/destinationPath', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { data: {} } });

    await copyItem({ locationId: 'loc1', sourcePath: '/a.txt', destinationPath: '/dir' });

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/copy`, {
      locationId: 'loc1', sourcePath: '/a.txt', destinationPath: '/dir',
    });
  });

  it('deleteItem sends DELETE with locationId/path params', async () => {
    axiosInstance.delete.mockResolvedValueOnce({ data: { data: null } });

    await deleteItem({ locationId: 'loc1', path: '/a.txt' });

    expect(axiosInstance.delete).toHaveBeenCalledWith(`${BASE}/delete`, {
      params: { locationId: 'loc1', path: '/a.txt' },
    });
  });

  it('listLocations calls GET /locations', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: [{ id: 'l1' }] } });

    const result = await listLocations();

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/locations`);
    expect(result).toEqual([{ id: 'l1' }]);
  });

  it('createLocation posts the body', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { data: { id: 'l2' } } });

    await createLocation({ label: 'Data', absolutePath: '/srv/data' });

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/locations`, { label: 'Data', absolutePath: '/srv/data' });
  });

  it('updateLocation puts to /locations/{id}', async () => {
    axiosInstance.put.mockResolvedValueOnce({ data: { data: { id: 'l2' } } });

    await updateLocation('l2', { label: 'Renamed' });

    expect(axiosInstance.put).toHaveBeenCalledWith(`${BASE}/locations/l2`, { label: 'Renamed' });
  });

  it('deleteLocation sends DELETE to /locations/{id}', async () => {
    axiosInstance.delete.mockResolvedValueOnce({ data: { data: null } });

    await deleteLocation('l2');

    expect(axiosInstance.delete).toHaveBeenCalledWith(`${BASE}/locations/l2`);
  });

  it('initUpload posts the init body', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { data: { uploadId: 'u1' } } });

    const body = { locationId: 'l1', path: '/', fileName: 'big.bin', totalSize: 20 };
    const result = await initUpload(body);

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/uploads/init`, body);
    expect(result).toEqual({ uploadId: 'u1' });
  });

  it('uploadChunk PUTs octet-stream to /uploads/{id}/chunk?index=N', async () => {
    axiosInstance.put.mockResolvedValueOnce({ data: { data: { uploadId: 'u1', nextIndex: 1 } } });
    const blob = { size: 4 };
    const onProgress = vi.fn();
    const signal = {};

    const result = await uploadChunk('u1', 0, blob, { onProgress, signal });

    expect(axiosInstance.put).toHaveBeenCalledWith(`${BASE}/uploads/u1/chunk`, blob, {
      headers: { 'Content-Type': 'application/octet-stream' },
      params: { index: 0 },
      onUploadProgress: onProgress,
      signal,
    });
    expect(result).toEqual({ uploadId: 'u1', nextIndex: 1 });
  });

  it('uploadStatus GETs /uploads/{id}', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: { status: 'PENDING' } } });

    const result = await uploadStatus('u1');

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/uploads/u1`);
    expect(result).toEqual({ status: 'PENDING' });
  });

  it('completeUpload posts to /uploads/{id}/complete', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { data: { name: 'big.bin' } } });

    const result = await completeUpload('u1');

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/uploads/u1/complete`);
    expect(result).toEqual({ name: 'big.bin' });
  });

  it('abortUpload sends DELETE to /uploads/{id}', async () => {
    axiosInstance.delete.mockResolvedValueOnce({ data: { data: null } });

    await abortUpload('u1');

    expect(axiosInstance.delete).toHaveBeenCalledWith(`${BASE}/uploads/u1`);
  });

  it('downloadTicketUrl posts for a ticket then builds the absolute stream URL', async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { data: { ticketId: 'tick 1' } } });

    const url = await downloadTicketUrl({ locationId: 'l1', path: '/a b.txt' });

    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/download-ticket`, null, {
      params: { locationId: 'l1', path: '/a b.txt' },
    });
    expect(url).toBe(`https://api.test${BASE}/download/stream?ticket=${encodeURIComponent('tick 1')}`);
  });

  it('thumbnailUrl builds an encoded absolute URL without a network call', () => {
    const url = thumbnailUrl({ locationId: 'l1', path: '/a b.jpg' });

    expect(url).toBe(
      `https://api.test${BASE}/thumbnail?locationId=${encodeURIComponent('l1')}&path=${encodeURIComponent('/a b.jpg')}`
    );
    expect(axiosInstance.get).not.toHaveBeenCalled();
  });

  it('fetchThumbnailBlob GETs /thumbnail as a blob', async () => {
    const blob = new Blob(['x']);
    axiosInstance.get.mockResolvedValueOnce({ data: blob });

    const result = await fetchThumbnailBlob({ locationId: 'l1', path: '/a.jpg' });

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/thumbnail`, {
      params: { locationId: 'l1', path: '/a.jpg' },
      responseType: 'blob',
    });
    expect(result).toBe(blob);
  });

  it('fetchTextPreview calls GET /preview/text', async () => {
    axiosInstance.get.mockResolvedValueOnce({ data: { data: { content: 'hi', truncated: false } } });

    const result = await fetchTextPreview({ locationId: 'l1', path: '/a.txt' });

    expect(axiosInstance.get).toHaveBeenCalledWith(`${BASE}/preview/text`, {
      params: { locationId: 'l1', path: '/a.txt' },
    });
    expect(result).toEqual({ content: 'hi', truncated: false });
  });
});
