import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import * as fmApi from '../api/fileManagerApi';
import { useUploadStore } from '../store/useUploadStore';
import { useInvalidateFm } from '../hooks/useInvalidateFm';
import { createUpload } from './resumableUploader';

/**
 * Module-scope registry of live upload handles, keyed by upload id. Kept
 * outside React state (rather than in the hook's closure or the Zustand
 * store) so `pause`/`resume`/`cancel`/`retry` always reach the actual
 * `createUpload()` handle — including the original `file`/`locationId`/`path`
 * a `retry` needs to re-create the upload from scratch — regardless of how
 * many times components re-render.
 */
const registry = new Map(); // id -> { handle, file, locationId, path }

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `up-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Drives one or more `resumableUploader` uploads and keeps `useUploadStore`
 * in sync. `UploadTray.jsx` is purely presentational — this hook (used by
 * `index.jsx`) supplies the actual pause/resume/cancel/retry behavior.
 */
export function useUploadManager() {
  const addUpload = useUploadStore((s) => s.addUpload);
  const updateUpload = useUploadStore((s) => s.updateUpload);
  const removeUpload = useUploadStore((s) => s.removeUpload);
  const { invalidateDir } = useInvalidateFm();
  const { enqueueSnackbar } = useSnackbar();

  const beginOne = useCallback((id, file, locationId, path) => {
    addUpload(id, { name: file.name, total: file.size, sent: 0, status: 'uploading' });

    const handle = createUpload({
      file,
      locationId,
      path,
      api: fmApi,
      onProgress: ({ sent, speed, etaSec }) => updateUpload(id, { sent, speed, etaSec }),
      onDone: (fileItem) => {
        updateUpload(id, { status: 'done', sent: file.size });
        invalidateDir(locationId);
        enqueueSnackbar(`${fileItem?.name ?? file.name} uploaded`, { variant: 'success' });
      },
      onError: (err) => updateUpload(id, { status: 'error', error: String(err) }),
    });

    registry.set(id, { handle, file, locationId, path });
  }, [addUpload, updateUpload, invalidateDir, enqueueSnackbar]);

  /** Starts one resumable upload per File in `fileList`, opening the tray (via `addUpload`). */
  const startUploads = useCallback((fileList, { locationId, path = '/' } = {}) => {
    Array.from(fileList ?? []).forEach((file) => {
      beginOne(genId(), file, locationId, path);
    });
  }, [beginOne]);

  const pause = useCallback((id) => {
    registry.get(id)?.handle.pause();
    updateUpload(id, { status: 'paused' });
  }, [updateUpload]);

  const resume = useCallback((id) => {
    registry.get(id)?.handle.resume();
    updateUpload(id, { status: 'uploading' });
  }, [updateUpload]);

  /** Cancels the in-flight transfer (aborting the request + the server-side session) and drops the row entirely. */
  const cancel = useCallback((id) => {
    const entry = registry.get(id);
    if (!entry) return;
    entry.handle.cancel();
    registry.delete(id);
    removeUpload(id);
  }, [removeUpload]);

  /** Re-creates the upload from scratch (a fresh `initUpload`) using the same file/target the failed attempt used. */
  const retry = useCallback((id) => {
    const entry = registry.get(id);
    if (!entry) return;
    beginOne(id, entry.file, entry.locationId, entry.path);
  }, [beginOne]);

  return { startUploads, pause, resume, cancel, retry };
}
