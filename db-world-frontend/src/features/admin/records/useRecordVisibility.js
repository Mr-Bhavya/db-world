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
    // Optimistically flip hideFromRails in every cached records page so the icon
    // updates instantly; reconciled with the server on settle.
    onMutate: async ({ id, hideFromRails }) => {
      await qc.cancelQueries({ queryKey: ['records'] });
      const snapshots = qc.getQueriesData({ queryKey: ['records'] });
      qc.setQueriesData({ queryKey: ['records'] }, (old) => {
        if (!old?.content) return old;
        return { ...old, content: old.content.map(r => (r.recordId === id ? { ...r, hideFromRails } : r)) };
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
      enqueueSnackbar('Could not toggle visibility.', { variant: 'error' });
    },
    onSuccess: (_data, vars) => {
      enqueueSnackbar(
        vars.hideFromRails ? 'Record hidden from rails (still in search).' : 'Record visible on rails again.',
        { variant: 'info', autoHideDuration: 2500 }
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['records'] }),
  });
}
