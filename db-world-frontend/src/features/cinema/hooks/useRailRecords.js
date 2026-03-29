import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchRailPage } from '../api/cinemaApi';

/**
 * Lazy-loads paginated records for a single rail.
 * Call `trigger()` once when the row enters the viewport.
 * Call `loadMore()` when the user scrolls to the right end.
 */
export default function useRailRecords(railId, limitSize = 20, infiniteScroll = false, category) {
  const [records,       setRecords]       = useState([]);
  const [page,          setPage]          = useState(0);
  const [hasNext,       setHasNext]       = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const inflight = useRef(false);

  const loadPage = useCallback(async (pageNum) => {
    if (inflight.current || !railId) return;
    inflight.current = true;
    setLoading(true);
    try {
      const result = await fetchRailPage(railId, pageNum, limitSize, category);
      if (!result) return;
      setRecords(prev =>
        pageNum === 0 ? (result.records ?? []) : [...prev, ...(result.records ?? [])]
      );
      setHasNext(result.hasNext ?? false);
      setPage(pageNum + 1);
      if (pageNum === 0) setInitialLoaded(true);
    } catch (err) {
      console.error(`[useRailRecords] rail ${railId} page ${pageNum}:`, err);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [railId, limitSize, category]);

  /** Call this once when the rail enters viewport. */
  const trigger = useCallback(() => {
    if (!initialLoaded) loadPage(0);
  }, [initialLoaded, loadPage]);

  /** Call this when user nears the right end of the scroll container. */
  const loadMore = useCallback(() => {
    if (infiniteScroll && hasNext && !loading && !inflight.current) loadPage(page);
  }, [infiniteScroll, hasNext, loading, page, loadPage]);

  // Reset when railId or category changes
  useEffect(() => {
    setRecords([]);
    setPage(0);
    setHasNext(true);
    setInitialLoaded(false);
  }, [railId, category]);

  return { records, loading, hasNext, initialLoaded, trigger, loadMore };
}
