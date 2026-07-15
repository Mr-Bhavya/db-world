import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { refreshRecordFromTmdb } from '../api/adminApi';

/**
 * Re-syncs a single record's data from TMDB (re-fetches and updates the DB),
 * then refreshes the records table. Shared by the table/grid/mobile views.
 */
export function useRecordSync() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id) => refreshRecordFromTmdb(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      qc.invalidateQueries({ queryKey: ['tmdb-sync-stats'] });
      notify.success('Synced from TMDB.', { duration: 2500 });
    },
    onError: () => notify.error('TMDB sync failed.'),
  });
}
