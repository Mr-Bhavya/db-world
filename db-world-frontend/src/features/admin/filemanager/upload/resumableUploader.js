const DEFAULT_CHUNK_SIZE = 8388608; // 8 MiB — matches backend default
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeCancelledError() {
  const err = new Error('Upload cancelled');
  err.name = 'UploadCancelledError';
  return err;
}

/**
 * Drives a single resumable, chunked upload against the file-manager
 * upload-session API. Chunks are sent SEQUENTIALLY and in index order
 * (the backend enforces strict contiguous chunk order).
 *
 * @returns {{ promise: Promise<object>, pause(): void, resume(): void, cancel(): void }}
 */
export function createUpload({
  file,
  locationId,
  path = '/',
  chunkSize = DEFAULT_CHUNK_SIZE,
  checksum = null,
  onConflict = 'fail',
  api,
  onProgress,
  onDone,
  onError,
}) {
  const controller = new AbortController();
  const totalSize = file.size;
  const startedAt = Date.now();

  let paused = false;
  let cancelled = false;
  let uploadId = null;
  let waiters = [];

  const waitWhilePaused = () => {
    if (!paused) return Promise.resolve();
    return new Promise((resolve) => waiters.push(resolve));
  };

  const releaseWaiters = () => {
    const pending = waiters;
    waiters = [];
    pending.forEach((resolve) => resolve());
  };

  const reportProgress = (sent) => {
    if (!onProgress) return;
    const elapsedSec = Math.max((Date.now() - startedAt) / 1000, 0.001);
    const speed = sent / elapsedSec;
    const remaining = Math.max(totalSize - sent, 0);
    const etaSec = speed > 0 ? remaining / speed : null;
    onProgress({ sent, total: totalSize, speed, etaSec });
  };

  async function uploadChunkWithRetry(index, blob, sentBeforeChunk) {
    let attempt = 0;
    for (;;) {
      if (cancelled) throw makeCancelledError();
      try {
        return await api.uploadChunk(uploadId, index, blob, {
          signal: controller.signal,
          onProgress: (evt) => {
            const loaded = Math.min(evt?.loaded ?? 0, blob.size);
            reportProgress(sentBeforeChunk + loaded);
          },
        });
      } catch (err) {
        if (cancelled) throw makeCancelledError();
        attempt += 1;
        if (attempt > MAX_RETRIES) throw err;
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }
  }

  async function run() {
    const session = await api.initUpload({
      locationId,
      path,
      fileName: file.name,
      totalSize,
      chunkSize,
      checksum,
      onConflict,
    });

    uploadId = session.uploadId;
    const effectiveChunkSize = session.chunkSize || chunkSize;
    const totalChunks = Math.ceil(totalSize / effectiveChunkSize);

    let nextIndex = session.nextIndex ?? 0;
    let sent = typeof session.receivedBytes === 'number' ? session.receivedBytes : nextIndex * effectiveChunkSize;

    for (let index = nextIndex; index < totalChunks; index += 1) {
      if (cancelled) throw makeCancelledError();
      await waitWhilePaused();
      if (cancelled) throw makeCancelledError();

      const start = index * effectiveChunkSize;
      const end = Math.min(start + effectiveChunkSize, totalSize);
      const blob = file.slice(start, end);
      const sentBeforeChunk = sent;

      await uploadChunkWithRetry(index, blob, sentBeforeChunk);

      sent = sentBeforeChunk + blob.size;
      reportProgress(sent);
    }

    return api.completeUpload(uploadId);
  }

  const promise = run().then(
    (fileItem) => {
      onDone?.(fileItem);
      return fileItem;
    },
    (err) => {
      if (!cancelled) onError?.(err);
      throw err;
    }
  );

  return {
    promise,

    pause() {
      paused = true;
    },

    /**
     * Resumes after a pause. Fires a best-effort `api.uploadStatus` refresh
     * (when the api exposes it) purely to surface up-to-date received-bytes
     * for progress reporting — the in-memory chunk cursor already tracks
     * where to continue from, so this never blocks resuming.
     */
    resume() {
      if (!paused) return;
      paused = false;
      if (uploadId && typeof api.uploadStatus === 'function') {
        Promise.resolve(api.uploadStatus(uploadId))
          .then((s) => {
            if (s && typeof s.receivedBytes === 'number') reportProgress(s.receivedBytes);
          })
          .catch(() => {});
      }
      releaseWaiters();
    },

    cancel() {
      if (cancelled) return;
      cancelled = true;
      controller.abort();
      if (uploadId) {
        Promise.resolve(api.abortUpload(uploadId)).catch(() => {});
      }
      releaseWaiters();
    },
  };
}
