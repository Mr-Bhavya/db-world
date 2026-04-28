import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, Tooltip, Checkbox, IconButton,
  Button, TextField, InputAdornment, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Select, MenuItem, FormControl,
  InputLabel, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, Alert, Snackbar,
  CircularProgress, alpha, useMediaQuery, useTheme as useMuiTheme,
  Menu, ListItemIcon, ListItemText, Fab, Badge, Tab, Tabs,
  Skeleton, LinearProgress,
} from '@mui/material';
import {
  Search, Delete, Refresh, LinkOff, Link as LinkIcon,
  FolderOpen, VideoFile, AudioFile, Subtitles, Image as ImageIcon,
  FilterList, Sort, ViewList, GridView, Build, DeleteForever,
  LibraryAddCheck, CheckCircle, Cancel, Warning, Info, MoreVert,
  ContentCopy, Sync, CleaningServices, RestorePage, Dangerous,
  InsertDriveFile, TableRows, KeyboardArrowDown, Close, OpenInNew,
} from '@mui/icons-material';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import RecordSearch from '../ingestion/form/RecordSearch';
import {
  getMediaFilesPaged, getMediaFilesStats, getMediaFileDetail,
  deleteMediaFileById, bulkDeleteMediaFiles,
  repairSymlink, repairAllSymlinks, rebuildAllSymlinks,
  cleanupOrphanedFiles, rescanMediaFile, linkMediaFileToRecord,
} from '../api/adminApi';

// ─── helpers ──────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDuration(ms) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}

function resLabel(height) {
  if (!height) return null;
  if (height >= 2160) return '4K';
  if (height >= 1080) return '1080p';
  if (height >= 720)  return '720p';
  if (height >= 480)  return '480p';
  return `${height}p`;
}

function getExt(filePath) {
  if (!filePath) return '';
  return filePath.split('.').pop()?.toUpperCase() ?? '';
}

const TRACK_META = {
  General:  { color: 'default',   icon: InsertDriveFile, label: 'General' },
  Video:    { color: 'primary',   icon: VideoFile,       label: 'Video'   },
  Audio:    { color: 'success',   icon: AudioFile,       label: 'Audio'   },
  Text:     { color: 'warning',   icon: Subtitles,       label: 'Subtitle'},
  Image:    { color: 'secondary', icon: ImageIcon,       label: 'Image'   },
};

