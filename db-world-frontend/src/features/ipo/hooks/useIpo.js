import { useQuery } from '@tanstack/react-query';
import * as api from '../api/ipoApi';

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
