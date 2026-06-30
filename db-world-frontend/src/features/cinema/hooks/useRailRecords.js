import { useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchRailPage } from '../api/cinemaApi';

/**
 * Lazy-loads paginated records for a single rail, backed by TanStack Query so
 * results are cached across mounts (navigating Home↔Movies↔Series, returning
 * from a detail overlay, etc. no longer refetches).
 *
 * Same public shape as before so RailRow needs no changes:
 *   - call `trigger()` once when the row enters the viewport (enables the query)
 *   - call `loadMore()` when the user nears the right end
 *
 * Cached entries are keyed by (railId, category, limitSize); a key change
 * (e.g. switching genre) transparently swaps to that key's cache or fetches.
 */
export default function useRailRecords(railId, limitSize = 20, infiniteScroll = false, category, pageType) {
  // Lazy gate — the row stays un-fetched until it scrolls into view. Once
  // triggered it remains enabled for this component's life (key changes then
  // fetch immediately, matching the previous category-switch behaviour).
  const [enabled, setEnabled] = useState(false);

  // pageType scopes a multi-page rail's content (HOME → both, MOVIES → movies,
  // SERIES → series). It MUST be in the key so the same rail cached on Home
  // doesn't bleed its "both" content onto Movies/Series.
  const query = useInfiniteQuery({
    queryKey: ['rail-records', railId, category ?? null, limitSize, pageType ?? null],
    queryFn: ({ pageParam }) => fetchRailPage(railId, pageParam, limitSize, category, pageType),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage?.hasNext ? allPages.length : undefined),
    enabled: enabled && !!railId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const records = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p?.records ?? []),
    [query.data]
  );

  const trigger = useCallback(() => setEnabled(true), []);

  const loadMore = useCallback(() => {
    if (infiniteScroll && query.hasNextPage && !query.isFetching) {
      query.fetchNextPage();
    }
  }, [infiniteScroll, query.hasNextPage, query.isFetching, query.fetchNextPage]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    records,
    // Only surface "loading" for the first page or an explicit load-more — a
    // silent background refetch of already-shown pages shouldn't flash the
    // inline skeletons RailRow renders when (loading && records.length > 0).
    loading:       query.isLoading || query.isFetchingNextPage,
    hasNext:       query.hasNextPage ?? false,
    initialLoaded: query.isSuccess,
    trigger,
    loadMore,
  };
}
