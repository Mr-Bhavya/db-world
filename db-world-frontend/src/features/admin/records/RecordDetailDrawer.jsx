import {
  Dialog, Box, Typography, Chip, IconButton, Tabs, Tab,
  CircularProgress, Alert, Tooltip, useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useT } from '@shared/theme';
import { getAdminRecordDetail } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';
import { useRecordVisibility } from './useRecordVisibility';
import { useRecordSync } from './useRecordSync';
import { TmdbDetailBody } from './TmdbDetailModal';
import { MediaFilesBody } from './MediaFilesModal';

const SYNC_META = {
  SUCCESS: { label: 'Synced',  color: '#10b981' },
  FAILED:  { label: 'Failed',  color: '#ef4444' },
  SKIPPED: { label: 'Skipped', color: '#6b7280' },
  RUNNING: { label: 'Running', color: '#f59e0b' },
};

const TABS = [['overview', 'Overview'], ['tmdb', 'TMDB'], ['files', 'Files'], ['sync', 'Sync']];

const InfoRow = ({ label, value }) => {
  const T = useT();
  if (value === null || value === undefined || value === '') return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: .6, borderBottom: `1px solid ${T.border}` }}>
      <Typography sx={{ fontSize: 12, color: T.textMuted, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.5, color: T.textPrimary, textAlign: 'right', wordBreak: 'break-word' }}>{String(value)}</Typography>
    </Box>
  );
};

// ── Overview tab — full record + key TMDB summary (fetched by id) ────
function OverviewPanel({ recordId }) {
  const T = useT();
  const { data: rec, isLoading, error } = useQuery({
    queryKey: ['recordDetail', recordId],
    queryFn:  () => getAdminRecordDetail(recordId),
    enabled:  Boolean(recordId),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} sx={{ color: T.teal }} /></Box>;
  if (error)     return <Alert severity="error" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, '& .MuiAlert-icon': { color: T.error } }}>Failed to load record details</Alert>;
  if (!rec)      return null;

  const tmdb      = rec.tmdb;
  const isMovie   = rec.type === 'MOVIE';
  const genres    = tmdb?.genres?.map(g => g.name).filter(Boolean).join(', ') || null;
  const providers = [...new Set(tmdb?.providers?.map(p => p.providerName ?? p.provider?.name).filter(Boolean) ?? [])].join(', ') || null;

  return (
    <Box>
      {tmdb?.overview && (
        <Typography sx={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, mb: 2 }}>{tmdb.overview}</Typography>
      )}
      <InfoRow label="Record ID"   value={rec.id} />
      <InfoRow label="TMDB ID"     value={rec.tmdb_id} />
      <InfoRow label="Type"        value={isMovie ? 'Movie' : 'Series'} />
      <InfoRow label="Rating"      value={tmdb?.voteAverage ? `${tmdb.voteAverage.toFixed(1)} / 10` : null} />
      <InfoRow label="Genres"      value={genres} />
      {isMovie
        ? <InfoRow label="Runtime" value={tmdb?.runtime ? `${tmdb.runtime} min` : null} />
        : <>
            <InfoRow label="Seasons"  value={tmdb?.numberOfSeasons} />
            <InfoRow label="Episodes" value={tmdb?.numberOfEpisodes} />
          </>}
      <InfoRow label="Status"      value={tmdb?.status} />
      <InfoRow label="Language"    value={tmdb?.originalLanguage?.toUpperCase()} />
      <InfoRow label="Providers"   value={providers} />
      <InfoRow label="Created"     value={rec.creationDate ? formatDistanceToNow(new Date(rec.creationDate), { addSuffix: true }) : null} />
      <InfoRow label="Updated"     value={rec.lastModifiedDate ? formatDistanceToNow(new Date(rec.lastModifiedDate), { addSuffix: true }) : null} />

      {rec.tags?.length > 0 && (
        <>
          <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: .8, color: T.textFaint, mt: 2, mb: 1 }}>Tags</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .75 }}>
            {rec.tags.map(t => (
              <Chip key={t.id ?? t.tagType} label={t.tagType?.replace(/_/g, ' ')} size="small"
                sx={{ fontSize: 11, fontWeight: 700, bgcolor: T.tealBg, color: T.teal }} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Sync tab — status snapshot + re-sync ────────────────────────────
function SyncPanel({ row }) {
  const T = useT();
  const syncMut = useRecordSync();
  if (!row) return <Typography sx={{ fontSize: 13, color: T.textMuted }}>Record not on the current page.</Typography>;

  const m = SYNC_META[row.syncStatus] ?? null;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        {m
          ? <Chip label={m.label} size="small" sx={{ bgcolor: `${m.color}22`, color: m.color, fontWeight: 700 }} />
          : <Typography sx={{ fontSize: 13, color: T.textFaint }}>Never synced</Typography>}
        <Box onClick={() => syncMut.mutate(row.recordId)}
          sx={{ display: 'flex', alignItems: 'center', gap: .5, cursor: 'pointer', color: T.teal, fontSize: 13, '&:hover': { textDecoration: 'underline' } }}>
          <SyncIcon sx={{ fontSize: 16, animation: syncMut.isPending ? 'dbw-spin .8s linear infinite' : 'none', '@keyframes dbw-spin': { to: { transform: 'rotate(360deg)' } } }} />
          Re-sync now
        </Box>
      </Box>
      <InfoRow label="Last synced"  value={row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString() : null} />
      <InfoRow label="Last checked" value={row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleString() : null} />
      {row.syncError && (
        <>
          <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: .8, color: T.textFaint, mt: 2, mb: .5 }}>Last error</Typography>
          <Typography sx={{ fontSize: 12, color: T.error, fontFamily: 'monospace', wordBreak: 'break-word', lineHeight: 1.5 }}>{row.syncError}</Typography>
        </>
      )}
    </Box>
  );
}

