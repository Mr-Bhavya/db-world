import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHostHealth } from '../api/adminApi';
import { HOST_HEALTH_QUERY_KEY } from '../system-info/hostHealthUtils';
import { SERVER_TOOLS, toolIndicator } from './serverTools';

/**
 * The status dot of every server tool, keyed by tool id. It shares the Host health query on
 * System Info, so the sidebar and that page reuse one request and its cache. The report
 * only changes every 15 minutes, so a minute is plenty.
 *
 * @returns {Record<string, {status: string, text: string} | null>}
 */
export default function useServerToolsStatus() {
  const { data } = useQuery({
    queryKey: HOST_HEALTH_QUERY_KEY,
    queryFn: getHostHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return useMemo(
    () => Object.fromEntries(SERVER_TOOLS.map((t) => [t.id, toolIndicator(data, t)])),
    [data],
  );
}
