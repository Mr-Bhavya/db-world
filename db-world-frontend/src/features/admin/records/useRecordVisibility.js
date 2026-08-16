import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { setRecordVisibility } from '../api/adminApi';
import { visibilityMeta } from './visibilityConstants';

/**
 * Shared hook for changing a record's visibility (DRAFT / PUBLISHED / UNLISTED), used by
 * RecordTable, RecordMobileList and RecordDetailDrawer via VisibilityControl. Single source so
 * every view shares the same optimistic update + snackbar behaviour.
 */
export function useRecordVisibility() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, visibility }) => setRecordVisibility(id, visibility),
    // Optimistically set visibility in every cached records page so the chip updates instantly;
    // reconciled with the server on settle.
    onMutate: async ({ id, visibility }) => {
      await qc.cancelQueries({ queryKey: ['records'] });
      const snapshots = qc.getQueriesData({ queryKey: ['records'] });
      qc.setQueriesData({ queryKey: ['records'] }, (old) => {
        if (!old?.content) return old;
        return { ...old, content: old.content.map(r => (r.recordId === id ? { ...r, visibility } : r)) };
      });
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
      notify.error('Could not change visibility.');
    },
    onSuccess: (_data, vars) => {
      notify.info(`Visibility set to ${visibilityMeta(vars.visibility).label}.`, { duration: 2500 });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['records'] }),
  });
}
