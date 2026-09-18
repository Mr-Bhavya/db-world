import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const unwrap = (response) => response.data?.data ?? response.data;

/* ─── Public ──────────────────────────────────────────────────────────────── */

/**
 * Every visible channel, each with its playable URLs best-first.
 *
 * Public: the list answers without a token so a signed-out visitor can browse and watch.
 * It is metadata only — the video streams straight from the channel's own CDN to the
 * viewer's device and never passes through our server.
 */
export function useLiveChannels() {
  return useQuery({
    queryKey: ['live', 'channels'],
    queryFn: () => axiosInstance.get('/api/live/channels').then(unwrap),
    // The health job re-verifies on its own cycle; a remount inside two minutes should
    // not spend a request on a list that changes every few hours.
    staleTime: 2 * 60_000,
    retry: 1,
  });
}

export function useLiveChannel(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['live', 'channel', id],
    queryFn: () => axiosInstance.get(`/api/live/channels/${encodeURIComponent(id)}`).then(unwrap),
    enabled: enabled && Boolean(id),
    staleTime: 2 * 60_000,
    retry: 1,
  });
}

/* ─── Admin ───────────────────────────────────────────────────────────────── */

const ADMIN = '/api/live/admin';

export function useLivePlaylists() {
  return useQuery({
    queryKey: ['live', 'admin', 'playlists'],
    queryFn: () => axiosInstance.get(`${ADMIN}/playlists`).then(unwrap),
  });
}

export function useAdminLiveChannels(search) {
  return useQuery({
    queryKey: ['live', 'admin', 'channels', search || ''],
    queryFn: () => axiosInstance
      .get(`${ADMIN}/channels`, { params: search ? { q: search } : undefined })
      .then(unwrap),
  });
}

export function useLiveStats() {
  return useQuery({
    queryKey: ['live', 'admin', 'stats'],
    queryFn: () => axiosInstance.get(`${ADMIN}/stats`).then(unwrap),
  });
}

/**
 * Every admin write invalidates the same three keys. Channels, playlists and the stat
 * tiles are derived from one another — adding a playlist changes the channel count, and
 * deleting one can delete channels — so refreshing them independently would leave two of
 * the three panels lying about the state of the third.
 */
function useLiveMutation(mutationFn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: ['live'] });
      options.onSuccess?.(...args);
    },
  });
}

export const useAddPlaylist = () =>
  useLiveMutation((body) => axiosInstance.post(`${ADMIN}/playlists`, body).then(unwrap));

export const useUpdatePlaylist = () =>
  useLiveMutation(({ id, ...body }) => axiosInstance.put(`${ADMIN}/playlists/${id}`, body).then(unwrap));

export const useDeletePlaylist = () =>
  useLiveMutation((id) => axiosInstance.delete(`${ADMIN}/playlists/${id}`).then(unwrap));

export const useRefreshPlaylist = () =>
  useLiveMutation((id) => axiosInstance.post(`${ADMIN}/playlists/${id}/refresh`).then(unwrap));

export const useRefreshAllPlaylists = () =>
  useLiveMutation(() => axiosInstance.post(`${ADMIN}/refresh`).then(unwrap));

export const useAddManualChannel = () =>
  useLiveMutation((body) => axiosInstance.post(`${ADMIN}/channels`, body).then(unwrap));

export const usePatchChannel = () =>
  useLiveMutation(({ id, ...body }) => axiosInstance.patch(`${ADMIN}/channels/${id}`, body).then(unwrap));

export const useDeleteChannel = () =>
  useLiveMutation((id) => axiosInstance.delete(`${ADMIN}/channels/${id}`).then(unwrap));

export const useAddChannelSource = () =>
  useLiveMutation(({ channelId, ...body }) =>
    axiosInstance.post(`${ADMIN}/channels/${channelId}/sources`, body).then(unwrap));

export const useDeleteChannelSource = () =>
  useLiveMutation((sourceId) => axiosInstance.delete(`${ADMIN}/sources/${sourceId}`).then(unwrap));

export const useCheckChannelHealth = () =>
  useLiveMutation((id) => axiosInstance.post(`${ADMIN}/channels/${id}/health/check`).then(unwrap));

export const useCheckAllHealth = () =>
  useLiveMutation(() => axiosInstance.post(`${ADMIN}/health/check`).then(unwrap));
