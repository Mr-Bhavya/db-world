import { Box, Checkbox, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import SyncIcon from '@mui/icons-material/Sync';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { formatDistanceToNow } from 'date-fns';
import { useT } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';
import { useRecordVisibility } from './useRecordVisibility';
import { useRecordSync } from './useRecordSync';
import RecordTagsInline from './RecordTagsInline';

const SYNC_META = {
  SUCCESS: { label: 'Synced',  color: '#10b981' },
  FAILED:  { label: 'Failed',  color: '#ef4444' },
  SKIPPED: { label: 'Skipped', color: '#6b7280' },
  RUNNING: { label: 'Running', color: '#f59e0b' },
};

const fmtSize = (b) => {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${Math.round(b / 1024)} KB`;
  if (b < 1024 ** 3) return `${Math.round(b / 1024 ** 2)} MB`;
  return `${(b / 1024 ** 3).toFixed(1)} GB`;
};

// Compact mobile card equivalent of the DataGrid row — same data + actions
// (select / drawer / sync / edit / delete / files / on-rails / tags), stacked so
// nothing is cut off and there's no horizontal scroll.
export default function RecordMobileList({ rows, onDelete }) {
  const T = useT();
  const { selectedRows, setSelectedRows, openModal, openMediaFiles, openDrawer } = useRecordStore();
  const visibilityMut = useRecordVisibility();
  const syncMut       = useRecordSync();

  const selected = new Set(selectedRows);
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedRows([...next]);
  };

  if (!rows.length) {
    return <Box sx={{ py: 8, textAlign: 'center', color: T.textFaint, fontSize: 13 }}>No records found</Box>;
  }

  return (
    <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map(row => {
        const sel     = selected.has(row.recordId);
        const meta    = SYNC_META[row.syncStatus];
        const hidden  = Boolean(row.hideFromRails);
        const count   = row.mediaFileCount ?? 0;
        const syncing = syncMut.isPending && syncMut.variables === row.recordId;
        return (
          <Box key={row.recordId}
            sx={{ borderRadius: 2, p: 1.25, border: `1px solid ${sel ? T.teal : T.border}`,
              bgcolor: sel ? T.tealBg : T.sidebar, transition: 'border-color .15s, background .15s' }}>

            {/* Title row: checkbox · title (tap → drawer) · actions */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Checkbox size="small" checked={sel} onChange={() => toggle(row.recordId)}
                sx={{ p: 0.25, mt: -0.25, color: T.textFaint, '&.Mui-checked': { color: T.teal } }} />

              <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openDrawer(row.recordId)}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  {row.type === 'MOVIE'
                    ? <MovieIcon sx={{ fontSize: 16, color: T.teal, flexShrink: 0 }} />
                    : <TvIcon    sx={{ fontSize: 16, color: T.success, flexShrink: 0 }} />}
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: T.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.name}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.25 }}>
                  {row.year ?? '—'}{row.tmdbId ? ` · #${row.tmdbId}` : ''} · id {row.recordId}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexShrink: 0 }}>
                <Tooltip title="Sync from TMDB">
                  <span>
                    <IconButton size="small" disabled={syncing} onClick={() => syncMut.mutate(row.recordId)}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
                      <SyncIcon sx={{ fontSize: 16,
                        animation: syncing ? 'dbw-spin 0.8s linear infinite' : 'none',
                        '@keyframes dbw-spin': { to: { transform: 'rotate(360deg)' } } }} />
                    </IconButton>
                  </span>
                </Tooltip>
                <IconButton size="small" onClick={() => openModal('edit', row.recordId)}
                  sx={{ color: T.textFaint, '&:hover': { color: T.success, bgcolor: `${T.success}15` } }}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton size="small" onClick={() => onDelete(row.recordId)}
                  sx={{ color: T.textFaint, '&:hover': { color: T.error, bgcolor: T.errorBg } }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>

            {/* Meta row: sync · files · on-rails · last synced */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1, pl: 4.25 }}>
              {meta
                ? <Chip label={meta.label} size="small" sx={{ bgcolor: `${meta.color}22`, color: meta.color, fontWeight: 700, fontSize: 10, height: 20 }} />
                : <Typography sx={{ fontSize: 11, color: T.textFaint }}>Not synced</Typography>}

              <Box onClick={() => openMediaFiles(row.recordId)}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                  color: count > 0 ? T.textPrimary : T.textFaint, '&:hover': { color: T.teal } }}>
                <VideoFileIcon sx={{ fontSize: 14 }} />
                <Typography sx={{ fontSize: 11 }}>
                  {count > 0 ? `${count} · ${fmtSize(Number(row.mediaTotalSize))}` : 'No files'}
                </Typography>
              </Box>

              <Tooltip title={hidden ? 'Hidden from rails (tap to show)' : 'On rails (tap to hide)'}>
                <span>
                  <IconButton size="small" disabled={visibilityMut.isPending}
                    onClick={() => visibilityMut.mutate({ id: row.recordId, hideFromRails: !hidden })}
                    sx={{ p: 0.25, color: hidden ? T.error : T.success }}>
                    {hidden ? <VisibilityOffIcon sx={{ fontSize: 15 }} /> : <VisibilityIcon sx={{ fontSize: 15 }} />}
                  </IconButton>
                </span>
              </Tooltip>

              {row.lastSyncedAt && (
                <Typography sx={{ fontSize: 10, color: T.textFaint }}>
                  · {formatDistanceToNow(new Date(row.lastSyncedAt), { addSuffix: true })}
                </Typography>
              )}
            </Box>

            {row.syncStatus === 'FAILED' && row.syncError && (
              <Typography sx={{ fontSize: 10, color: T.error, mt: 0.5, pl: 4.25,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.syncError}
              </Typography>
            )}

            {/* Tags */}
            <Box sx={{ mt: 0.75, pl: 4.25 }}>
              <RecordTagsInline record={row} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
