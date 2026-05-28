import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { setRecordVisibility } from '../api/adminApi';

/**
 * Shared hook for the inline hide-from-rails toggle used by RecordTable,
 * RecordGrid and RecordMobileList. Single source so all three views share the
 * same optimistic + snackbar behaviour.
 */
export function useRecordVisibility() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: ({ id, hideFromRails }) => setRecordVisibility(id, hideFromRails),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['records'] });
      enqueueSnackbar(
        vars.hideFromRails ? 'Record hidden from rails (still in search).' : 'Record visible on rails again.',
        { variant: 'info', autoHideDuration: 2500 }
      );
    },
    onError: () => enqueueSnackbar('Could not toggle visibility.', { variant: 'error' }),
  });
}