// ─── StatCard ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'text.secondary', loading }) {
  const T = useT();
  const bgMap = {
    'primary.main': '#0d9488', 'success.main': '#10b981', 'warning.main': '#f59e0b',
    'error.main': '#ef4444', 'secondary.main': '#8b5cf6',
  };
  const bgColor = bgMap[color] ?? T.border;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, flex: 1, minWidth: 100 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: alpha(bgColor, 0.12), display: 'flex', flexShrink: 0 }}>
          <Icon sx={{ fontSize: 18, color }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {loading
            ? <Skeleton width={40} height={24} />
            : <Typography variant="h6" fontWeight={700} lineHeight={1}>{value}</Typography>
          }
          <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

// ─── RawFieldGrid — key/value pairs from raw mediainfo ────────────────────

function RawFieldGrid({ data }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== '' && v !== undefined);
  if (entries.length === 0) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2px 12px' }}>
      {entries.map(([k, v]) => (
        <Stack key={k} direction="row" spacing={0.75} alignItems="baseline" sx={{ overflow: 'hidden', py: '1px' }}>
          <Typography variant="caption" color="text.secondary"
            sx={{ minWidth: 0, flexShrink: 0, maxWidth: '42%', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.68rem' }}>
            {k}
          </Typography>
          <Typography variant="caption" fontWeight={500}
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: '0.72rem' }}>
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

// ─── TrackDetailModal — opens on file click ───────────────────────────────

function TrackDetailModal({ fileId, onClose, onRescan, onRepair, onLink, onCopyPath, onDelete }) {
  const T = useT();
  const [tab, setTab] = useState(0);

  const { data: file, isLoading } = useQuery({
    queryKey: ['mediaFileDetail', fileId],
    queryFn: () => getMediaFileDetail(fileId),
    enabled: !!fileId,
    staleTime: 30_000,
  });

  useEffect(() => { setTab(0); }, [fileId]);

  const tabDefs = useMemo(() => {
    if (!file?.tracks) return [];
    const defs = [];
    const general = file.tracks.filter(t => t.type === 'General');
    defs.push({ label: 'General', tracks: general, icon: InsertDriveFile });
    const videos = file.tracks.filter(t => t.type === 'Video');
    if (videos.length) defs.push({ label: `Video (${videos.length})`, tracks: videos, icon: VideoFile });
    const audios = file.tracks.filter(t => t.type === 'Audio');
    if (audios.length) defs.push({ label: `Audio (${audios.length})`, tracks: audios, icon: AudioFile });
    const subs = file.tracks.filter(t => t.type === 'Text');
    if (subs.length) defs.push({ label: `Subtitle (${subs.length})`, tracks: subs, icon: Subtitles });
    const images = file.tracks.filter(t => t.type === 'Image');
    if (images.length) defs.push({ label: `Image (${images.length})`, tracks: images, icon: ImageIcon });
    return defs;
  }, [file?.tracks]);

  const safeTab = Math.min(tab, Math.max(0, tabDefs.length - 1));

  return (
    <Dialog open={!!fileId} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { maxHeight: '92vh', display: 'flex', flexDirection: 'column' } }}>

      {/* Header */}
      <DialogTitle sx={{ pb: 0.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap title={file?.fileName}>
              {isLoading ? <Skeleton width={260} /> : file?.fileName}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontFamily="monospace"
              sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isLoading ? <Skeleton width={340} /> : file?.filePath}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} flexShrink={0}>
            {file && <>
              <Tooltip title="Rescan metadata">
                <IconButton size="small" onClick={() => { onRescan(fileId); onClose(); }}><Refresh fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Repair symlink">
                <IconButton size="small" onClick={() => { onRepair(fileId); }}><Build fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Copy path">
                <IconButton size="small" onClick={() => onCopyPath(file?.filePath)}><ContentCopy fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => { onDelete([fileId]); onClose(); }}><Delete fontSize="small" /></IconButton>
              </Tooltip>
            </>}
            <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
          </Stack>
        </Stack>

        {/* File summary row */}
        {file && !isLoading && (
          <Stack direction="row" spacing={1} mt={0.75} flexWrap="wrap">
            <Chip label={getExt(file.fileName)} size="small" sx={{ height: 18, fontSize: '0.62rem' }} />
            <Chip label={fmtBytes(file.fileSize)} size="small" sx={{ height: 18, fontSize: '0.62rem' }} />
            {file.recordId
              ? <Chip icon={<CheckCircle sx={{ fontSize: '10px !important' }} />} label="Linked" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />
              : <Chip icon={<LinkOff sx={{ fontSize: '10px !important' }} />} label="Unlinked" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }}
                  onClick={() => onLink(fileId)} />
            }
            <Chip label={new Date(file.createdAt).toLocaleDateString()} size="small" variant="outlined"
              sx={{ height: 18, fontSize: '0.62rem' }} />
          </Stack>
        )}
      </DialogTitle>

      {/* Loading bar */}
      {isLoading && <LinearProgress sx={{ mx: 3 }} />}

      {/* Tabs */}
      {!isLoading && tabDefs.length > 0 && (
        <Tabs value={safeTab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40,
                '& .MuiTab-root': { minHeight: 40, fontSize: '0.75rem', py: 0.5 } }}>
          {tabDefs.map((td, i) => {
            const Ic = td.icon;
            return <Tab key={i} label={td.label} icon={<Ic sx={{ fontSize: 14 }} />} iconPosition="start" />;
          })}
        </Tabs>
      )}

      {/* Tab content */}
      <DialogContent sx={{ p: 0, overflow: 'auto', flex: 1 }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            {[...Array(8)].map((_, i) => <Skeleton key={i} height={20} sx={{ mb: 0.5 }} />)}
          </Box>
        ) : !file?.tracks?.length ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">
              No track data — use Rescan to populate.
            </Typography>
          </Box>
        ) : tabDefs[safeTab]?.tracks.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">No tracks of this type.</Typography>
          </Box>
        ) : (
          tabDefs[safeTab]?.tracks.map((track, i) => {
            const meta = TRACK_META[track.type] ?? TRACK_META.General;
            const Ic = meta.icon;
            return (
              <Box key={i} sx={{ p: 2, borderBottom: i < tabDefs[safeTab].tracks.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <Chip icon={<Ic sx={{ fontSize: '13px !important' }} />}
                    label={`${meta.label} ${i + 1}`}
                    size="small" color={meta.color} variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22 }} />
                  {track.defaultTrack === 'Yes' && <Chip label="default" size="small" sx={{ height: 18, fontSize: '0.62rem' }} />}
                  {track.forced === 'Yes' && <Chip label="forced" size="small" color="warning" sx={{ height: 18, fontSize: '0.62rem' }} />}
                  {track.language && <Chip label={track.language.toUpperCase()} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />}
                </Stack>
                <RawFieldGrid data={track.rawMediaInfo} />
              </Box>
            );
          })
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── DeleteDialog ─────────────────────────────────────────────────────────

function DeleteDialog({ open, count, onClose, onConfirm }) {
  const [purge, setPurge] = useState(false);
  const handleClose = () => { setPurge(false); onClose(); };
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete {count > 1 ? `${count} files` : 'file'}?</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Paper variant="outlined" onClick={() => setPurge(false)} sx={{ p: 1.5, cursor: 'pointer',
              borderColor: !purge ? 'primary.main' : undefined, bgcolor: !purge ? alpha('#0d9488', 0.06) : undefined }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <LibraryAddCheck color={!purge ? 'primary' : 'action'} />
              <Box>
                <Typography variant="body2" fontWeight={600}>Remove from library</Typography>
                <Typography variant="caption" color="text.secondary">Removes DB entry and symlink. File stays on disk.</Typography>
              </Box>
            </Stack>
          </Paper>
          <Paper variant="outlined" onClick={() => setPurge(true)} sx={{ p: 1.5, cursor: 'pointer',
              borderColor: purge ? 'error.main' : undefined, bgcolor: purge ? alpha('#ef4444', 0.06) : undefined }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DeleteForever color={purge ? 'error' : 'action'} />
              <Box>
                <Typography variant="body2" fontWeight={600} color={purge ? 'error' : undefined}>Delete permanently</Typography>
                <Typography variant="caption" color="text.secondary">
                  Removes DB entry, symlink, <strong>and the actual file</strong>. Cannot be undone.
                </Typography>
              </Box>
            </Stack>
          </Paper>
          {purge && (
            <Alert severity="error" icon={<Dangerous fontSize="small" />} sx={{ py: 0.5 }}>
              <Typography variant="caption">File{count > 1 ? 's' : ''} will be permanently erased from storage.</Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" color={purge ? 'error' : 'primary'}
          onClick={() => { onConfirm(purge); handleClose(); }}>
          {purge ? 'Delete permanently' : 'Remove from library'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── LinkRecordDialog ─────────────────────────────────────────────────────

function LinkRecordDialog({ open, fileId, onClose }) {
  const [record, setRecord] = useState(null);
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    if (!record) return;
    setLoading(true);
    try {
      await linkMediaFileToRecord(fileId, record.id);
      enqueueSnackbar('File linked to record', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['mediaFiles'] });
      qc.invalidateQueries({ queryKey: ['mediaFilesStats'] });
      qc.invalidateQueries({ queryKey: ['mediaFileDetail', fileId] });
      onClose();
      setRecord(null);
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Failed to link', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Link to Record</DialogTitle>
      <DialogContent><Box pt={1}><RecordSearch value={record} onChange={setRecord} /></Box></DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!record || loading}
          startIcon={loading ? <CircularProgress size={14} /> : <LinkIcon />}
          onClick={handleLink}>Link</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── FileRow — table row (no expand, click opens modal) ───────────────────

function FileRow({ file, selected, onSelect, onOpen, onDelete, onRescan, onRepair, onLink, onCopyPath }) {
  const T = useT();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const muiTheme = useMuiTheme();
  const isMd = useMediaQuery(muiTheme.breakpoints.up('md'));
  const isLg = useMediaQuery(muiTheme.breakpoints.up('lg'));

  const res   = resLabel(file.videoHeight);
  const isHdr = !!(file.hdrFormat);

  const rowSx = {
    cursor: 'pointer',
    '&:hover': { bgcolor: alpha(T.border, 0.12) },
    bgcolor: selected ? alpha(T.teal, 0.06) : undefined,
    transition: 'background 0.15s',
  };

  return (
    <TableRow sx={rowSx}>
      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
        <Checkbox size="small" checked={selected} onChange={() => onSelect(file.id)} />
      </TableCell>

      <TableCell onClick={() => onOpen(file.id)}>
        <Stack direction="row" spacing={1} alignItems="center">
          <InsertDriveFile sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap fontWeight={500} title={file.fileName}
              sx={{ maxWidth: { xs: 160, sm: 200, md: 260, lg: 340 } }}>
              {file.fileName}
            </Typography>
            <Stack direction="row" spacing={0.5} mt={0.2} flexWrap="wrap">
              <Chip label={getExt(file.fileName)} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
              {file.recordId
                ? <Chip icon={<CheckCircle sx={{ fontSize: '10px !important' }} />} label="Linked" size="small" color="success" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
                : <Chip icon={<LinkOff sx={{ fontSize: '10px !important' }} />} label="Unlinked" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
              }
            </Stack>
          </Box>
        </Stack>
      </TableCell>

      {isMd && (
        <TableCell onClick={() => onOpen(file.id)}>
          <Typography variant="caption" color="text.secondary">{fmtBytes(file.fileSize)}</Typography>
        </TableCell>
      )}

      {isMd && (
        <TableCell onClick={() => onOpen(file.id)}>
          <Typography variant="caption" color="text.secondary">{fmtDuration(file.duration)}</Typography>
        </TableCell>
      )}

      {isMd && (
        <TableCell onClick={() => onOpen(file.id)}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {res && <Chip label={res} size="small" color={res === '4K' ? 'secondary' : 'default'} sx={{ height: 18, fontSize: '0.65rem' }} />}
            {isHdr && <Chip label="HDR" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />}
            {file.videoCodec && <Chip label={file.videoCodec} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />}
          </Stack>
        </TableCell>
      )}

      {isLg && (
        <TableCell onClick={() => onOpen(file.id)}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {[file.audioFormat, file.audioChannels ? `${file.audioChannels}ch` : null,
              file.audioLanguage?.toUpperCase()].filter(Boolean).join(' · ') || '—'}
          </Typography>
        </TableCell>
      )}

      {isLg && (
        <TableCell onClick={() => onOpen(file.id)}>
          <Stack direction="row" spacing={0.5}>
            {file.videoCount > 0 && <Chip icon={<VideoFile sx={{ fontSize: '10px !important' }} />} label={file.videoCount} size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />}
            {file.audioCount > 0 && <Chip icon={<AudioFile sx={{ fontSize: '10px !important' }} />} label={file.audioCount} size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />}
            {file.textCount  > 0 && <Chip icon={<Subtitles  sx={{ fontSize: '10px !important' }} />} label={file.textCount}  size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.62rem' }} />}
          </Stack>
        </TableCell>
      )}

      {isLg && (
        <TableCell onClick={() => onOpen(file.id)}>
          <Typography variant="caption" color="text.secondary">
            {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : '—'}
          </Typography>
        </TableCell>
      )}

      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <Stack direction="row" justifyContent="flex-end">
          <Tooltip title="View details">
            <IconButton size="small" onClick={() => onOpen(file.id)}><OpenInNew fontSize="small" /></IconButton>
          </Tooltip>
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}><MoreVert fontSize="small" /></IconButton>
        </Stack>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
          <MenuItem onClick={() => { onRescan(file.id); setMenuAnchor(null); }}>
            <ListItemIcon><Refresh fontSize="small" /></ListItemIcon>
            <ListItemText>Rescan metadata</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { onRepair(file.id); setMenuAnchor(null); }}>
            <ListItemIcon><Build fontSize="small" /></ListItemIcon>
            <ListItemText>Repair symlink</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { onLink(file.id); setMenuAnchor(null); }}>
            <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Link to record</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { onCopyPath(file.filePath); setMenuAnchor(null); }}>
            <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
            <ListItemText>Copy path</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { onDelete([file.id]); setMenuAnchor(null); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>
      </TableCell>
    </TableRow>
  );
}

// ─── FileCard — grid / mobile card ────────────────────────────────────────

function FileCard({ file, selected, onSelect, onOpen, onDelete, onRescan, onRepair, onLink }) {
  const T = useT();
  const res   = resLabel(file.videoHeight);
  const isHdr = !!(file.hdrFormat);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
      borderColor: selected ? 'primary.main' : undefined,
      bgcolor: selected ? alpha(T.teal, 0.04) : undefined,
      '&:hover': { borderColor: 'primary.main', bgcolor: alpha(T.teal, 0.03) },
      transition: 'all 0.15s' }}
      onClick={() => onOpen(file.id)}>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.25, pb: 0.75 }}
        onClick={(e) => e.stopPropagation()}>
        <Checkbox size="small" checked={selected} onChange={() => onSelect(file.id)} sx={{ p: 0.5 }} />
        <InsertDriveFile sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
        <Typography variant="body2" fontWeight={600} noWrap flex={1} title={file.fileName}
          onClick={() => onOpen(file.id)} sx={{ cursor: 'pointer' }}>
          {file.fileName}
        </Typography>
        <IconButton size="small" onClick={() => onOpen(file.id)} sx={{ flexShrink: 0 }}>
          <OpenInNew fontSize="small" />
        </IconButton>
      </Stack>

      <Divider />

      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ px: 1.25, py: 0.75 }} onClick={() => onOpen(file.id)}>
        <Chip label={getExt(file.fileName)} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
        {res && <Chip label={res} size="small" color={res === '4K' ? 'secondary' : 'default'} sx={{ height: 18, fontSize: '0.65rem' }} />}
        {isHdr && <Chip label="HDR" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />}
        <Chip label={fmtBytes(file.fileSize)} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
        {fmtDuration(file.duration) !== '—' && <Chip label={fmtDuration(file.duration)} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        {file.recordId
          ? <Chip icon={<CheckCircle sx={{ fontSize: '10px !important' }} />} label="Linked" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
          : <Chip icon={<LinkOff sx={{ fontSize: '10px !important' }} />} label="Unlinked" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
        }
      </Stack>

      {file.audioFormat && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.25, pb: 0.5, display: 'block' }}>
          {[file.audioFormat, file.audioChannels ? `${file.audioChannels}ch` : null,
            file.audioLanguage?.toUpperCase()].filter(Boolean).join(' · ')}
        </Typography>
      )}

      <Divider />
      <Stack direction="row" justifyContent="flex-end" spacing={0.5} sx={{ px: 1, py: 0.5 }}
        onClick={(e) => e.stopPropagation()}>
        <Tooltip title="Rescan"><IconButton size="small" onClick={() => onRescan(file.id)}><Refresh fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Repair symlink"><IconButton size="small" onClick={() => onRepair(file.id)}><Build fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Link to record"><IconButton size="small" onClick={() => onLink(file.id)}><LinkIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => onDelete([file.id])}><Delete fontSize="small" /></IconButton></Tooltip>
      </Stack>
    </Paper>
  );
}

