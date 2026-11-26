import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getJobHistory } from '../services/ingestionApi';
import { normalizeHistoryPage, toHistoryParams } from '../history/historyQuery';

/** One server-side page of job history; keeps the previous page visible while the next loads. */
export function useJobHistory(query = {}) {
  const params = toHistoryParams(query);
  return useQuery({
    queryKey: ['ingestion-history', params],
    queryFn: () => getJobHistory(params),
    select: normalizeHistoryPage,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}
