import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import * as api from '../api/ipoApi';

const errMsg = (e, fallback) => e?.response?.data?.message ?? fallback;

// GMP/subscription data trickles in a few times a day at most — a few minutes of
// staleness avoids refetch storms on tab-focus while still feeling "live enough".
const STALE_TIME = 3 * 60 * 1000;

// Filed financials (P&L) essentially never change intra-day — cache generously so
// re-opening the on-demand section doesn't re-fetch every time.
const FINANCIALS_STALE_TIME = 15 * 60 * 1000;

export function useIpos({ status = '', type = 'all', sort = 'date' } = {}) {
  return useQuery({
    queryKey: ['ipo', 'list', { status, type, sort }],
    queryFn: () => api.getIpos({ status, type, sort }),
    staleTime: STALE_TIME,
  });
}

export function useIpo(id) {
  return useQuery({
    queryKey: ['ipo', 'detail', id],
    queryFn: () => api.getIpo(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  });
}

export function useGmpHistory(id) {
  return useQuery({
    queryKey: ['ipo', 'gmp', id],
    queryFn: () => api.getGmpHistory(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  });
}

export function useSubscriptionHistory(id) {
  return useQuery({
    queryKey: ['ipo', 'sub', id],
    queryFn: () => api.getSubscriptionHistory(id),
    enabled: !!id,
    staleTime: STALE_TIME,
  });
}

/** On-demand P&L query for the detail page's financials section — deliberately separate
 * from useIpo() so the rest of the detail page never blocks on it. */
export function useFinancials(id) {
  return useQuery({
    queryKey: ['ipo', 'financials', id],
    queryFn: () => api.getFinancials(id),
    enabled: !!id,
    staleTime: FINANCIALS_STALE_TIME,
  });
}

/** The caller's saved "My IPOs" application for this IPO — resolves to `null` (not an error)
 * when nothing has been saved yet, so callers can render an empty form rather than a fallback. */
export function useMyApplication(id) {
  return useQuery({
    queryKey: ['ipo', 'application', id],
    queryFn: () => api.getMyApplication(id),
    enabled: !!id,
  });
}

/** Every IPO the caller has a saved application for — backs the "My IPOs" list page. */
export function useMyApplications() {
  return useQuery({
    queryKey: ['ipo', 'my-applications'],
    queryFn: api.getMyApplications,
  });
}

/** Create/update the caller's application for one IPO. Invalidates both the single-application
 * query (this IPO's Allotment tab) and the my-applications list (the My IPOs page) so either
 * surface reflects the save immediately. */
export function useSaveApplication(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.saveApplication(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ipo', 'application', id] });
      qc.invalidateQueries({ queryKey: ['ipo', 'my-applications'] });
      notify.success('Application saved');
    },
    onError: (e) => notify.error(errMsg(e, 'Failed to save application')),
  });
}

/** Removes the caller's saved application for one IPO — same invalidation as `useSaveApplication`. */
export function useDeleteApplication(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ipo', 'application', id] });
      qc.invalidateQueries({ queryKey: ['ipo', 'my-applications'] });
      notify.success('Application removed');
    },
    onError: (e) => notify.error(errMsg(e, 'Failed to remove application')),
  });
}
