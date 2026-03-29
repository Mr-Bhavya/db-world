import { create } from 'zustand';

export const useRecordStore = create((set) => ({
  viewMode:    'table',
  setViewMode: (v) => set({ viewMode: v }),

  filters: {
    name:     '',
    type:     '',
    year:     '',
    tmdbId:   '',
    recordId: '',
  },
  setFilter:    (key, value) => set(s => ({ filters: { ...s.filters, [key]: value }, page: 0 })),
  clearFilters: () => set({ filters: { name:'', type:'', year:'', tmdbId:'', recordId:'' }, page: 0 }),

  page:        0,
  pageSize:    25,
  setPage:     (p) => set({ page: p }),
  setPageSize: (s) => set({ pageSize: s, page: 0 }),

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
}));
