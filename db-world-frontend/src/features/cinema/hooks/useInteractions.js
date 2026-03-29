import { useState, useCallback } from 'react';
import {
  fetchBatchInteractions,
  addWatchlist, removeWatchlist,
  addLike,      removeLike,
  addWatched,   removeWatched,
  addLove,      removeLove,
} from '../api/cinemaApi';

/**
 * Manages interaction state (watchlist / like / watched) for a set of records.
 * - `loadForRecords(userId, recordIds)` → batch-fetches and caches
 * - `toggle*(userId, recordId)` → optimistic update + API call
 */
export default function useInteractions() {
  // Map of recordId → InteractionDto
  const [interactions, setInteractions] = useState({});

  const loadForRecords = useCallback(async (userId, recordIds) => {
    if (!userId || !recordIds?.length) return;
    try {
      const list = await fetchBatchInteractions(userId, recordIds);
      if (!Array.isArray(list)) return;
      setInteractions(prev => {
        const next = { ...prev };
        list.forEach(dto => { next[dto.recordId] = dto; });
        return next;
      });
    } catch (err) {
      console.error('[useInteractions] batch fetch failed', err);
    }
  }, []);

  const optimistic = useCallback((recordId, field, value) => {
    setInteractions(prev => ({
      ...prev,
      [recordId]: { ...(prev[recordId] ?? { recordId }), [field]: value },
    }));
  }, []);

  const toggleWatchlist = useCallback(async (userId, recordId, current) => {
    optimistic(recordId, 'watchlisted', !current);
    try {
      await (current ? removeWatchlist(recordId) : addWatchlist(recordId));
    } catch {
      optimistic(recordId, 'watchlisted', current); // rollback
    }
  }, [optimistic]);

  const toggleLike = useCallback(async (userId, recordId, current) => {
    optimistic(recordId, 'liked', !current);
    try {
      await (current ? removeLike(recordId) : addLike(recordId));
    } catch {
      optimistic(recordId, 'liked', current);
    }
  }, [optimistic]);

  const toggleWatched = useCallback(async (userId, recordId, current) => {
    optimistic(recordId, 'watched', !current);
    try {
      await (current ? removeWatched(recordId) : addWatched(recordId));
    } catch {
      optimistic(recordId, 'watched', current);
    }
  }, [optimistic]);

  const toggleLove = useCallback(async (userId, recordId, current) => {
    optimistic(recordId, 'loved', !current);
    try {
      await (current ? removeLove(recordId) : addLove(recordId));
    } catch {
      optimistic(recordId, 'loved', current);
    }
  }, [optimistic]);

  const get = useCallback((recordId) => interactions[recordId] ?? {}, [interactions]);

  return { interactions, get, loadForRecords, toggleWatchlist, toggleLike, toggleWatched, toggleLove };
}
