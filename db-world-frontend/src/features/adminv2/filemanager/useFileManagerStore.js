import { create } from 'zustand';

export const useFileManagerStore = create((set, get) => ({
  // Navigation
  currentPath: '/',
  navigate:    (path) => set({ currentPath: path, selectedItems: new Set() }),
  navigateUp:  (parentPath) => set({ currentPath: parentPath ?? '/', selectedItems: new Set() }),

  // View
  viewMode:    'list',   // 'list' | 'grid'
  setViewMode: (v) => set({ viewMode: v }),

  // Sort & filter
  sortBy:      'name',   // 'name' | 'size' | 'modified' | 'type'
  sortOrder:   'asc',    // 'asc' | 'desc'
  filterType:  'ALL',    // 'ALL' | 'FILE' | 'FOLDER' | ext string like 'mp4'
  setSortBy:   (v) => set({ sortBy: v }),
  setSortOrder:(v) => set({ sortOrder: v }),
  setFilterType:(v) => set({ filterType: v }),

  // Selection (Set of paths)
  selectedItems:     new Set(),
  toggleSelect:      (path) => set(s => {
    const next = new Set(s.selectedItems);
    next.has(path) ? next.delete(path) : next.add(path);
    return { selectedItems: next };
  }),
  selectAll:         (items) => set({ selectedItems: new Set(items.map(i => i.path)) }),
  clearSelection:    () => set({ selectedItems: new Set() }),

  // Clipboard
  clipboard: null,   // { items: FileItemDto[], operation: 'cut' | 'copy' }
  setClipboard: (items, operation) => set({ clipboard: { items, operation } }),
  clearClipboard: () => set({ clipboard: null }),

  // Dialogs
  uploadOpen:       false,
  setUploadOpen:    (v) => set({ uploadOpen: v }),

  searchOpen:       false,
  setSearchOpen:    (v) => set({ searchOpen: v }),

  operationDialog:  null, // { type: 'rename'|'mkdir'|'move'|'copy', item?: FileItemDto }
  openOperation:    (type, item = null) => set({ operationDialog: { type, item } }),
  closeOperation:   () => set({ operationDialog: null }),

  infoItem:         null, // FileItemDto or null
  setInfoItem:      (item) => set({ infoItem: item }),
  clearInfoItem:    () => set({ infoItem: null }),
}));
