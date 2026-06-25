import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { refreshRecordFromTmdb } from '../api/adminApi';

/**
 * Re-syncs a single record's data from TMDB (re-fetches and updates the DB),
 * then refreshes the records table. Shared by the table/grid/mobile views.
 */
export function useRecordSync() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: (id) => refreshRecordFromTmdb(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      enqueueSnackbar('Synced from TMDB.', { variant: 'success', autoHideDuration: 2500 });
    },
    onError: () => enqueueSnackbar('TMDB sync failed.', { variant: 'error' }),
  });
}
