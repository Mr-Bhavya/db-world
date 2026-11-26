import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getQueueStatus } from '../services/ingestionApi';
import { summarizeQueue } from '../queue/queueStatus';

/** Polls the queue bar snapshot every 5 s while the tab is visible (React Query pauses in background). */
export function useQueueStatus() {
  return useQuery({
    queryKey: ['ingestion-queue'],
    queryFn: getQueueStatus,
    select: summarizeQueue,
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
    staleTime: 4000,
    retry: 1,
  });
}
