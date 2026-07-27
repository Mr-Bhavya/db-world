import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { getSourceHealth, getIpoChanges, repoll, getPushStatus, sendTestPush } from '../api/ipoAdminApi';

const SOURCES_KEY = ['ipo-admin', 'sources'];
const CHANGES_KEY = ['ipo-admin', 'changes'];

export function useSourceHealth() {
  return useQuery({ queryKey: SOURCES_KEY, queryFn: getSourceHealth, refetchInterval: 30_000 });
}

export function useIpoChanges() {
  return useQuery({ queryKey: CHANGES_KEY, queryFn: getIpoChanges, refetchInterval: 30_000 });
}

export function useRepoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repoll,
    onSuccess: (res) => {
      notify.success(res?.message ?? 'Re-poll triggered');
      qc.invalidateQueries({ queryKey: SOURCES_KEY });
      qc.invalidateQueries({ queryKey: CHANGES_KEY });
      // The poll itself runs on a background thread and can take a few seconds
      // (three external HTTP sources) — refetch again once it's likely done so
      // the health cards / change feed reflect the run without a manual refresh.
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: SOURCES_KEY });
        qc.invalidateQueries({ queryKey: CHANGES_KEY });
      }, 8000);
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to trigger re-poll'),
  });
}

/** Push diagnostics: { enabled, transportReady, topic }. */
export function usePushStatus() {
  return useQuery({ queryKey: ['push-admin', 'status'], queryFn: getPushStatus });
}

/** Fire a test broadcast to everyone subscribed (verifies the whole push chain). */
export function useSendTestPush() {
  return useMutation({
    mutationFn: sendTestPush,
    onSuccess: (res) => notify.success(res?.message ?? 'Test push sent'),
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to send test push'),
  });
}