// ─── SkeletonRow / SkeletonCard ───────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell padding="checkbox"><Skeleton variant="rectangular" width={18} height={18} /></TableCell>
      <TableCell><Stack direction="row" spacing={1}><Skeleton variant="circular" width={18} height={18} /><Box><Skeleton width={180} height={16} /><Skeleton width={80} height={12} sx={{ mt: 0.5 }} /></Box></Stack></TableCell>
      <TableCell><Skeleton width={60} /></TableCell>
      <TableCell><Skeleton width={55} /></TableCell>
      <TableCell><Skeleton width={70} /></TableCell>
      <TableCell align="right"><Skeleton width={48} height={28} /></TableCell>
    </TableRow>
  );
}

function SkeletonCard() {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
      <Skeleton height={18} sx={{ mb: 0.5 }} />
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {[50, 40, 60, 55].map((w, i) => <Skeleton key={i} width={w} height={22} sx={{ borderRadius: 3 }} />)}
      </Stack>
    </Paper>
  );
}

// ─── MaintenanceMenu ──────────────────────────────────────────────────────

function MaintenanceMenu({ onRepairAll, onRebuild, onCleanup, onSync }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Button variant="outlined" size="small" startIcon={<Build />} endIcon={<KeyboardArrowDown />}
        onClick={(e) => setAnchor(e.currentTarget)}>
        Maintenance
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => { onSync(); setAnchor(null); }}>
          <ListItemIcon><Sync fontSize="small" /></ListItemIcon>
          <ListItemText primary="Sync (cleanup + repair)" secondary="Remove orphans, repair symlinks" />
        </MenuItem>
        <MenuItem onClick={() => { onRepairAll(); setAnchor(null); }}>
          <ListItemIcon><RestorePage fontSize="small" /></ListItemIcon>
          <ListItemText primary="Repair symlinks" />
        </MenuItem>
        <MenuItem onClick={() => { onRebuild(); setAnchor(null); }}>
          <ListItemIcon><Build fontSize="small" /></ListItemIcon>
          <ListItemText primary="Rebuild all symlinks" />
        </MenuItem>
        <MenuItem onClick={() => { onCleanup(); setAnchor(null); }}>
          <ListItemIcon><CleaningServices fontSize="small" /></ListItemIcon>
          <ListItemText primary="Cleanup orphaned entries" />
        </MenuItem>
      </Menu>
    </>
  );
}

