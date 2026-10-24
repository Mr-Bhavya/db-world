import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

/**
 * Paged TMDB search with infinite scroll.
 *
 * `search({ type, query, year, page, signal })` must resolve to
 * `{ page, totalPages, totalResults, results }`. Attach `sentinelRef` to an element
 * after the last row; the next page loads when it scrolls into view.
 */
export default function useTmdbSearch({ search, scope, type, query, year, enabled = true }) {
  const q = (query ?? '').trim();
  const y = year ? String(year).trim() : '';

  const {
    data, isFetching, isFetchingNextPage, isError, error,
    hasNextPage, fetchNextPage, refetch,
  } = useInfiniteQuery({
    queryKey: ['tmdb-search', scope, type, q, y],
    queryFn: ({ pageParam, signal }) =>
      search({ type, query: q, year: y || undefined, page: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last && last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: enabled && q.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // TMDB can repeat an item across pages when popularity shifts between requests.
  const results = useMemo(() => {
    const seen = new Set();
    return (data?.pages ?? [])
      .flatMap((p) => p?.results ?? [])
      .filter((r) => !seen.has(r.id) && seen.add(r.id));
  }, [data]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching && !isError) fetchNextPage();
  }, [hasNextPage, isFetching, isError, fetchNextPage]);

  const observerRef = useRef(null);
  const visibleRef = useRef(false);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  const sentinelRef = useCallback((node) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    visibleRef.current = false;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: '200px 0px' },
    );
    observerRef.current.observe(node);
  }, []);

  // The observer only fires on visibility changes; a short page leaves the sentinel in view.
  useEffect(() => { if (visibleRef.current) loadMore(); }, [loadMore]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const hasPages = (data?.pages?.length ?? 0) > 0;

  return {
    results,
    totalResults: data?.pages?.[0]?.totalResults ?? 0,
    isSearching: isFetching && !isFetchingNextPage && !hasPages,
    isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    // First-page failure replaces the list; a later-page failure keeps what's loaded.
    isError: isError && !hasPages,
    isNextPageError: isError && hasPages,
    error,
    loadMore,
    retry: hasPages ? fetchNextPage : refetch,
    sentinelRef,
  };
}