export default function RecordDetailDrawer({ rows }) {
  const T = useT();
  const { drawerRecordId, drawerTab, setDrawerTab, closeDrawer } = useRecordStore();
  const open = Boolean(drawerRecordId);
  const row  = rows?.find(r => r.recordId === drawerRecordId);
  const visibilityMut = useRecordVisibility();
  const isXs = useMediaQuery('(max-width:600px)');

  return (
    <Dialog open={open} onClose={closeDrawer} fullWidth maxWidth="md" fullScreen={isXs}
      PaperProps={{ sx: { bgcolor: T.sidebar, color: T.textPrimary, border: isXs ? 'none' : `1px solid ${T.glassBorder}`, borderRadius: isXs ? 0 : 2, height: isXs ? '100%' : '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}>

      {/* Header */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: T.textPrimary, wordBreak: 'break-word' }}>
            {row?.name ?? `Record #${drawerRecordId}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: .5, alignItems: 'center' }}>
            {row && (
              <Chip label={row.type === 'TV_SERIES' ? 'Series' : 'Movie'} size="small"
                sx={{ bgcolor: row.type === 'MOVIE' ? T.tealBg : `${T.success}20`, color: row.type === 'MOVIE' ? T.teal : T.success, fontWeight: 700, fontSize: 10 }} />
            )}
            {row?.year && <Chip label={row.year} size="small" sx={{ bgcolor: T.glass, color: T.textMuted, fontSize: 10 }} />}
            {row?.tmdbId && (
              <Box component="a" href={`https://www.themoviedb.org/${row.type === 'MOVIE' ? 'movie' : 'tv'}/${row.tmdbId}`}
                target="_blank" rel="noreferrer"
                sx={{ fontSize: 11, color: T.teal, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                #{row.tmdbId} ↗
              </Box>
            )}
            {row && (
              <Tooltip title={row.hideFromRails ? 'Hidden from rails (click to show)' : 'Visible on rails (click to hide)'}>
                <IconButton size="small" onClick={() => visibilityMut.mutate({ id: row.recordId, hideFromRails: !row.hideFromRails })}
                  sx={{ color: row.hideFromRails ? T.error : T.success, p: .25 }}>
                  {row.hideFromRails ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        <IconButton onClick={closeDrawer} sx={{ color: T.textMuted, flexShrink: 0 }}><CloseIcon /></IconButton>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)} variant="fullWidth"
          sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, fontSize: 12.5, color: T.textMuted, textTransform: 'none' }, '& .Mui-selected': { color: `${T.teal} !important` }, '& .MuiTabs-indicator': { bgcolor: T.teal } }}>
          {TABS.map(([v, l]) => <Tab key={v} value={v} label={l} />)}
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, overflowY: 'auto', flex: 1, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
        {!open ? null
          : drawerTab === 'overview' ? <OverviewPanel recordId={drawerRecordId} />
          : drawerTab === 'tmdb'     ? <TmdbDetailBody record={row} />
          : drawerTab === 'files'    ? <MediaFilesBody recordId={drawerRecordId} />
          : <SyncPanel row={row} />}
      </Box>
    </Dialog>
  );
}
