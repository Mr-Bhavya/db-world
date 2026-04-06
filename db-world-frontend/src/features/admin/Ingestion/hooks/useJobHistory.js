import { useQuery } from '@tanstack/react-query';
import { getJobHistory } from '../services/ingestionApi';

export function useJobHistory(params = {}) {
  return useQuery({
    queryKey: ['ingestion-history', params],
    queryFn:  () => getJobHistory(params).then((r) => r.data),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}
