import { create } from 'zustand';

export const useRecordStore = create((set) => ({
  viewMode:    'table',
  setViewMode: (v) => set({ viewMode: v }),

  filters: { name: '', type: '', year: '', tmdbId: '', recordId: '' },
  setFilter:    (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () => set({ filters: { name: '', type: '', year: '', tmdbId: '', recordId: '' } }),

  pageSize:    25,
  setPageSize: (s) => set({ pageSize: s }),

  sortModel:    [],
  setSortModel: (v) => set({ sortModel: v }),

  selectedRows:    [],
  setSelectedRows: (v) => set({ selectedRows: v }),
  clearSelection:  () => set({ selectedRows: [] }),

  drawerRecordId: null,
  modalState:     null,
  editRecordId:   null,
  openDrawer:     (id) => set({ drawerRecordId: id }),
  closeDrawer:    () => set({ drawerRecordId: null }),
  openModal:      (type, id = null) => set({ modalState: type, editRecordId: id }),
  closeModal:     () => set({ modalState: null, editRecordId: null }),

  // TMDB data modal — opened by clicking TMDB ID in table
  tmdbModalRecord: null,
  openTmdbModal:   (record) => set({ tmdbModalRecord: record }),
  closeTmdbModal:  () => set({ tmdbModalRecord: null }),

  // Full record detail modal — opened by clicking record ID
  recordDetailId: null,
  openRecordDetail:  (id) => set({ recordDetailId: id }),
  closeRecordDetail: () => set({ recordDetailId: null }),

  // Media files modal — opened by clicking Files column
  mediaFilesRecordId: null,
  openMediaFiles:  (id) => set({ mediaFilesRecordId: id }),
  closeMediaFiles: () => set({ mediaFilesRecordId: null }),
}));
