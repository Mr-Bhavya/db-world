import { useState, useCallback, useMemo } from 'react';
import {
  fetchBatchInteractions,
  addWatchlist, removeWatchlist,
  addLike,      removeLike,
  addWatched,   removeWatched,
  addLove,      removeLove,
} from '../api/cinemaApi';
import { useRequireAuth } from '@features/auth/useRequireAuth';

/**
 * Manages interaction state (watchlist / like / watched) for a set of records.
 * - `loadForRecords(userId, recordIds)` → batch-fetches and caches
 * - `toggle*(userId, recordId)` → optimistic update + API call
 *
 * The rails are browsable signed-out, so every toggle is gated: a visitor without an
 * account gets the sign-in prompt rather than an optimistic tick that silently rolls
 * back when the write 401s. `loadForRecords` already no-ops without a userId, so
 * anonymous pages never fire the batch read either.
 */
export default function useInteractions() {
  // Map of recordId → InteractionDto
  const [interactions, setInteractions] = useState({});
  const { requireAuth } = useRequireAuth();

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

  const gated = useMemo(() => ({
    toggleWatchlist: requireAuth(toggleWatchlist, 'Sign in to use your watchlist'),
    toggleLike:      requireAuth(toggleLike,      'Sign in to like this'),
    toggleWatched:   requireAuth(toggleWatched,   'Sign in to track what you have watched'),
    toggleLove:      requireAuth(toggleLove,      'Sign in to save this'),
  }), [requireAuth, toggleWatchlist, toggleLike, toggleWatched, toggleLove]);

  return { interactions, get, loadForRecords, ...gated };
}
