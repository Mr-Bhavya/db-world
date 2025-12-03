// hooks/useInfiniteScroll.js
import { useState, useCallback, useEffect } from 'react';

export const useInfiniteScroll = (fetchFunction, initialFilters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState(initialFilters);

  const loadData = useCallback(async (pageNum = 0, append = false) => {
    if (loading || loadingMore) return;

    const loadingState = pageNum === 0 ? setLoading : setLoadingMore;
    loadingState(true);
    setError('');

    try {
      const response = await fetchFunction({
        ...filters,
        page: pageNum,
      });

      const newData = response.data.content || response.data;

      if (append) {
        setData(prev => [...prev, ...newData]);
      } else {
        setData(newData);
      }

      setHasMore(!response.data.last);
      setPage(pageNum);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      loadingState(false);
    }
  }, [filters, fetchFunction, loading, loadingMore]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading && !loadingMore) {
      loadData(page + 1, true);
    }
  }, [hasMore, loading, loadingMore, page, loadData]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    setPage(0);
    setHasMore(true);
  }, []);

  useEffect(() => {
    loadData(0, false);
  }, [filters, loadData]);

  return {
    data,
    loading,
    loadingMore,
    error,
    hasMore,
    filters,
    loadMore,
    updateFilters,
    refresh: () => loadData(0, false),
  };
};