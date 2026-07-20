import { create } from 'zustand';

/** Extracts the stable id used for selection/anchor tracking from an item entry. */
const idOf = (item) => (typeof item === 'string' ? item : item.path);

export const useFileManagerStore = create((set, _get) => ({
  // Navigation
  locationId: null,
  path: '/',
  setLocation: (locationId) => set({ locationId, path: '/', selection: new Set(), anchorId: null }),
  navigate: (path) => set({ path: path ?? '/', selection: new Set(), anchorId: null }),

  // View
  viewMode: 'grid', // 'grid' | 'list'
  setViewMode: (v) => set({ viewMode: v }),

  // Sort & filter
  sortBy: 'name', // 'name' | 'size' | 'modified' | 'type'
  sortOrder: 'asc', // 'asc' | 'desc'
  filter: 'all', // 'all' | 'folder' | 'file' | 'image' | 'audio' | 'video' | 'text' | 'pdf' | 'zip'
  setSortBy: (v) => set({ sortBy: v }),
  setSortOrder: (v) => set({ sortOrder: v }),
  setFilter: (v) => set({ filter: v }),

  // Selection (Set of path ids) with anchor-based range select
  selection: new Set(),
  anchorId: null,

  /**
   * toggleSelect(id, { additive, range, items }).
   * - plain click (no modifiers): select only `id`, move the anchor there.
   * - additive (ctrl/cmd-click): toggle `id`'s membership, move the anchor there.
   * - range (shift-click): select the inclusive slice of `items` between the
   *   current anchor and `id`; when combined with additive, the slice is
   *   added to the existing selection instead of replacing it.
   */
  toggleSelect: (id, { additive = false, range = false, items = [] } = {}) => set((s) => {
    if (range && s.anchorId != null) {
      const ids = items.map(idOf);
      const anchorIdx = ids.indexOf(s.anchorId);
      const targetIdx = ids.indexOf(id);

      if (anchorIdx === -1 || targetIdx === -1) {
        const next = additive ? new Set(s.selection) : new Set();
        next.add(id);
        return { selection: next };
      }

      const [start, end] = anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
      const slice = ids.slice(start, end + 1);
      const next = additive ? new Set(s.selection) : new Set();
      slice.forEach((sliceId) => next.add(sliceId));
      return { selection: next };
    }

    if (additive) {
      const next = new Set(s.selection);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selection: next, anchorId: id };
    }

    return { selection: new Set([id]), anchorId: id };
  }),

  selectAll: (items) => set({ selection: new Set(items.map(idOf)) }),
  clearSelection: () => set({ selection: new Set(), anchorId: null }),

  // Clipboard
  clipboard: null, // { mode: 'copy' | 'cut', items: FileItemDto[] } | null
  setClipboard: (mode, items) => set({ clipboard: { mode, items } }),
  clearClipboard: () => set({ clipboard: null }),

  // Dialog flags
  newFolderOpen: false,
  setNewFolderOpen: (v) => set({ newFolderOpen: v }),

  renameTarget: null, // FileItemDto | null
  openRename: (item) => set({ renameTarget: item }),
  closeRename: () => set({ renameTarget: null }),

  moveCopyMode: null, // 'move' | 'copy' | null
  openMoveCopy: (mode) => set({ moveCopyMode: mode }),
  closeMoveCopy: () => set({ moveCopyMode: null }),

  locationManagerOpen: false,
  setLocationManagerOpen: (v) => set({ locationManagerOpen: v }),

  infoItem: null, // FileItemDto | null
  openInfo: (item) => set({ infoItem: item }),
  closeInfo: () => set({ infoItem: null }),

  previewItem: null, // FileItemDto | null
  openPreview: (item) => set({ previewItem: item }),
  closePreview: () => set({ previewItem: null }),
}));
