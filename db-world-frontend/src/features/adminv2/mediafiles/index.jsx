import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, Tooltip, Checkbox, IconButton,
  Button, TextField, InputAdornment, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Collapse, Select, MenuItem,
  FormControl, InputLabel, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider,
  Accordion, AccordionSummary, AccordionDetails, Alert, Snackbar,
  CircularProgress, alpha, useMediaQuery, useTheme as useMuiTheme,
  Menu, ListItemIcon, ListItemText, Fab, Badge,
} from '@mui/material';
import {
  Search, Delete, Refresh, LinkOff, Link as LinkIcon,
  FolderOpen, VideoFile, AudioFile, Subtitles, Image as ImageIcon,
  ExpandMore, ExpandLess, FilterList, Sort, ViewList, GridView,
  Build, DeleteForever, LibraryAddCheck, CheckCircle, Cancel,
  Warning, Info, MoreVert, ContentCopy, Sync, CleaningServices,
  RestorePage, Dangerous, InsertDriveFile, TableRows,
  KeyboardArrowDown, Close,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import RecordSearch from '../ingestion/form/RecordSearch';
import {
  getAllMediaFiles, deleteMediaFileById, bulkDeleteMediaFiles,
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

function StatCard({ icon: Icon, label, value, color = 'text.secondary' }) {
  const T = useT();
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1, minWidth: 110 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: alpha(color === 'primary.main' ? '#0d9488' : color === 'success.main' ? '#10b981' : color === 'warning.main' ? '#f59e0b' : color === 'error.main' ? '#ef4444' : T.border, 0.12), display: 'flex' }}>
          <Icon sx={{ fontSize: 20, color }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700} lineHeight={1}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
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
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 0.5 }}>
      {entries.map(([k, v]) => (
        <Stack key={k} direction="row" spacing={0.75} alignItems="baseline" sx={{ overflow: 'hidden' }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, flexShrink: 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
            {k}
          </Typography>
          <Typography variant="caption" fontWeight={500} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

// ─── TrackSection — one accordion per track ───────────────────────────────

function TrackSection({ track, index }) {
  const T   = useT();
  const meta = TRACK_META[track.type] ?? TRACK_META.General;
  const Icon = meta.icon;

  const summary = useMemo(() => {
    const parts = [];
    if (track.format)           parts.push(track.format);
    if (track.width && track.height) parts.push(`${track.width}×${track.height}`);
    if (track.language)         parts.push(track.language.toUpperCase());
    if (track.channels)         parts.push(`${track.channels}ch`);
    if (track.bitDepth)         parts.push(`${track.bitDepth}-bit`);
    return parts.join(' · ');
  }, [track]);

  return (
    <Accordion disableGutters elevation={0}
      sx={{ border: `1px solid ${alpha(T.border, 0.5)}`, borderRadius: '8px !important', mb: 0.5,
            '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore fontSize="small" />} sx={{ minHeight: 40, px: 1.5,
        '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 } }}>
        <Chip icon={<Icon sx={{ fontSize: '14px !important' }} />}
          label={`${meta.label} ${index + 1}`}
          size="small"
          color={meta.color}
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 22 }}
        />
        {summary && <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>{summary}</Typography>}
        {track.defaultTrack && <Chip label="default" size="small" sx={{ height: 18, fontSize: '0.62rem' }} />}
        {track.forced && <Chip label="forced" size="small" color="warning" sx={{ height: 18, fontSize: '0.62rem' }} />}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
        <RawFieldGrid data={track.rawMediaInfo} />
      </AccordionDetails>
    </Accordion>
  );
}

// ─── FileDetailPanel — all tracks expanded ────────────────────────────────

function FileDetailPanel({ file }) {
  const T = useT();
  const byType = useMemo(() => {
    const m = {};
    (file.tracks ?? []).forEach((t) => {
      if (!m[t.type]) m[t.type] = [];
      m[t.type].push(t);
    });
    return m;
  }, [file.tracks]);

  const typeOrder = ['General', 'Video', 'Audio', 'Text', 'Image'];

  return (
    <Box sx={{ p: 2, bgcolor: alpha(T.adminBg, 0.5) }}>
      <Stack direction="row" spacing={1} mb={1.5} flexWrap="wrap">
        <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
          {file.filePath}
        </Typography>
      </Stack>
      {typeOrder.flatMap((type) => (byType[type] ?? []).map((track, i) => (
        <TrackSection key={`${type}-${i}`} track={track} index={i} />
      )))}
      {(!file.tracks || file.tracks.length === 0) && (
        <Typography variant="caption" color="text.secondary">No track data — rescan to populate.</Typography>
      )}
    </Box>
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
          <Paper
            variant="outlined"
            onClick={() => setPurge(false)}
            sx={{ p: 1.5, cursor: 'pointer', borderColor: !purge ? 'primary.main' : undefined,
                  bgcolor: !purge ? alpha('#0d9488', 0.06) : undefined }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <LibraryAddCheck color={!purge ? 'primary' : 'action'} />
              <Box>
                <Typography variant="body2" fontWeight={600}>Remove from library</Typography>
                <Typography variant="caption" color="text.secondary">
                  Removes DB entry and symlink. Actual file stays on disk.
                </Typography>
              </Box>
            </Stack>
          </Paper>
          <Paper
            variant="outlined"
            onClick={() => setPurge(true)}
            sx={{ p: 1.5, cursor: 'pointer', borderColor: purge ? 'error.main' : undefined,
                  bgcolor: purge ? alpha('#ef4444', 0.06) : undefined }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DeleteForever color={purge ? 'error' : 'action'} />
              <Box>
                <Typography variant="body2" fontWeight={600} color={purge ? 'error' : undefined}>
                  Delete permanently
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Removes DB entry, symlink, <strong>and the actual file from disk</strong>. Cannot be undone.
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

function LinkRecordDialog({ open, fileId, onClose, onDone }) {
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
      qc.invalidateQueries({ queryKey: ['allMediaFiles'] });
      onDone?.();
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
      <DialogContent>
        <Box pt={1}>
          <RecordSearch value={record} onChange={setRecord} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!record || loading}
          startIcon={loading ? <CircularProgress size={14} /> : <LinkIcon />}
          onClick={handleLink}>
          Link
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── FileRow — table row with expansion ───────────────────────────────────

function FileRow({ file, selected, onSelect, onDelete, onRescan, onRepair, onLink, onCopyPath }) {
  const T = useT();
  const [expanded, setExpanded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const muiTheme = useMuiTheme();
  const isMd = useMediaQuery(muiTheme.breakpoints.up('md'));
  const isLg = useMediaQuery(muiTheme.breakpoints.up('lg'));

  const video  = file.tracks?.find((t) => t.type === 'Video');
  const audio  = file.tracks?.find((t) => t.type === 'Audio' && t.defaultTrack) ?? file.tracks?.find((t) => t.type === 'Audio');
  const general = file.tracks?.find((t) => t.type === 'General');
  const res    = resLabel(video?.height);
  const isHdr  = !!(video?.hdrFormat);
  const trackCounts = useMemo(() => {
    const c = {};
    (file.tracks ?? []).forEach((t) => { if (t.type !== 'General') c[t.type] = (c[t.type] || 0) + 1; });
    return c;
  }, [file.tracks]);

  const rowSx = {
    cursor: 'pointer',
    '&:hover': { bgcolor: alpha(T.border, 0.12) },
    bgcolor: selected ? alpha(T.teal, 0.06) : undefined,
    transition: 'background 0.15s',
  };

  return (
    <>
      <TableRow sx={rowSx}>
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox size="small" checked={selected} onChange={() => onSelect(file.id)} />
        </TableCell>

        {/* File info — always visible */}
        <TableCell onClick={() => setExpanded((v) => !v)}>
          <Stack direction="row" spacing={1} alignItems="center">
            <InsertDriveFile sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap fontWeight={500} title={file.fileName}
                sx={{ maxWidth: { xs: 160, sm: 220, md: 280, lg: 360 } }}>
                {file.fileName}
              </Typography>
              <Stack direction="row" spacing={0.5} mt={0.25} flexWrap="wrap">
                <Chip label={getExt(file.fileName)} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                {file.recordId
                  ? <Chip icon={<CheckCircle sx={{ fontSize: '10px !important' }} />} label={file.recordName ?? 'Linked'} size="small" color="success" variant="outlined" sx={{ height: 16, fontSize: '0.6rem', maxWidth: 140 }} />
                  : <Chip icon={<LinkOff sx={{ fontSize: '10px !important' }} />} label="Unlinked" size="small" color="default" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
                }
              </Stack>
            </Box>
          </Stack>
        </TableCell>

        {isMd && <TableCell onClick={() => setExpanded((v) => !v)}>
          <Typography variant="caption" color="text.secondary">{fmtBytes(file.fileSize)}</Typography>
        </TableCell>}

        {isMd && <TableCell onClick={() => setExpanded((v) => !v)}>
          <Typography variant="caption" color="text.secondary">{fmtDuration(general?.duration)}</Typography>
        </TableCell>}

        {isMd && <TableCell onClick={() => setExpanded((v) => !v)}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {res && <Chip label={res} size="small" color={res === '4K' ? 'secondary' : 'default'} sx={{ height: 18, fontSize: '0.65rem' }} />}
            {isHdr && <Chip label="HDR" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />}
          </Stack>
        </TableCell>}

        {isLg && <TableCell onClick={() => setExpanded((v) => !v)}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {[audio?.format, audio?.channels ? `${audio.channels}ch` : null, audio?.language?.toUpperCase()].filter(Boolean).join(' · ') || '—'}
          </Typography>
        </TableCell>}

        {isLg && <TableCell onClick={() => setExpanded((v) => !v)}>
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {Object.entries(trackCounts).map(([type, n]) => {
              const m = TRACK_META[type] ?? TRACK_META.General;
              const Ic = m.icon;
              return (
                <Chip key={type} icon={<Ic sx={{ fontSize: '10px !important' }} />}
                  label={n} size="small" color={m.color} variant="outlined"
                  sx={{ height: 18, fontSize: '0.62rem' }} />
              );
            })}
          </Stack>
        </TableCell>}

        {isLg && <TableCell onClick={() => setExpanded((v) => !v)}>
          <Typography variant="caption" color="text.secondary">
            {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : '—'}
          </Typography>
        </TableCell>}

        {/* Actions */}
        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
          <Stack direction="row" justifyContent="flex-end">
            <Tooltip title="Expand tracks">
              <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
                {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVert fontSize="small" />
            </IconButton>
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

      {/* Expand row */}
      <TableRow>
        <TableCell colSpan={20} sx={{ p: 0, border: 0 }}>
          <Collapse in={expanded} unmountOnExit>
            <FileDetailPanel file={file} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ─── FileCard — grid / mobile card ────────────────────────────────────────

function FileCard({ file, selected, onSelect, onDelete, onRescan, onRepair, onLink }) {
  const T = useT();
  const [expanded, setExpanded] = useState(false);
  const video   = file.tracks?.find((t) => t.type === 'Video');
  const audio   = file.tracks?.find((t) => t.type === 'Audio' && t.defaultTrack) ?? file.tracks?.find((t) => t.type === 'Audio');
  const general = file.tracks?.find((t) => t.type === 'General');
  const res     = resLabel(video?.height);
  const isHdr   = !!(video?.hdrFormat);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden',
      borderColor: selected ? 'primary.main' : undefined,
      bgcolor: selected ? alpha(T.teal, 0.04) : undefined }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.25, pb: 0.75 }}>
        <Checkbox size="small" checked={selected} onChange={() => onSelect(file.id)} sx={{ p: 0.5 }} />
        <InsertDriveFile sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
        <Typography variant="body2" fontWeight={600} noWrap flex={1} title={file.fileName}>{file.fileName}</Typography>
        <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Stack>

      <Divider />

      {/* Meta row */}
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ px: 1.25, py: 0.75 }}>
        <Chip label={getExt(file.fileName)} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
        {res && <Chip label={res} size="small" sx={{ height: 18, fontSize: '0.65rem' }} color={res === '4K' ? 'secondary' : 'default'} />}
        {isHdr && <Chip label="HDR" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />}
        <Chip label={fmtBytes(file.fileSize)} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
        {fmtDuration(general?.duration) !== '—' && <Chip label={fmtDuration(general?.duration)} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        {file.recordId
          ? <Chip icon={<CheckCircle sx={{ fontSize: '10px !important' }} />} label="Linked" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
          : <Chip icon={<LinkOff sx={{ fontSize: '10px !important' }} />} label="Unlinked" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
        }
      </Stack>

      {audio && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.25, pb: 0.5, display: 'block' }}>
          🔊 {[audio.format, audio.channels ? `${audio.channels}ch` : null, audio.language?.toUpperCase()].filter(Boolean).join(' · ')}
        </Typography>
      )}

      {/* Expanded track detail */}
      <Collapse in={expanded} unmountOnExit>
        <Divider />
        <FileDetailPanel file={file} />
      </Collapse>

      {/* Actions */}
      <Divider />
      <Stack direction="row" justifyContent="flex-end" spacing={0.5} sx={{ px: 1, py: 0.5 }}>
        <Tooltip title="Rescan"><IconButton size="small" onClick={() => onRescan(file.id)}><Refresh fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Repair symlink"><IconButton size="small" onClick={() => onRepair(file.id)}><Build fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Link to record"><IconButton size="small" onClick={() => onLink(file.id)}><LinkIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => onDelete([file.id])}><Delete fontSize="small" /></IconButton></Tooltip>
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
          <ListItemText primary="Sync (cleanup + repair)" secondary="Removes orphans, repairs broken symlinks" />
        </MenuItem>
        <MenuItem onClick={() => { onRepairAll(); setAnchor(null); }}>
          <ListItemIcon><RestorePage fontSize="small" /></ListItemIcon>
          <ListItemText primary="Repair symlinks" secondary="Create missing / remove orphan symlinks" />
        </MenuItem>
        <MenuItem onClick={() => { onRebuild(); setAnchor(null); }}>
          <ListItemIcon><Build fontSize="small" /></ListItemIcon>
          <ListItemText primary="Rebuild all symlinks" secondary="Delete and recreate every symlink" />
        </MenuItem>
        <MenuItem onClick={() => { onCleanup(); setAnchor(null); }}>
          <ListItemIcon><CleaningServices fontSize="small" /></ListItemIcon>
          <ListItemText primary="Cleanup orphaned entries" secondary="Remove DB entries for missing files" />
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
  const isSm = useMediaQuery(muiTheme.breakpoints.up('sm'));
  const isMd = useMediaQuery(muiTheme.breakpoints.up('md'));
  const isLg = useMediaQuery(muiTheme.breakpoints.up('lg'));

  // ── state ──────────────────────────────────────────────────────────────
  const [search,       setSearch]      = useState('');
  const [statusFilter, setStatusFilter]= useState('all');
  const [resFilter,    setResFilter]   = useState('all');
  const [hdrFilter,    setHdrFilter]   = useState('all');
  const [sort,         setSort]        = useState('newest');
  const [viewMode,     setViewMode]    = useState(isMd ? 'table' : 'grid');
  const [selected,     setSelected]    = useState(new Set());
  const [deleteTarget, setDeleteTarget]= useState(null); // array of ids
  const [linkTarget,   setLinkTarget]  = useState(null); // file id
  const [mainBusy,     setMainBusy]    = useState(false);

  // ── data ───────────────────────────────────────────────────────────────
  const { data: rawFiles = [], isLoading, error, refetch } = useQuery({
    queryKey: ['allMediaFiles'],
    queryFn: getAllMediaFiles,
  });

  // ── stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const linked   = rawFiles.filter((f) => f.recordId).length;
    const total    = rawFiles.length;
    const totalSz  = rawFiles.reduce((s, f) => s + (f.fileSize ?? 0), 0);
    const hdr      = rawFiles.filter((f) => f.tracks?.some((t) => t.type === 'Video' && t.hdrFormat)).length;
    const uhd      = rawFiles.filter((f) => f.tracks?.some((t) => t.type === 'Video' && (t.height ?? 0) >= 2160)).length;
    return { total, linked, unlinked: total - linked, totalSz, hdr, uhd };
  }, [rawFiles]);

  // ── filtered + sorted ──────────────────────────────────────────────────
  const files = useMemo(() => {
    let list = [...rawFiles];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((f) => f.fileName?.toLowerCase().includes(q) || f.recordName?.toLowerCase().includes(q) || f.filePath?.toLowerCase().includes(q));
    if (statusFilter === 'linked')   list = list.filter((f) =>  f.recordId);
    if (statusFilter === 'unlinked') list = list.filter((f) => !f.recordId);
    if (resFilter !== 'all') {
      list = list.filter((f) => {
        const h = f.tracks?.find((t) => t.type === 'Video')?.height ?? 0;
        if (resFilter === '4K')   return h >= 2160;
        if (resFilter === '1080') return h >= 1080 && h < 2160;
        if (resFilter === '720')  return h >= 720  && h < 1080;
        if (resFilter === 'sd')   return h > 0 && h < 720;
        return true;
      });
    }
    if (hdrFilter === 'hdr') list = list.filter((f) => f.tracks?.some((t) => t.type === 'Video' && t.hdrFormat));
    if (hdrFilter === 'sdr') list = list.filter((f) => !f.tracks?.some((t) => t.type === 'Video' && t.hdrFormat));
    list.sort((a, b) => {
      if (sort === 'newest')   return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
      if (sort === 'oldest')   return new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0);
      if (sort === 'largest')  return (b.fileSize ?? 0) - (a.fileSize ?? 0);
      if (sort === 'smallest') return (a.fileSize ?? 0) - (b.fileSize ?? 0);
      if (sort === 'name-asc') return (a.fileName ?? '').localeCompare(b.fileName ?? '');
      if (sort === 'name-desc')return (b.fileName ?? '').localeCompare(a.fileName ?? '');
      return 0;
    });
    return list;
  }, [rawFiles, search, statusFilter, resFilter, hdrFilter, sort]);

  // ── selection helpers ──────────────────────────────────────────────────
  const allSelected = files.length > 0 && files.every((f) => selected.has(f.id));
  const toggleSelect = useCallback((id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }), []);
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(files.map((f) => f.id)));
  const clearSelection = () => setSelected(new Set());

  // ── mutations ──────────────────────────────────────────────────────────
  const doDelete = useCallback(async (ids, purge) => {
    try {
      if (ids.length === 1) await deleteMediaFileById(ids[0], purge);
      else await bulkDeleteMediaFiles(ids, purge);
      enqueueSnackbar(`${ids.length} file(s) ${purge ? 'permanently deleted' : 'removed from library'}`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['allMediaFiles'] });
      setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Delete failed', { variant: 'error' });
    }
  }, [enqueueSnackbar, qc]);

  const doRescan = useCallback(async (id) => {
    try {
      await rescanMediaFile(id);
      enqueueSnackbar('Rescan started', { variant: 'info' });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['allMediaFiles'] }), 2000);
    } catch (e) {
      enqueueSnackbar('Rescan failed', { variant: 'error' });
    }
  }, [enqueueSnackbar, qc]);

  const doRepair = useCallback(async (id) => {
    try {
      await repairSymlink(id);
      enqueueSnackbar('Symlink repaired', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar('Repair failed', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const doCopyPath = useCallback((path) => {
    navigator.clipboard?.writeText(path ?? '');
    enqueueSnackbar('Path copied', { variant: 'info' });
  }, [enqueueSnackbar]);

  const doMaintenance = useCallback(async (action) => {
    setMainBusy(true);
    try {
      let res;
      if (action === 'sync') {
        await cleanupOrphanedFiles();
        res = await repairAllSymlinks(false);
        enqueueSnackbar('Sync complete: orphans cleaned + symlinks repaired', { variant: 'success' });
      } else if (action === 'repair') {
        res = await repairAllSymlinks(false);
        enqueueSnackbar(`Symlinks repaired: ${res?.data?.created ?? 0} created, ${res?.data?.removed ?? 0} removed`, { variant: 'success' });
      } else if (action === 'rebuild') {
        res = await rebuildAllSymlinks();
        enqueueSnackbar('Symlinks rebuilt', { variant: 'success' });
      } else if (action === 'cleanup') {
        res = await cleanupOrphanedFiles();
        enqueueSnackbar(`Cleanup: ${res?.data?.removed ?? 0} orphaned entries removed`, { variant: 'success' });
      }
      qc.invalidateQueries({ queryKey: ['allMediaFiles'] });
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Operation failed', { variant: 'error' });
    } finally {
      setMainBusy(false);
    }
  }, [enqueueSnackbar, qc]);

  // ── render ─────────────────────────────────────────────────────────────

  if (error) return (
    <Alert severity="error" sx={{ m: 2 }}>Failed to load media files: {error.message}</Alert>
  );

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, minHeight: '100vh' }}>
      {/* ── Page header ───────────────────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2.5} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Media Files</Typography>
          <Typography variant="body2" color="text.secondary">
            {isLoading ? 'Loading…' : `${stats.total} files · ${fmtBytes(stats.totalSz)}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <MaintenanceMenu
            onSync={() => doMaintenance('sync')}
            onRepairAll={() => doMaintenance('repair')}
            onRebuild={() => doMaintenance('rebuild')}
            onCleanup={() => doMaintenance('cleanup')}
          />
          <Button variant="outlined" size="small" startIcon={mainBusy || isLoading ? <CircularProgress size={14} /> : <Refresh />}
            onClick={() => refetch()} disabled={isLoading || mainBusy}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <Stack direction="row" flexWrap="wrap" gap={1.5} mb={2.5}>
        <StatCard icon={InsertDriveFile} label="Total files"  value={stats.total}          color="text.secondary" />
        <StatCard icon={CheckCircle}     label="Linked"       value={stats.linked}          color="success.main" />
        <StatCard icon={LinkOff}         label="Unlinked"     value={stats.unlinked}        color="warning.main" />
        <StatCard icon={VideoFile}       label="4K files"     value={stats.uhd}             color="primary.main" />
        <StatCard icon={Warning}         label="HDR"          value={stats.hdr}             color="secondary.main" />
        <StatCard icon={FolderOpen}      label="Total size"   value={fmtBytes(stats.totalSz)} color="text.secondary" />
      </Stack>

      {/* ── Filters + toolbar ─────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap" gap={1}>
          <TextField
            size="small"
            placeholder="Search filename, record, path…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')}><Close fontSize="small" /></IconButton></InputAdornment> : null }}
            sx={{ flex: 1, minWidth: 200 }}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="linked">Linked</MenuItem>
                <MenuItem value="unlinked">Unlinked</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Resolution</InputLabel>
              <Select value={resFilter} label="Resolution" onChange={(e) => setResFilter(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="4K">4K</MenuItem>
                <MenuItem value="1080">1080p</MenuItem>
                <MenuItem value="720">720p</MenuItem>
                <MenuItem value="sd">SD</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 90 }}>
              <InputLabel>HDR</InputLabel>
              <Select value={hdrFilter} label="HDR" onChange={(e) => setHdrFilter(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="hdr">HDR only</MenuItem>
                <MenuItem value="sdr">SDR only</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Sort</InputLabel>
              <Select value={sort} label="Sort" onChange={(e) => setSort(e.target.value)}>
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

        {files.length !== rawFiles.length && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
            Showing {files.length} of {rawFiles.length} files
          </Typography>
        )}
      </Paper>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <Stack alignItems="center" py={8}><CircularProgress /></Stack>
      ) : files.length === 0 ? (
        <Stack alignItems="center" py={8} spacing={1}>
          <InsertDriveFile sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography color="text.secondary">{rawFiles.length === 0 ? 'No media files found' : 'No files match the current filters'}</Typography>
        </Stack>
      ) : viewMode === 'table' ? (
        /* ── Table view ─────────────────────────────────────────────── */
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem' } }}>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={allSelected} indeterminate={selected.size > 0 && !allSelected} onChange={toggleAll} />
                </TableCell>
                <TableCell>File</TableCell>
                {isMd && <TableCell>Size</TableCell>}
                {isMd && <TableCell>Duration</TableCell>}
                {isMd && <TableCell>Quality</TableCell>}
                {isLg && <TableCell>Audio</TableCell>}
                {isLg && <TableCell>Tracks</TableCell>}
                {isLg && <TableCell>Added</TableCell>}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    selected={selected.has(file.id)}
                    onSelect={toggleSelect}
                    onDelete={(ids) => setDeleteTarget(ids)}
                    onRescan={doRescan}
                    onRepair={doRepair}
                    onLink={(id) => setLinkTarget(id)}
                    onCopyPath={doCopyPath}
                  />
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* ── Grid view ──────────────────────────────────────────────── */
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              selected={selected.has(file.id)}
              onSelect={toggleSelect}
              onDelete={(ids) => setDeleteTarget(ids)}
              onRescan={doRescan}
              onRepair={doRepair}
              onLink={(id) => setLinkTarget(id)}
            />
          ))}
        </Box>
      )}

      {/* ── Bulk action FAB ───────────────────────────────────────────── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1300 }}>
            <Paper elevation={6} sx={{ px: 2.5, py: 1.25, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" fontWeight={600}>{selected.size} selected</Typography>
              <Button size="small" color="error" variant="contained" startIcon={<Delete />}
                onClick={() => setDeleteTarget([...selected])}>
                Delete
              </Button>
              <Button size="small" variant="outlined" startIcon={<Close />} onClick={clearSelection}>
                Clear
              </Button>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dialogs ───────────────────────────────────────────────────── */}
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
