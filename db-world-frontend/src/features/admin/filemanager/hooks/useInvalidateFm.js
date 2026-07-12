import { useQueryClient } from '@tanstack/react-query';

/**
 * Single source of truth for file-manager cache invalidation. Every mutation
 * in this feature (mkdir/rename/move/copy/delete/upload-complete/location
 * CRUD) must go through this hook instead of hand-rolling
 * `invalidateQueries` calls — the content-pane directory listing
 * (`useDirectory`, keyed `['file-manager', locationId, path, sortBy, order]`)
 * and the sidebar folder tree (`FolderTree.jsx`, keyed
 * `['file-manager', 'tree', locationId, path]`) are DELIBERATELY separate
 * query-key namespaces (see `FolderTree.jsx`), so invalidating only the
 * former leaves stale folder-tree nodes after a structural change.
 */
export function useInvalidateFm() {
  const queryClient = useQueryClient();

  /**
   * Invalidates every directory listing for `locationId` (any path/sort/order,
   * via key-prefix matching) AND every folder-tree node across all locations.
   */
  const invalidateDir = (locationId) => {
    queryClient.invalidateQueries({ queryKey: ['file-manager', locationId] });
    queryClient.invalidateQueries({ queryKey: ['file-manager', 'tree'] });
  };

  /** Invalidates the locations list (rail, mobile menu, LocationManagerDialog table). */
  const invalidateLocations = () => {
    queryClient.invalidateQueries({ queryKey: ['file-manager', 'locations'] });
  };

  return { invalidateDir, invalidateLocations };
}
