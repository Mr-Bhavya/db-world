import React, { useMemo, useState } from 'react';
import {
  Box, Chip, IconButton, InputAdornment, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  AddLinkRounded, DeleteOutlineRounded, EditRounded, LiveTvRounded, NetworkCheckRounded,
  PlaylistAddRounded, RefreshRounded, SearchRounded, TroubleshootRounded,
} from '@mui/icons-material';

import {
  AdminActionButton, AdminDataTable, AdminPage, SectionCard, StatCard, StatGrid,
} from '@features/admin/adminUi';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import {
  useAdminLiveChannels, useCheckAllHealth, useCheckChannelHealth, useDeleteChannel,
  useDeletePlaylist, useLivePlaylists, useLiveStats, usePatchChannel,
  useRefreshAllPlaylists, useRefreshPlaylist,
} from '@features/live/liveApi';
import { AddChannelDialog, ChannelSourcesDialog, PlaylistDialog } from './liveDialogs';

const HEALTH_COLOUR = { UP: 'success', DOWN: 'error', UNKNOWN: 'default' };

const relative = (iso) => {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

/**
 * Live TV administration.
 *
 * Two tables, because they are two different things: a PLAYLIST is a source of many
 * channels that is re-imported on a schedule, while a CHANNEL is what a viewer picks and
 * can be backed by several stream URLs from several playlists at once.
 */
export default function LiveTvAdmin() {
  const T = useT();

  const [search, setSearch]             = useState('');
  const [playlistDialog, setPlaylistDialog] = useState(null);   // { playlist } | null
  const [channelDialog, setChannelDialog]   = useState(false);
  const [sourcesFor, setSourcesFor]         = useState(null);   // channel | null

  const playlists = useLivePlaylists();
  const channels  = useAdminLiveChannels(search);
  const stats     = useLiveStats();

  const refreshAll   = useRefreshAllPlaylists();
  const refreshOne   = useRefreshPlaylist();
  const deletePlay   = useDeletePlaylist();
  const patchChannel = usePatchChannel();
  const deleteChan   = useDeleteChannel();
  const checkAll     = useCheckAllHealth();
  const checkOne     = useCheckChannelHealth();

  // The dialog holds a snapshot; after adding or removing a URL the query refetches, so
  // re-read the live row or the list would still show the state before the edit.
  const openSourcesChannel = useMemo(
    () => (sourcesFor ? (channels.data ?? []).find((c) => c.id === sourcesFor.id) ?? sourcesFor : null),
    [sourcesFor, channels.data],
  );

  // 409 means an import is already in flight (the scheduled job, or a second click).
  // That is expected, not a failure, so it must not read like one.
  const reportRefreshFailure = (e) => (e?.response?.status === 409
    ? notify.warning(e?.response?.data?.message ?? 'An import is already running')
    : notify.error(e?.response?.data?.message ?? 'Refresh failed'));

  const runRefreshAll = () => refreshAll.mutateAsync()
    .then((r) => notify.success(
      `Imported ${r.channelsCreated} new channel${r.channelsCreated === 1 ? '' : 's'} and ${r.sourcesCreated} stream URL${r.sourcesCreated === 1 ? '' : 's'}`
      + (r.playlistsFailed ? ` · ${r.playlistsFailed} playlist(s) failed` : '')))
    .catch(reportRefreshFailure);

  const runCheckAll = () => checkAll.mutateAsync()
    .then((r) => notify.success(`Probed ${r.probed} URL${r.probed === 1 ? '' : 's'} — ${r.up} up, ${r.down} down`))
    .catch((e) => notify.error(e?.response?.data?.message ?? 'Health check failed'));

  const playlistColumns = [
    {
      field: 'name', headerName: 'Playlist', flex: 1.4, minWidth: 200,
      renderCell: ({ row }) => (
        <Box sx={{ minWidth: 0, py: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{row.name}</Typography>
          <Tooltip title={row.url}>
            <Typography sx={{
              fontSize: 11, color: T.textFaint, fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {row.url}
            </Typography>
          </Tooltip>
        </Box>
      ),
    },
    {
      field: 'lastStatus', headerName: 'Last import', width: 160,
      renderCell: ({ row }) => (
        <Tooltip title={row.lastError || ''}>
          <Box sx={{ py: 0.5 }}>
            <Chip size="small" variant="outlined"
              label={row.lastStatus ?? 'not yet run'}
              color={row.lastStatus === 'OK' ? 'success' : row.lastStatus === 'ERROR' ? 'error' : 'default'} />
            <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>{relative(row.lastFetchedAt)}</Typography>
          </Box>
        </Tooltip>
      ),
    },
    { field: 'channelCount', headerName: 'Entries', width: 90, type: 'number' },
    { field: 'sourceCount',  headerName: 'URLs',    width: 80,  type: 'number' },
    {
      field: 'enabled', headerName: 'On', width: 70, sortable: false,
      renderCell: ({ row }) => <Chip size="small" label={row.enabled ? 'yes' : 'no'}
        color={row.enabled ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'actions', headerName: '', width: 130, sortable: false, filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Re-import now">
            <span>
              <IconButton size="small" disabled={refreshOne.isPending} sx={{ color: T.teal }}
                onClick={() => refreshOne.mutateAsync(row.id)
                  .then((r) => notify.success(r.playlistsFailed
                    ? 'Import failed — see the status column'
                    : `${r.channelsCreated} new channel(s), ${r.sourcesCreated} new URL(s)`))
                  .catch(reportRefreshFailure)}>
                <RefreshRounded sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" sx={{ color: T.textMuted }}
              onClick={() => setPlaylistDialog({ playlist: row })}>
              <EditRounded sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove playlist and its channels">
            <span>
              <IconButton size="small" disabled={deletePlay.isPending} sx={{ color: T.error }}
                onClick={() => {
                  if (!window.confirm(`Remove "${row.name}"? Its stream URLs go with it, and any channel left with nothing to play is deleted.`)) return;
                  deletePlay.mutateAsync(row.id)
                    .then(() => notify.success('Playlist removed'))
                    .catch((e) => notify.error(e?.response?.data?.message ?? 'Could not remove it'));
                }}>
                <DeleteOutlineRounded sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const channelColumns = [
    {
      field: 'name', headerName: 'Channel', flex: 1.3, minWidth: 200,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, py: 0.5 }}>
          <Box sx={{
            width: 34, height: 34, flexShrink: 0, borderRadius: 1, bgcolor: T.inputBg,
            display: 'grid', placeItems: 'center', overflow: 'hidden',
          }}>
            {row.logoUrl
              ? <Box component="img" src={row.logoUrl} alt="" loading="lazy"
                  sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <LiveTvRounded sx={{ fontSize: 16, color: T.textFaint }} />}
          </Box>
          <Typography sx={{
            fontSize: 13, fontWeight: 600, color: T.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {row.name}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'categories', headerName: 'Categories', width: 210, sortable: false,
      // Many-valued: a playlist's `group-title` is a `;`-joined list, so a channel is
      // routinely in two or three at once.
      valueGetter: (value) => (value ?? []).join(', '),
      renderCell: ({ row }) => (
        <Tooltip title={(row.categories ?? []).join(', ')}>
          <Typography sx={{
            fontSize: 12.5, color: T.textMuted,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {(row.categories ?? []).join(', ') || '—'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'health', headerName: 'Health', width: 110,
      renderCell: ({ row }) => (
        <Chip size="small" label={row.health} variant="outlined" color={HEALTH_COLOUR[row.health] ?? 'default'} />
      ),
    },
    {
      field: 'sources', headerName: 'Stream URLs', width: 140, sortable: false,
      // The point of the whole design: one channel, many URLs, failover between them.
      renderCell: ({ row }) => (
        <AdminActionButton icon={AddLinkRounded} variant="secondary" onClick={() => setSourcesFor(row)}>
          {`${row.sources?.length ?? 0} URL${(row.sources?.length ?? 0) === 1 ? '' : 's'}`}
        </AdminActionButton>
      ),
    },
    {
      field: 'enabled', headerName: 'Visible', width: 90, sortable: false,
      renderCell: ({ row }) => (
        <Switch size="small" checked={row.enabled}
          onChange={(e) => patchChannel.mutateAsync({ id: row.id, enabled: e.target.checked })
            .catch((err) => notify.error(err?.response?.data?.message ?? 'Could not update the channel'))} />
      ),
    },
    {
      field: 'actions', headerName: '', width: 100, sortable: false, filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Test this channel's URLs now">
            <span>
              <IconButton size="small" disabled={checkOne.isPending} sx={{ color: T.teal }}
                onClick={() => checkOne.mutateAsync(row.id)
                  .then((r) => notify.success(`${r.up} of ${r.probed} URL(s) reachable`))
                  .catch((e) => notify.error(e?.response?.data?.message ?? 'Check failed'))}>
                <TroubleshootRounded sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete channel">
            <span>
              <IconButton size="small" disabled={deleteChan.isPending} sx={{ color: T.error }}
                onClick={() => {
                  if (!window.confirm(`Delete "${row.name}" and all of its stream URLs?`)) return;
                  deleteChan.mutateAsync(row.id)
                    .then(() => notify.success('Channel deleted'))
                    .catch((e) => notify.error(e?.response?.data?.message ?? 'Could not delete it'));
                }}>
                <DeleteOutlineRounded sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const s = stats.data;

  return (
    <AdminPage
      title="Live TV"
      subtitle="M3U playlist sources, channels, and the stream URLs behind them"
      icon={LiveTvRounded}
      onRefresh={() => { playlists.refetch(); channels.refetch(); stats.refetch(); }}
      refreshing={playlists.isFetching || channels.isFetching}
      actions={(
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <AdminActionButton icon={PlaylistAddRounded} onClick={() => setPlaylistDialog({ playlist: null })}>
            Add playlist
          </AdminActionButton>
          <AdminActionButton icon={LiveTvRounded} variant="secondary" onClick={() => setChannelDialog(true)}>
            Add channel
          </AdminActionButton>
          <AdminActionButton icon={RefreshRounded} variant="secondary" loading={refreshAll.isPending} onClick={runRefreshAll}>
            Refresh all
          </AdminActionButton>
          <AdminActionButton icon={NetworkCheckRounded} variant="secondary" loading={checkAll.isPending} onClick={runCheckAll}>
            Check health
          </AdminActionButton>
        </Stack>
      )}
    >
      <StatGrid>
        <StatCard icon={PlaylistAddRounded} label="Playlists" value={s?.playlists ?? 0} loading={stats.isLoading} />
        <StatCard icon={LiveTvRounded}      label="Channels"  value={s?.channels ?? 0}  loading={stats.isLoading} />
        <StatCard icon={NetworkCheckRounded} label="Working"  value={s?.channelsUp ?? 0} accent={T.success} loading={stats.isLoading} />
        <StatCard icon={TroubleshootRounded} label="Dead"     value={s?.channelsDown ?? 0} accent={T.error} loading={stats.isLoading} />
        <StatCard icon={AddLinkRounded}      label="Stream URLs" value={s?.sources ?? 0} loading={stats.isLoading} />
      </StatGrid>

      <SectionCard title="Playlist sources" icon={PlaylistAddRounded}>
        <AdminDataTable
          rows={playlists.data ?? []}
          columns={playlistColumns}
          loading={playlists.isLoading}
          error={playlists.error}
          onRetry={playlists.refetch}
          getRowId={(r) => r.id}
          autoHeight
          pageSize={10}
          emptyTitle="No playlists yet"
          emptyMessage="Add an M3U URL to import channels. iptv-org publishes free-to-air playlists by country."
        />
      </SectionCard>

      <SectionCard title="Channels" icon={LiveTvRounded}>
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search channels or categories"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: T.textFaint }} /></InputAdornment>
              ),
            },
          }}
          sx={{ mb: 2, width: { xs: '100%', sm: 320 }, '& .MuiOutlinedInput-root': { bgcolor: T.inputBg } }}
        />
        <AdminDataTable
          rows={channels.data ?? []}
          columns={channelColumns}
          loading={channels.isLoading}
          error={channels.error}
          onRetry={channels.refetch}
          getRowId={(r) => r.id}
          height={620}
          emptyTitle="No channels"
          emptyMessage="Add a playlist and refresh it, or add a single channel by URL."
        />
      </SectionCard>

      <PlaylistDialog
        open={Boolean(playlistDialog)}
        playlist={playlistDialog?.playlist ?? null}
        onClose={() => setPlaylistDialog(null)}
      />
      <AddChannelDialog open={channelDialog} onClose={() => setChannelDialog(false)} />
      <ChannelSourcesDialog
        open={Boolean(openSourcesChannel)}
        channel={openSourcesChannel}
        onClose={() => setSourcesFor(null)}
      />
    </AdminPage>
  );
}
