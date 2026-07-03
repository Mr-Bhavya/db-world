import { create } from 'zustand';

export const useRecordStore = create((set) => ({
  viewMode:    'table',
  setViewMode: (v) => set({ viewMode: v }),

  filters: { name: '', type: '', year: '', tmdbId: '', recordId: '', status: '' },
  setFilter:    (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () => set({ filters: { name: '', type: '', year: '', tmdbId: '', recordId: '', status: '' } }),

  pageSize:    25,
  setPageSize: (s) => set({ pageSize: s }),

  sortModel:    [{ field: 'recordId', sort: 'desc' }],
  setSortModel: (v) => set({ sortModel: v }),

  selectedRows:    [],
  setSelectedRows: (v) => set({ selectedRows: v }),
  clearSelection:  () => set({ selectedRows: [] }),

  modalState:     null,
  editRecordId:   null,
  openModal:      (type, id = null) => set({ modalState: type, editRecordId: id }),
  closeModal:     () => set({ modalState: null, editRecordId: null }),

  // Unified detail drawer — tabs: overview | tmdb | files | sync.
  // Replaces the former separate TMDB / record-detail / media-files modals.
  drawerRecordId: null,
  drawerTab:      'overview',
  openDrawer:     (id, tab = 'overview') => set({ drawerRecordId: id, drawerTab: tab }),
  setDrawerTab:   (tab) => set({ drawerTab: tab }),
  closeDrawer:    () => set({ drawerRecordId: null }),

  // Back-compat openers — route into the drawer's tabs so existing call sites work.
  openRecordDetail: (id)  => set({ drawerRecordId: id, drawerTab: 'overview' }),
  openTmdbModal:    (rec) => set({ drawerRecordId: rec?.recordId ?? rec, drawerTab: 'tmdb' }),
  openMediaFiles:   (id)  => set({ drawerRecordId: id, drawerTab: 'files' }),
}));
