import { useQuery } from '@tanstack/react-query';
import { fetchYtFormats } from '../services/ingestionApi';

export function useYtFormats(url) {
  return useQuery({
    queryKey: ['yt-formats', url],
    queryFn:  () => fetchYtFormats(url).then((r) => r.data),
    enabled:  !!url,
    staleTime: 5 * 60 * 1000, // 5 min — formats rarely change mid-session
    retry: 1,
  });
}