// ─── MediaFilesPage (main export) ─────────────────────────────────────────

export default function MediaFilesPage() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const muiTheme = useMuiTheme();
  const isMd = useMediaQuery(muiTheme.breakpoints.up('md'));

  // ── state ──────────────────────────────────────────────────────────────
  const [search,       setSearch]      = useState('');
  const [debouncedQ,   setDebouncedQ]  = useState('');
  const [statusFilter, setStatusFilter]= useState('all');
  const [sort,         setSort]        = useState('newest');
  const [viewMode,     setViewMode]    = useState(isMd ? 'table' : 'grid');
  const [selected,     setSelected]    = useState(new Set());
  const [deleteTarget, setDeleteTarget]= useState(null);
  const [linkTarget,   setLinkTarget]  = useState(null);
  const [detailFileId, setDetailFileId]= useState(null);
  const [mainBusy,     setMainBusy]    = useState(false);

  const sentinelRef = useRef(null);

  // Debounce search → debouncedQ
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── infinite query ─────────────────────────────────────────────────────
  const linked = statusFilter === 'all' ? undefined : statusFilter === 'linked' ? true : false;
  const queryParams = { q: debouncedQ || undefined, linked, sort };

  const {
    data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error, refetch,
  } = useInfiniteQuery({
    queryKey: ['mediaFiles', queryParams],
    queryFn: ({ pageParam = 0 }) => getMediaFilesPaged({ ...queryParams, page: pageParam, size: 50 }),
    getNextPageParam: (lastPage) => lastPage.last ? undefined : lastPage.number + 1,
    staleTime: 60_000,
  });

  // ── stats query ────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['mediaFilesStats'],
    queryFn: getMediaFilesStats,
    staleTime: 30_000,
  });

  // Flatten all pages into a single list
  const files = useMemo(() => data?.pages?.flatMap(p => p.content) ?? [], [data]);
  const totalLoaded = files.length;
  const totalElements = data?.pages?.[0]?.totalElements ?? 0;

  // ── IntersectionObserver — auto-load next page ─────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── selection helpers ──────────────────────────────────────────────────
  const allSelected = files.length > 0 && files.every(f => selected.has(f.id));
  const toggleSelect = useCallback((id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }), []);
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(files.map(f => f.id)));
  const clearSelection = () => setSelected(new Set());

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mediaFiles'] });
    qc.invalidateQueries({ queryKey: ['mediaFilesStats'] });
  }, [qc]);

  // ── mutations ──────────────────────────────────────────────────────────
  const doDelete = useCallback(async (ids, purge) => {
    try {
      if (ids.length === 1) await deleteMediaFileById(ids[0], purge);
      else await bulkDeleteMediaFiles(ids, purge);
      enqueueSnackbar(`${ids.length} file(s) ${purge ? 'permanently deleted' : 'removed from library'}`, { variant: 'success' });
      invalidateAll();
      setSelected(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Delete failed', { variant: 'error' });
    }
  }, [enqueueSnackbar, invalidateAll]);

  const doRescan = useCallback(async (id) => {
    try {
      await rescanMediaFile(id);
      enqueueSnackbar('Rescan started', { variant: 'info' });
      setTimeout(() => { invalidateAll(); qc.invalidateQueries({ queryKey: ['mediaFileDetail', id] }); }, 2000);
    } catch { enqueueSnackbar('Rescan failed', { variant: 'error' }); }
  }, [enqueueSnackbar, invalidateAll, qc]);

  const doRepair = useCallback(async (id) => {
    try {
      await repairSymlink(id);
      enqueueSnackbar('Symlink repaired', { variant: 'success' });
    } catch { enqueueSnackbar('Repair failed', { variant: 'error' }); }
  }, [enqueueSnackbar]);

  const doCopyPath = useCallback((path) => {
    navigator.clipboard?.writeText(path ?? '');
    enqueueSnackbar('Path copied', { variant: 'info' });
  }, [enqueueSnackbar]);

  const doMaintenance = useCallback(async (action) => {
    setMainBusy(true);
    try {
      if (action === 'sync')    { await cleanupOrphanedFiles(); await repairAllSymlinks(false); enqueueSnackbar('Sync complete', { variant: 'success' }); }
      if (action === 'repair')  { await repairAllSymlinks(false); enqueueSnackbar('Symlinks repaired', { variant: 'success' }); }
      if (action === 'rebuild') { await rebuildAllSymlinks();     enqueueSnackbar('Symlinks rebuilt', { variant: 'success' }); }
      if (action === 'cleanup') { await cleanupOrphanedFiles();   enqueueSnackbar('Cleanup done', { variant: 'success' }); }
      invalidateAll();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Operation failed', { variant: 'error' });
    } finally { setMainBusy(false); }
  }, [enqueueSnackbar, invalidateAll]);

  // ── render ─────────────────────────────────────────────────────────────

  if (error) return <Alert severity="error" sx={{ m: 2 }}>Failed to load: {error.message}</Alert>;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, minHeight: '100vh' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"
        alignItems={{ sm: 'flex-start' }} mb={2} gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Media Files</Typography>
          <Typography variant="body2" color="text.secondary">
            {isLoading ? 'Loading…'
              : totalLoaded < totalElements
                ? `Showing ${totalLoaded} of ${totalElements} files · ${fmtBytes(stats?.totalSize)}`
                : `${totalElements} files · ${fmtBytes(stats?.totalSize)}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <MaintenanceMenu
            onSync={() => doMaintenance('sync')}
            onRepairAll={() => doMaintenance('repair')}
            onRebuild={() => doMaintenance('rebuild')}
            onCleanup={() => doMaintenance('cleanup')}
          />
          <Button variant="outlined" size="small"
            startIcon={mainBusy || isLoading ? <CircularProgress size={14} /> : <Refresh />}
            onClick={() => { invalidateAll(); }} disabled={isLoading || mainBusy}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
        <StatCard icon={InsertDriveFile} label="Total"    value={stats?.total   ?? '—'} loading={statsLoading} />
        <StatCard icon={CheckCircle}     label="Linked"   value={stats?.linked  ?? '—'} color="success.main"    loading={statsLoading} />
        <StatCard icon={LinkOff}         label="Unlinked" value={stats?.unlinked ?? '—'} color="warning.main"   loading={statsLoading} />
        <StatCard icon={VideoFile}       label="4K"       value={stats?.uhdCount ?? '—'} color="primary.main"   loading={statsLoading} />
        <StatCard icon={Warning}         label="HDR"      value={stats?.hdrCount ?? '—'} color="secondary.main" loading={statsLoading} />
        <StatCard icon={FolderOpen}      label="Size"     value={fmtBytes(stats?.totalSize)} loading={statsLoading} />
      </Stack>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap" gap={1}>
          <TextField size="small" placeholder="Search filename or path…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')}><Close fontSize="small" /></IconButton></InputAdornment> : null,
            }}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setSelected(new Set()); }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="linked">Linked</MenuItem>
                <MenuItem value="unlinked">Unlinked</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Sort</InputLabel>
              <Select value={sort} label="Sort" onChange={(e) => { setSort(e.target.value); setSelected(new Set()); }}>
                <MenuItem value="newest">Newest first</MenuItem>
                <MenuItem value="oldest">Oldest first</MenuItem>
                <MenuItem value="largest">Largest first</MenuItem>
                <MenuItem value="smallest">Smallest first</MenuItem>
                <MenuItem value="name-asc">Name A–Z</MenuItem>
                <MenuItem value="name-desc">Name Z–A</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
            <ToggleButton value="table"><Tooltip title="Table"><TableRows fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="grid"><Tooltip title="Grid"><GridView fontSize="small" /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        viewMode === 'table' ? (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small"><TableBody>{[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}</TableBody></Table>
          </TableContainer>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3,1fr)', lg: 'repeat(4,1fr)' }, gap: 1.5 }}>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </Box>
        )
      ) : files.length === 0 ? (
        <Stack alignItems="center" py={8} spacing={1}>
          <InsertDriveFile sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography color="text.secondary">
            {totalElements === 0 ? 'No media files found' : 'No files match the current filters'}
          </Typography>
        </Stack>
      ) : viewMode === 'table' ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem' } }}>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={allSelected}
                    indeterminate={selected.size > 0 && !allSelected} onChange={toggleAll} />
                </TableCell>
                <TableCell>File</TableCell>
                {isMd && <TableCell>Size</TableCell>}
                {isMd && <TableCell>Duration</TableCell>}
                {isMd && <TableCell>Quality</TableCell>}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map(file => (
                <FileRow key={file.id} file={file}
                  selected={selected.has(file.id)}
                  onSelect={toggleSelect}
                  onOpen={setDetailFileId}
                  onDelete={ids => setDeleteTarget(ids)}
                  onRescan={doRescan}
                  onRepair={doRepair}
                  onLink={id => setLinkTarget(id)}
                  onCopyPath={doCopyPath}
                />
              ))}
              {isFetchingNextPage && [...Array(3)].map((_, i) => <SkeletonRow key={`sk-${i}`} />)}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3,1fr)', lg: 'repeat(4,1fr)' }, gap: 1.5 }}>
          {files.map(file => (
            <FileCard key={file.id} file={file}
              selected={selected.has(file.id)}
              onSelect={toggleSelect}
              onOpen={setDetailFileId}
              onDelete={ids => setDeleteTarget(ids)}
              onRescan={doRescan}
              onRepair={doRepair}
              onLink={id => setLinkTarget(id)}
            />
          ))}
          {isFetchingNextPage && [...Array(4)].map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
        </Box>
      )}

      {/* Infinity scroll sentinel */}
      <Box ref={sentinelRef} sx={{ height: 40, mt: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {!isLoading && hasNextPage && !isFetchingNextPage && (
          <Typography variant="caption" color="text.disabled">Scroll to load more…</Typography>
        )}
        {!isLoading && !hasNextPage && files.length > 0 && (
          <Typography variant="caption" color="text.disabled">All {totalElements} files loaded</Typography>
        )}
      </Box>

      {/* ── Bulk action FAB ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1300 }}>
            <Paper elevation={6} sx={{ px: 2.5, py: 1.25, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" fontWeight={600}>{selected.size} selected</Typography>
              <Button size="small" color="error" variant="contained" startIcon={<Delete />}
                onClick={() => setDeleteTarget([...selected])}>Delete</Button>
              <Button size="small" variant="outlined" startIcon={<Close />} onClick={clearSelection}>Clear</Button>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      <TrackDetailModal
        fileId={detailFileId}
        onClose={() => setDetailFileId(null)}
        onRescan={doRescan}
        onRepair={doRepair}
        onLink={id => { setLinkTarget(id); }}
        onCopyPath={doCopyPath}
        onDelete={ids => setDeleteTarget(ids)}
      />

      <DeleteDialog
        open={!!deleteTarget}
        count={deleteTarget?.length ?? 0}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(purge) => doDelete(deleteTarget, purge)}
      />

      <LinkRecordDialog
        open={!!linkTarget}
        fileId={linkTarget}
        onClose={() => setLinkTarget(null)}
      />
    </Box>
  );
}
