import { useQuery } from '@tanstack/react-query';
import * as api from '../api/ipoApi';

// GMP/subscription data trickles in a few times a day at most — a few minutes of
// staleness avoids refetch storms on tab-focus while still feeling "live enough".
const STALE_TIME = 3 * 60 * 1000;

export function useIpos(status) {
  const normalized = status || undefined;
  return useQuery({
    queryKey: ['ipo', 'list', normalized ?? 'all'],
    queryFn: () => api.getIpos(normalized),
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
