import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import {
  getSourceHealth, getIpoChanges, repoll, getPushStatus, sendTestPush,
  getIpoDuplicates, mergeIpoDuplicates,
} from '../api/ipoAdminApi';

const SOURCES_KEY = ['ipo-admin', 'sources'];
const CHANGES_KEY = ['ipo-admin', 'changes'];
const DUPLICATES_KEY = ['ipo-admin', 'duplicates'];

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

/**
 * Duplicate-listing DRY RUN. Read-only, so it is safe to poll — but not polled: the report is a
 * review surface an admin reads deliberately, and having rows shift under a decision would be
 * worse than a stale count. Refresh with the page's own refresh action.
 */
export function useIpoDuplicates() {
  return useQuery({ queryKey: DUPLICATES_KEY, queryFn: getIpoDuplicates });
}

/**
 * Applies the merge — for one cluster (pass its alias key) or all of them (pass nothing).
 * Invalidates the change feed too, since a merge repoints every loser's audit trail.
 */
export function useMergeIpoDuplicates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aliasKeys) => mergeIpoDuplicates(aliasKeys),
    onSuccess: (res) => {
      notify.success(res?.message ?? 'Duplicates merged');
      qc.invalidateQueries({ queryKey: DUPLICATES_KEY });
      qc.invalidateQueries({ queryKey: CHANGES_KEY });
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to merge duplicates'),
  });
}
