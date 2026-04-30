import { create } from 'zustand';

/**
 * Zustand store for the ingestion pipeline page.
 *
 * jobs     — live job map from WebSocket: { [jobId]: JobSnapshot }
 * wsStatus — 'connecting' | 'connected' | 'disconnected' | 'error'
 */
const useIngestionStore = create((set) => ({
  // ── WebSocket / live jobs ──────────────────────────────────────────────────
  jobs: {},
  wsStatus: 'disconnected',
  lastUpdated: null,

  setJobs: (jobsMap) =>
    set({ jobs: jobsMap, lastUpdated: Date.now() }),

  setWsStatus: (wsStatus) => set({ wsStatus }),

  // ── Active tab ────────────────────────────────────────────────────────────
  activeTab: 0,
  setActiveTab: (activeTab) => set({ activeTab }),

  // ── Form visibility ──────────────────────────────────────────────────────
  formOpen: false,
  setFormOpen: (formOpen) => set({ formOpen }),
}));

export default useIngestionStore;
