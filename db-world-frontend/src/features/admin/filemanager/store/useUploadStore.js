import { create } from 'zustand';

/**
 * Registry of in-flight (and recently finished) chunked uploads, keyed by
 * upload id. Populated/driven by `upload/resumableUploader.js` handles that
 * `UploadTray.jsx` renders and controls (pause/resume/cancel/retry).
 */
export const useUploadStore = create((set) => ({
  uploads: {}, // { [id]: { name, total, sent, status, speed, etaSec, error } }
  trayOpen: false,

  addUpload: (id, upload) => set((s) => ({
    uploads: {
      ...s.uploads,
      [id]: {
        name: '',
        total: 0,
        sent: 0,
        status: 'queued', // 'queued' | 'uploading' | 'paused' | 'done' | 'error'
        speed: 0,
        etaSec: null,
        error: null,
        ...upload,
      },
    },
    trayOpen: true,
  })),

  updateUpload: (id, patch) => set((s) => {
    if (!s.uploads[id]) return {};
    return { uploads: { ...s.uploads, [id]: { ...s.uploads[id], ...patch } } };
  }),

  removeUpload: (id) => set((s) => {
    if (!(id in s.uploads)) return {};
    const next = { ...s.uploads };
    delete next[id];
    return { uploads: next };
  }),

  setTrayOpen: (v) => set({ trayOpen: v }),
}));
