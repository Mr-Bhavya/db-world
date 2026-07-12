import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createUpload } from './resumableUploader';

/** Fake file-like object supporting the subset of the File API we use. */
function makeFakeFile({ name = 'test.bin', size } = {}) {
  return {
    name,
    size,
    slice(start, end) {
      return { size: Math.min(end, size) - start };
    },
  };
}

function makeApi(overrides = {}) {
  return {
    initUpload: vi.fn(async (body) => ({
      uploadId: 'u1',
      totalSize: body.totalSize,
      chunkSize: body.chunkSize,
      receivedBytes: 0,
      nextIndex: 0,
      status: 'PENDING',
    })),
    uploadChunk: vi.fn(async () => ({})),
    uploadStatus: vi.fn(async () => ({ uploadId: 'u1', receivedBytes: 0, nextIndex: 0 })),
    completeUpload: vi.fn(async () => ({ name: 'test.bin', path: '/test.bin' })),
    abortUpload: vi.fn(async () => ({})),
    ...overrides,
  };
}

describe('resumableUploader', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a failing chunk (3x, exponential backoff) and completes on eventual success', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const api = makeApi({
      uploadChunk: vi.fn(async () => {
        attempts += 1;
        if (attempts <= 2) throw new Error('transient network error');
        return {};
      }),
    });
    const file = makeFakeFile({ size: 10 });
    const onDone = vi.fn();
    const onError = vi.fn();

    const upload = createUpload({
      file, locationId: 'l1', path: '/', chunkSize: 10, api, onDone, onError,
    });

    await vi.runAllTimersAsync();
    const result = await upload.promise;

    expect(result).toEqual({ name: 'test.bin', path: '/test.bin' });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ name: 'test.bin', path: '/test.bin' });
    expect(onError).not.toHaveBeenCalled();
    expect(api.uploadChunk).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    expect(api.initUpload).toHaveBeenCalledTimes(1);
    expect(api.completeUpload).toHaveBeenCalledTimes(1);
    expect(api.completeUpload).toHaveBeenCalledWith('u1');
  });

  it('gives up after 3 retries and calls onError without completing', async () => {
    vi.useFakeTimers();
    const api = makeApi({
      uploadChunk: vi.fn(async () => { throw new Error('boom'); }),
    });
    const file = makeFakeFile({ size: 10 });
    const onDone = vi.fn();
    const onError = vi.fn();

    const upload = createUpload({
      file, locationId: 'l1', path: '/', chunkSize: 10, api, onDone, onError,
    });

    const assertion = expect(upload.promise).rejects.toThrow('boom');
    await vi.runAllTimersAsync();
    await assertion;

    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('boom');
    // 1 initial attempt + 3 retries = 4 calls for the same chunk index
    expect(api.uploadChunk).toHaveBeenCalledTimes(4);
    expect(api.completeUpload).not.toHaveBeenCalled();
  });

  it('splits the file into ceil(total/chunkSize) chunks and calls initUpload once', async () => {
    const api = makeApi();
    const file = makeFakeFile({ size: 25 }); // chunkSize 10 -> chunks of 10, 10, 5

    const upload = createUpload({ file, locationId: 'l1', path: '/', chunkSize: 10, api });
    await upload.promise;

    expect(api.initUpload).toHaveBeenCalledTimes(1);
    expect(api.uploadChunk).toHaveBeenCalledTimes(3);
    // chunks uploaded strictly in index order
    expect(api.uploadChunk.mock.calls.map((c) => c[1])).toEqual([0, 1, 2]);
  });

  it('reports progress with sent/total as chunks complete', async () => {
    const api = makeApi();
    const file = makeFakeFile({ size: 20 });
    const onProgress = vi.fn();

    const upload = createUpload({ file, locationId: 'l1', path: '/', chunkSize: 10, api, onProgress });
    await upload.promise;

    expect(onProgress).toHaveBeenCalled();
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastCall.sent).toBe(20);
    expect(lastCall.total).toBe(20);
  });

  it('cancel() aborts and calls api.abortUpload with the upload id', async () => {
    let resolveChunk;
    const api = makeApi({
      uploadChunk: vi.fn(() => new Promise((resolve) => { resolveChunk = resolve; })),
    });
    const file = makeFakeFile({ size: 20 });
    const onDone = vi.fn();
    const onError = vi.fn();

    const upload = createUpload({ file, locationId: 'l1', path: '/', chunkSize: 10, api, onDone, onError });

    // let init resolve and the first chunk request start
    await Promise.resolve();
    await Promise.resolve();

    upload.cancel();
    resolveChunk({}); // release the in-flight chunk so the loop can observe cancellation

    await expect(upload.promise).rejects.toThrow();
    expect(api.abortUpload).toHaveBeenCalledWith('u1');
    expect(onDone).not.toHaveBeenCalled();
  });
});
