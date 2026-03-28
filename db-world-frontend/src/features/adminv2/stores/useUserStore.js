import { create } from 'zustand';

export const useUserStore = create((set) => ({
  viewMode:     'table',
  setViewMode:  (v) => set({ viewMode: v }),

  searchTerm:    '',
  roleFilter:    'ALL',
  sortModel:     [],
  setSearchTerm: (v) => set({ searchTerm: v }),
  setRoleFilter: (v) => set({ roleFilter: v }),
  setSortModel:  (v) => set({ sortModel: v }),

  selectedRows:     [],
  setSelectedRows:  (v) => set({ selectedRows: v }),
  clearSelection:   () => set({ selectedRows: [] }),

  drawerUserId:   null,
  modalState:     null,
  editUserId:     null,
  openDrawer:     (id) => set({ drawerUserId: id }),
  closeDrawer:    () => set({ drawerUserId: null }),
  openModal:      (type, userId = null) => set({ modalState: type, editUserId: userId }),
  closeModal:     () => set({ modalState: null, editUserId: null }),
}));
