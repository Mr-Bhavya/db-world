import { useQuery } from '@tanstack/react-query';

import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const unwrap = (response) => response.data?.data ?? response.data;

/**
 * One request for every widget on the hub.
 *
 * Public endpoint: it answers signed out with the IPO and Cinema sections only, and gains the
 * user-scoped sections (wallet, vault, notifications, admin) when a token is present. Callers
 * must therefore treat every section as optional — see `useHomeSummary`.
 */
export const fetchHomeSummary = () =>
  axiosInstance.get('/api/home/summary').then(unwrap);

/**
 * The figures behind the dashboard tiles.
 *
 * `staleTime` is a minute: the underlying numbers (IPO GMP, a new title, an expiring document)
 * move on the order of hours, and the hub is the most re-visited route in the app, so refetching
 * on every mount would be pure waste. It stays enabled for anonymous visitors — that is the whole
 * point of the endpoint being public.
 *
 * Errors are swallowed by design. A widget reads `summary?.<section>` and falls back to its static
 * description when the section is missing, so a failed summary degrades the hub to exactly what it
 * looked like before this endpoint existed rather than showing an error.
 *
 * `enabled` exists for the header, which wants these figures only for the Apps panel. The header is
 * mounted on every non-cinema route, so fetching eagerly there would put a request on every page
 * load to fill a panel most visits never open. A disabled query still reads whatever is already in
 * the cache, so on the hub — where the dashboard has fetched — the panel gets its live status free.
 */
export function useHomeSummary({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['home', 'summary'],
    queryFn: fetchHomeSummary,
    enabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
