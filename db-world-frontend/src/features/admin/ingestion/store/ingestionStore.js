import { create } from 'zustand';
import { mergeJobs } from './mergeJobs';

/**
 * Zustand store for the ingestion pipeline page.
 *
 * jobs        — live job map from WebSocket: { [jobId]: JobSnapshot } (structurally shared)
 * wsStatus    — 'connecting' | 'connected' | 'disconnected' | 'error'
 * lastUpdated — null until the first snapshot arrives (drives the loading skeleton)
 */
const useIngestionStore = create((set) => ({
  // ── WebSocket / live jobs ──────────────────────────────────────────────────
  jobs: {},
  wsStatus: 'disconnected',
  lastUpdated: null,

  setJobs: (jobsMap) =>
    set((s) => ({ jobs: mergeJobs(s.jobs, jobsMap), lastUpdated: Date.now() })),

  setWsStatus: (wsStatus) => set({ wsStatus }),

  // ── Active tab ────────────────────────────────────────────────────────────
  activeTab: 0,
  setActiveTab: (activeTab) => set({ activeTab }),

  // ── Form visibility ──────────────────────────────────────────────────────
  formOpen: false,
  setFormOpen: (formOpen) => set({ formOpen }),

  // ── Record prefill ─────────────────────────────────────────────────────────
  // Set by a record's "Add media files" button, consumed once by the New Job form to pre-select
  // the record (so you can attach media to a DRAFT record that the search can't otherwise reach).
  prefillRecord: null,
  setPrefillRecord: (prefillRecord) => set({ prefillRecord }),
  clearPrefillRecord: () => set({ prefillRecord: null }),
}));

export default useIngestionStore;
