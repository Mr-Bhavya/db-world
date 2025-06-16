import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

export const useInfiniteScroll = (items, pageSize = 20) => {
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px', // Trigger early
  });

  const paginatedItems = items.slice(0, page * pageSize);

  useEffect(() => {
    if (inView && !loadingMore && paginatedItems.length < items.length) {
      setLoadingMore(true);
      setTimeout(() => {
        setPage(prev => prev + 1);
        setLoadingMore(false);
      }, 300); // Simulated delay
    }
  }, [inView, loadingMore, items.length]);

  // Reset page when items change (e.g. search filter applied)
  useEffect(() => {
    setPage(1);
  }, [items]);

  return {
    data: paginatedItems,
    loadingMore,
    loaderRef: ref, // this comes from useInView
  };
};
