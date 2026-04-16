import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, IconButton,
  Button, TextField, InputAdornment, Chip, Tooltip, Checkbox,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, LinearProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, FormControl,
  InputLabel, Select, MenuItem, ToggleButton, ToggleButtonGroup,
  Collapse, Divider,
} from '@mui/material';
import {
  Search, Clear, Refresh, Delete, Build, LinkOff,
  VideoFile, GridView, ViewList, ExpandMore, ExpandLess,
  ContentCopy, CheckCircle, Warning, Error as ErrorIcon,
  CleaningServices, SwapHoriz, Storage, Movie, PlayArrow,
  Audiotrack, Subtitles, FolderOpen, Info,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { getFieldSx } from '@shared/theme';
import {
  getAllMediaFiles, deleteMediaFileById, bulkDeleteMediaFiles,
  cleanupOrphanedFiles, repairAllSymlinks, repairSymlink,
  rebuildAllSymlinks, rescanMediaFile, linkMediaFileToRecord,
} from '../api/adminApi';
import { adminSearchRecord } from '@shared/services/ApiServices';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const fmtSize = (b) => {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

const fmtDuration = (ms) => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
};

const fmtBitrate = (bps) => {
  if (!bps) return null;
  return bps >= 1_000_000 ? `${(bps / 1_000_000).toFixed(1)} Mbps` : `${Math.round(bps / 1000)} kbps`;
};

const getResolution = (tracks) => {
  const v = tracks?.find(t => t.type === 'Video');
  if (!v) return null;
  if (v.width >= 3840) return '4K';
  if (v.width >= 1920) return '1080p';
  if (v.width >= 1280) return '720p';
  if (v.width >= 854) return '480p';
  return `${v.width}p`;
};

const getQualityColor = (res) => {
  if (res === '4K') return '#a78bfa';
  if (res === '1080p') return '#10b981';
  if (res === '720p') return '#3b82f6';
  return '#6b7280';
};

/* ── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, icon, color }) {
  const T = useT();
  return (
    <Card sx={{ border: `1px solid ${color}33`, borderRadius: 2, bgcolor: T.glass }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ color }}>{icon}</Box>
          <Typography sx={{ fontSize: '0.68rem', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>
          {value ?? '—'}
        </Typography>
      </CardContent>
    </Card>
  );
}

/* ── Track detail row ────────────────────────────────────────────────────── */

function TrackChips({ tracks }) {
  const T = useT();
  if (!tracks?.length) return <Typography sx={{ fontSize: 11, color: T.textFaint }}>No track info</Typography>;

  const video = tracks.filter(t => t.type === 'Video');
  const audio = tracks.filter(t => t.type === 'Audio');
  const subs  = tracks.filter(t => t.type === 'Text');

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
      {video.map((t, i) => (
        <Chip key={i} size="small" icon={<PlayArrow sx={{ fontSize: 11 }} />}
          label={[t.format, t.width && `${t.width}×${t.height}`, fmtBitrate(t.bitRate)].filter(Boolean).join(' · ')}
          sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981', '& .MuiChip-icon': { color: '#10b981' } }} />
      ))}
      {audio.map((t, i) => (
        <Chip key={i} size="small" icon={<Audiotrack sx={{ fontSize: 11 }} />}
          label={[t.format, t.language, t.channels && `${t.channels}ch`].filter(Boolean).join(' · ')}
          sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6', '& .MuiChip-icon': { color: '#3b82f6' } }} />
      ))}
      {subs.map((t, i) => (
        <Chip key={i} size="small" icon={<Subtitles sx={{ fontSize: 11 }} />}
          label={t.language ?? 'Sub'}
          sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(167,139,250,0.12)', color: '#a78bfa', '& .MuiChip-icon': { color: '#a78bfa' } }} />
      ))}
    </Box>
  );
}

/* ── Expand detail panel ─────────────────────────────────────────────────── */

function FileDetailPanel({ file, T }) {
  const tracks = file.tracks ?? file.trackInfos ?? [];
  const video  = tracks.find(t => t.type === 'Video');
  const audio  = tracks.filter(t => t.type === 'Audio');
  const subs   = tracks.filter(t => t.type === 'Text');

  return (
    <Box sx={{ px: 2, pb: 2, bgcolor: T.glass, borderTop: `1px solid ${T.border}` }}>
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={4}>
          <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>File Info</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
            <InfoRow label="Path"     value={file.filePath} mono T={T} />
            <InfoRow label="Size"     value={fmtSize(file.fileSize)} T={T} />
            <InfoRow label="Duration" value={fmtDuration(file.duration ?? file.durationMs)} T={T} />
            <InfoRow label="Format"   value={file.format ?? file.container} T={T} />
            <InfoRow label="Bitrate"  value={fmtBitrate(file.overallBitRate ?? file.bitRate)} T={T} />
            <InfoRow label="Record"   value={file.recordId ? `#${file.recordId}` : '—'} T={T} />
          </Box>
        </Grid>
        {video && (
          <Grid item xs={12} md={4}>
            <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Video</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
              <InfoRow label="Codec"      value={video.format} T={T} />
              <InfoRow label="Resolution" value={video.width && `${video.width}×${video.height}`} T={T} />
              <InfoRow label="Frame rate" value={video.frameRate && `${video.frameRate} fps`} T={T} />
              <InfoRow label="Bitrate"    value={fmtBitrate(video.bitRate)} T={T} />
              <InfoRow label="Bit depth"  value={video.bitDepth && `${video.bitDepth}-bit`} T={T} />
            </Box>
          </Grid>
        )}
        {(audio.length > 0 || subs.length > 0) && (
          <Grid item xs={12} md={4}>
            {audio.length > 0 && (
              <>
                <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Audio ({audio.length})</Typography>
                {audio.map((a, i) => (
                  <Box key={i} sx={{ mb: 0.5 }}>
                    <InfoRow label={`Track ${i + 1}`} value={[a.format, a.language, a.channels && `${a.channels}ch`, fmtBitrate(a.bitRate)].filter(Boolean).join(' · ')} T={T} />
                  </Box>
                ))}
              </>
            )}
            {subs.length > 0 && (
              <>
                <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, mb: 0.5, mt: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subtitles ({subs.length})</Typography>
                {subs.map((s, i) => (
                  <InfoRow key={i} label={`Sub ${i + 1}`} value={s.language ?? s.title ?? '—'} T={T} />
                ))}
              </>
            )}
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

function InfoRow({ label, value, mono, T }) {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint, minWidth: 72, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, color: T.textMuted, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
}

/* ── Link-to-record dialog ───────────────────────────────────────────────── */

function LinkRecordDialog({ file, open, onClose, onLinked }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await adminSearchRecord(query);
      setResults(res?.data?.content ?? res?.data?.data ?? res?.data ?? []);
    } catch { setResults([]); }
    setSearching(false);
  };

  const doLink = async (recordId) => {
    setLinking(true);
    try {
      await linkMediaFileToRecord(file.id ?? file.mediaFileId, recordId);
      enqueueSnackbar('File linked to record', { variant: 'success' });
      onLinked();
      onClose();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Link failed', { variant: 'error' });
    }
    setLinking(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ color: T.text, borderBottom: `1px solid ${T.border}`, pb: 1.5 }}>
        Link to Record
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 12, color: T.textMuted, mb: 1.5 }}>
          File: <span style={{ color: T.text, fontFamily: 'monospace' }}>{file?.fileName ?? file?.filePath?.split('/').pop()}</span>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" fullWidth placeholder="Search records…" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            sx={getFieldSx(T)} />
          <Button variant="outlined" onClick={doSearch} disabled={searching}
            sx={{ borderColor: T.border, color: T.textMuted, minWidth: 80 }}>
            {searching ? <CircularProgress size={16} /> : 'Search'}
          </Button>
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 300, overflowY: 'auto' }}>
          {results.map(r => (
            <Box key={r.recordId} onClick={() => !linking && doLink(r.recordId)}
              sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${T.border}`, cursor: 'pointer',
                bgcolor: T.glass, '&:hover': { bgcolor: T.glassHover, borderColor: T.teal } }}>
              <Typography sx={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{r.name}</Typography>
              <Typography sx={{ fontSize: 11, color: T.textMuted }}>{r.type} · {r.year}</Typography>
            </Box>
          ))}
          {results.length === 0 && query && !searching && (
            <Typography sx={{ fontSize: 12, color: T.textFaint, textAlign: 'center', py: 2 }}>No results</Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${T.border}`, px: 2, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── Confirm dialog ──────────────────────────────────────────────────────── */

function ConfirmDialog({ open, title, message, onConfirm, onClose, loading, danger }) {
  const T = useT();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ color: T.text }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: T.textMuted, fontSize: 14 }}>{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm} disabled={loading}
          sx={{ bgcolor: danger ? '#ef4444' : '#0d9488', '&:hover': { bgcolor: danger ? '#dc2626' : '#0f766e' } }}>
          {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── File row (table) ────────────────────────────────────────────────────── */

function FileRow({ file, selected, onSelect, onAction, T }) {
  const [expanded, setExpanded] = useState(false);
  const tracks = file.tracks ?? file.trackInfos ?? [];
  const resolution = getResolution(tracks);
  const name = file.fileName ?? file.filePath?.split(/[/\\]/).pop() ?? '—';
  const hasRecord = Boolean(file.recordId);

  return (
    <>
      <TableRow
        hover
        sx={{
          cursor: 'pointer',
          bgcolor: selected ? `${T.teal}12` : 'inherit',
          '&:hover': { bgcolor: T.glassHover },
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox checked={selected} onChange={() => onSelect(file)}
            sx={{ color: T.textFaint, '&.Mui-checked': { color: T.teal } }} />
        </TableCell>
        <TableCell onClick={() => setExpanded(p => !p)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VideoFile sx={{ fontSize: 16, color: T.textFaint, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, color: T.text, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                {name}
              </Typography>
              {file.recordName && (
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>
                  {file.recordName}
                </Typography>
              )}
            </Box>
          </Box>
        </TableCell>
        <TableCell onClick={() => setExpanded(p => !p)}>
          {resolution ? (
            <Chip label={resolution} size="small"
              sx={{ fontSize: 10, height: 20, bgcolor: `${getQualityColor(resolution)}22`, color: getQualityColor(resolution) }} />
          ) : <Typography sx={{ fontSize: 12, color: T.textFaint }}>—</Typography>}
        </TableCell>
        <TableCell onClick={() => setExpanded(p => !p)}>
          <Typography sx={{ fontSize: 12, color: T.textMuted }}>{fmtSize(file.fileSize)}</Typography>
        </TableCell>
        <TableCell onClick={() => setExpanded(p => !p)}>
          <Typography sx={{ fontSize: 12, color: T.textMuted }}>{fmtDuration(file.duration ?? file.durationMs)}</Typography>
        </TableCell>
        <TableCell onClick={() => setExpanded(p => !p)}>
          <Chip
            label={hasRecord ? `#${file.recordId}` : 'Unlinked'}
            size="small"
            sx={{ fontSize: 10, height: 20,
              bgcolor: hasRecord ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
              color: hasRecord ? '#10b981' : '#f59e0b' }}
          />
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Tooltip title="Rescan media info">
              <IconButton size="small" onClick={() => onAction('rescan', file)}
                sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                <Refresh sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Repair symlink">
              <IconButton size="small" onClick={() => onAction('repairSymlink', file)}
                sx={{ color: T.textFaint, '&:hover': { color: '#f59e0b' } }}>
                <Build sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Link to record">
              <IconButton size="small" onClick={() => onAction('link', file)}
                sx={{ color: T.textFaint, '&:hover': { color: '#3b82f6' } }}>
                <Movie sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy path">
              <IconButton size="small" onClick={() => onAction('copy', file)}
                sx={{ color: T.textFaint, '&:hover': { color: T.text } }}>
                <ContentCopy sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => onAction('delete', file)}
                sx={{ color: T.textFaint, '&:hover': { color: '#ef4444' } }}>
                <Delete sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setExpanded(p => !p)}
              sx={{ color: T.textFaint }}>
              {expanded ? <ExpandLess sx={{ fontSize: 15 }} /> : <ExpandMore sx={{ fontSize: 15 }} />}
            </IconButton>
          </Box>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
            <FileDetailPanel file={file} T={T} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ── File card (grid) ────────────────────────────────────────────────────── */

function FileCard({ file, selected, onSelect, onAction, T }) {
  const [expanded, setExpanded] = useState(false);
  const tracks = file.tracks ?? file.trackInfos ?? [];
  const resolution = getResolution(tracks);
  const name = file.fileName ?? file.filePath?.split(/[/\\]/).pop() ?? '—';
  const hasRecord = Boolean(file.recordId);

  return (
    <Card sx={{
      border: `1px solid ${selected ? T.teal : T.border}`,
      borderRadius: 2, bgcolor: T.glass,
      transition: 'border-color 0.15s',
    }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Checkbox checked={selected} onChange={() => onSelect(file)} size="small"
            sx={{ p: 0, color: T.textFaint, '&.Mui-checked': { color: T.teal } }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, color: T.text, fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
              {resolution && (
                <Chip label={resolution} size="small"
                  sx={{ fontSize: 9, height: 18, bgcolor: `${getQualityColor(resolution)}22`, color: getQualityColor(resolution) }} />
              )}
              <Chip label={fmtSize(file.fileSize)} size="small"
                sx={{ fontSize: 9, height: 18, bgcolor: T.glassHover, color: T.textMuted }} />
              <Chip label={hasRecord ? `#${file.recordId}` : 'Unlinked'} size="small"
                sx={{ fontSize: 9, height: 18,
                  bgcolor: hasRecord ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  color: hasRecord ? '#10b981' : '#f59e0b' }} />
            </Box>
            <TrackChips tracks={tracks} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.25, mt: 1, justifyContent: 'flex-end' }}>
          <Tooltip title="Rescan"><IconButton size="small" onClick={() => onAction('rescan', file)} sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}><Refresh sx={{ fontSize: 14 }} /></IconButton></Tooltip>
          <Tooltip title="Repair symlink"><IconButton size="small" onClick={() => onAction('repairSymlink', file)} sx={{ color: T.textFaint, '&:hover': { color: '#f59e0b' } }}><Build sx={{ fontSize: 14 }} /></IconButton></Tooltip>
          <Tooltip title="Link to record"><IconButton size="small" onClick={() => onAction('link', file)} sx={{ color: T.textFaint, '&:hover': { color: '#3b82f6' } }}><Movie sx={{ fontSize: 14 }} /></IconButton></Tooltip>
          <Tooltip title="Copy path"><IconButton size="small" onClick={() => onAction('copy', file)} sx={{ color: T.textFaint, '&:hover': { color: T.text } }}><ContentCopy sx={{ fontSize: 14 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={() => onAction('delete', file)} sx={{ color: T.textFaint, '&:hover': { color: '#ef4444' } }}><Delete sx={{ fontSize: 14 }} /></IconButton></Tooltip>
          <Tooltip title="Details"><IconButton size="small" onClick={() => setExpanded(p => !p)} sx={{ color: T.textFaint }}>{expanded ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}</IconButton></Tooltip>
        </Box>
        <Collapse in={expanded}>
          <Divider sx={{ borderColor: T.border, my: 1 }} />
          <FileDetailPanel file={file} T={T} />
        </Collapse>
      </CardContent>
    </Card>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function MediaFilesPage() {
  const T = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // UI state
  const [viewMode, setViewMode] = useState('table');
  const [search, setSearch] = useState('');
  const [filterLinked, setFilterLinked] = useState('all'); // all | linked | unlinked
  const [filterRes, setFilterRes] = useState('all');
  const [sortBy, setSortBy] = useState('created_desc');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selected, setSelected] = useState([]);

  // Action state
  const [linkFile, setLinkFile] = useState(null);
  const [deleteFile, setDeleteFile] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [confirmRepairAll, setConfirmRepairAll] = useState(false);

  /* ── Data ────────────────────────────────────────────────────────────── */

  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ['allMediaFiles'],
    queryFn: getAllMediaFiles,
    staleTime: 30_000,
  });

  /* ── Mutations ───────────────────────────────────────────────────────── */

  const deleteMut = useMutation({
    mutationFn: (file) => deleteMediaFileById(file.id ?? file.mediaFileId),
    onSuccess: () => { qc.invalidateQueries(['allMediaFiles']); enqueueSnackbar('File deleted', { variant: 'success' }); setDeleteFile(null); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Delete failed', { variant: 'error' }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: () => bulkDeleteMediaFiles(selected.map(f => f.id ?? f.mediaFileId)),
    onSuccess: () => { qc.invalidateQueries(['allMediaFiles']); enqueueSnackbar(`${selected.length} files deleted`, { variant: 'success' }); setSelected([]); setConfirmBulkDelete(false); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Bulk delete failed', { variant: 'error' }),
  });

  const cleanupMut = useMutation({
    mutationFn: cleanupOrphanedFiles,
    onSuccess: () => { qc.invalidateQueries(['allMediaFiles']); enqueueSnackbar('Cleanup completed', { variant: 'success' }); setConfirmCleanup(false); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Cleanup failed', { variant: 'error' }),
  });

  const rebuildMut = useMutation({
    mutationFn: rebuildAllSymlinks,
    onSuccess: () => { enqueueSnackbar('Symlinks rebuilt', { variant: 'success' }); setConfirmRebuild(false); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Rebuild failed', { variant: 'error' }),
  });

  const repairAllMut = useMutation({
    mutationFn: () => repairAllSymlinks(false),
    onSuccess: () => { enqueueSnackbar('Symlinks repaired', { variant: 'success' }); setConfirmRepairAll(false); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Repair failed', { variant: 'error' }),
  });

  const repairOneMut = useMutation({
    mutationFn: (file) => repairSymlink(file.id ?? file.mediaFileId),
    onSuccess: () => enqueueSnackbar('Symlink repaired', { variant: 'success' }),
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Repair failed', { variant: 'error' }),
  });

  const rescanMut = useMutation({
    mutationFn: (file) => rescanMediaFile(file.id ?? file.mediaFileId),
    onSuccess: () => { qc.invalidateQueries(['allMediaFiles']); enqueueSnackbar('Rescan complete', { variant: 'success' }); },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Rescan failed', { variant: 'error' }),
  });

  /* ── Action dispatcher ───────────────────────────────────────────────── */

  const handleAction = useCallback((action, file) => {
    switch (action) {
      case 'rescan': rescanMut.mutate(file); break;
      case 'repairSymlink': repairOneMut.mutate(file); break;
      case 'link': setLinkFile(file); break;
      case 'copy':
        navigator.clipboard?.writeText(file.filePath ?? '');
        enqueueSnackbar('Path copied', { variant: 'info' });
        break;
      case 'delete': setDeleteFile(file); break;
    }
  }, [rescanMut, repairOneMut, enqueueSnackbar]);

  /* ── Selection ───────────────────────────────────────────────────────── */

  const handleSelect = useCallback((file) => {
    setSelected(prev => {
      const id = file.id ?? file.mediaFileId;
      const found = prev.find(f => (f.id ?? f.mediaFileId) === id);
      return found ? prev.filter(f => (f.id ?? f.mediaFileId) !== id) : [...prev, file];
    });
  }, []);

  const toggleSelectAll = useCallback((visibleFiles) => {
    setSelected(prev => prev.length === visibleFiles.length ? [] : visibleFiles);
  }, []);

  /* ── Filtering + sorting ─────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = [...files];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        (f.fileName ?? f.filePath ?? '').toLowerCase().includes(q) ||
        (f.recordName ?? '').toLowerCase().includes(q) ||
        String(f.recordId ?? '').includes(q)
      );
    }
    if (filterLinked !== 'all') {
      result = result.filter(f => filterLinked === 'linked' ? Boolean(f.recordId) : !f.recordId);
    }
    if (filterRes !== 'all') {
      result = result.filter(f => {
        const tracks = f.tracks ?? f.trackInfos ?? [];
        return getResolution(tracks) === filterRes;
      });
    }

    if (sortBy === 'created_desc') {
      result = [...result].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    } else if (sortBy === 'created_asc') {
      result = [...result].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta - tb;
      });
    } else if (sortBy === 'updated_desc') {
      result = [...result].sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      });
    } else {
      result.sort((a, b) => {
        let av, bv;
        switch (sortBy) {
          case 'name': av = (a.fileName ?? a.filePath ?? '').toLowerCase(); bv = (b.fileName ?? b.filePath ?? '').toLowerCase(); break;
          case 'size': av = a.fileSize ?? 0; bv = b.fileSize ?? 0; break;
          case 'duration': av = a.duration ?? a.durationMs ?? 0; bv = b.duration ?? b.durationMs ?? 0; break;
          case 'record': av = a.recordId ?? 0; bv = b.recordId ?? 0; break;
          default: av = 0; bv = 0;
        }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [files, search, filterLinked, filterRes, sortBy, sortDir]);

  const paginated = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  /* ── Stats ───────────────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const total = files.length;
    const linked = files.filter(f => f.recordId).length;
    const totalSize = files.reduce((s, f) => s + (f.fileSize ?? 0), 0);
    const hd = files.filter(f => {
      const tracks = f.tracks ?? f.trackInfos ?? [];
      const r = getResolution(tracks);
      return r === '1080p' || r === '4K';
    }).length;
    return { total, linked, unlinked: total - linked, totalSize, hd };
  }, [files]);

  const isSelected = (file) => selected.some(f => (f.id ?? f.mediaFileId) === (file.id ?? file.mediaFileId));

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <Box sx={{ p: 3, bgcolor: T.adminBg, minHeight: '100%' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ color: T.text, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Media Files
          </Typography>
          <Typography sx={{ color: T.textMuted, fontSize: '0.82rem', mt: 0.25 }}>
            {stats.total} files · {fmtSize(stats.totalSize)} total
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Repair all broken symlinks">
            <Button size="small" startIcon={<Build />} variant="outlined"
              onClick={() => setConfirmRepairAll(true)}
              sx={{ borderColor: T.border, color: T.textMuted, '&:hover': { borderColor: '#f59e0b', color: '#f59e0b' } }}>
              Repair Symlinks
            </Button>
          </Tooltip>
          <Tooltip title="Rebuild all symlinks from scratch">
            <Button size="small" startIcon={<SwapHoriz />} variant="outlined"
              onClick={() => setConfirmRebuild(true)}
              sx={{ borderColor: T.border, color: T.textMuted, '&:hover': { borderColor: '#a78bfa', color: '#a78bfa' } }}>
              Rebuild Symlinks
            </Button>
          </Tooltip>
          <Tooltip title="Remove orphaned DB entries (no file on disk)">
            <Button size="small" startIcon={<CleaningServices />} variant="outlined"
              onClick={() => setConfirmCleanup(true)}
              sx={{ borderColor: T.border, color: T.textMuted, '&:hover': { borderColor: '#f87171', color: '#f87171' } }}>
              Cleanup
            </Button>
          </Tooltip>
          <Tooltip title="Refresh list">
            <IconButton size="small" onClick={() => refetch()}
              sx={{ color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 1, '&:hover': { color: T.teal } }}>
              <Refresh sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}><StatCard label="Total" value={stats.total} icon={<VideoFile />} color={T.teal} /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Linked" value={stats.linked} icon={<CheckCircle />} color="#10b981" /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="Unlinked" value={stats.unlinked} icon={<Warning />} color="#f59e0b" /></Grid>
        <Grid item xs={6} sm={3}><StatCard label="HD / 4K" value={stats.hd} icon={<Storage />} color="#a78bfa" /></Grid>
      </Grid>

      {/* Filter bar */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2 }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField size="small" fullWidth placeholder="Search files, records…"
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: T.textFaint }} /></InputAdornment>,
                endAdornment: search && <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')}><Clear sx={{ fontSize: 14 }} /></IconButton></InputAdornment>,
              }}
              sx={getFieldSx(T)} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ color: T.textMuted }}>Linked</InputLabel>
              <Select value={filterLinked} label="Linked" onChange={e => setFilterLinked(e.target.value)}
                sx={{ color: T.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border } }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="linked">Linked</MenuItem>
                <MenuItem value="unlinked">Unlinked</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ color: T.textMuted }}>Quality</InputLabel>
              <Select value={filterRes} label="Quality" onChange={e => setFilterRes(e.target.value)}
                sx={{ color: T.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border } }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="4K">4K</MenuItem>
                <MenuItem value="1080p">1080p</MenuItem>
                <MenuItem value="720p">720p</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ color: T.textMuted }}>Sort</InputLabel>
              <Select value={['created_desc', 'created_asc', 'updated_desc'].includes(sortBy) ? sortBy : `${sortBy},${sortDir}`} label="Sort"
                onChange={e => { const [f, d] = e.target.value.split(','); setSortBy(f); if (d) setSortDir(d); setPage(0); }}
                sx={{ color: T.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border } }}>
                <MenuItem value="name,asc">Name A–Z</MenuItem>
                <MenuItem value="name,desc">Name Z–A</MenuItem>
                <MenuItem value="size,desc">Largest first</MenuItem>
                <MenuItem value="size,asc">Smallest first</MenuItem>
                <MenuItem value="duration,desc">Longest first</MenuItem>
                <MenuItem value="record,asc">By record</MenuItem>
                <MenuItem value="created_desc">Newest first</MenuItem>
                <MenuItem value="created_asc">Oldest first</MenuItem>
                <MenuItem value="updated_desc">Last modified first</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
              <ToggleButton value="table" sx={{ color: T.textMuted, '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal } }}>
                <ViewList sx={{ fontSize: 18 }} />
              </ToggleButton>
              <ToggleButton value="grid" sx={{ color: T.textMuted, '&.Mui-selected': { bgcolor: T.tealBg, color: T.teal } }}>
                <GridView sx={{ fontSize: 18 }} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: `${T.teal}18`, border: `1px solid ${T.teal}44`, borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 13, color: T.teal, fontWeight: 600 }}>
            {selected.length} selected
          </Typography>
          <Button size="small" startIcon={<Delete />} variant="outlined"
            onClick={() => setConfirmBulkDelete(true)}
            sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' } }}>
            Delete selected
          </Button>
          <Button size="small" onClick={() => setSelected([])}
            sx={{ color: T.textMuted }}>
            Clear selection
          </Button>
        </Paper>
      )}

      {/* Loading */}
      {isLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1, bgcolor: T.glassBorder, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load media files: {error.message}
        </Alert>
      )}

      {/* Table view */}
      {viewMode === 'table' && !isLoading && (
        <Paper sx={{ border: `1px solid ${T.border}`, borderRadius: 2, overflow: 'hidden', bgcolor: T.glass }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: T.glassHover }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < paginated.length}
                      checked={paginated.length > 0 && selected.length === paginated.length}
                      onChange={() => toggleSelectAll(paginated)}
                      sx={{ color: T.textFaint, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: T.teal } }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: T.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>File</TableCell>
                  <TableCell sx={{ color: T.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quality</TableCell>
                  <TableCell sx={{ color: T.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Size</TableCell>
                  <TableCell sx={{ color: T.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</TableCell>
                  <TableCell sx={{ color: T.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Record</TableCell>
                  <TableCell sx={{ color: T.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: T.textFaint }}>
                      {search || filterLinked !== 'all' || filterRes !== 'all' ? 'No files match the current filters' : 'No media files found'}
                    </TableCell>
                  </TableRow>
                ) : paginated.map((file) => (
                  <FileRow key={file.id ?? file.mediaFileId ?? file.filePath}
                    file={file} selected={isSelected(file)}
                    onSelect={handleSelect} onAction={handleAction} T={T} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]}
            sx={{ color: T.textMuted, borderTop: `1px solid ${T.border}`,
              '& .MuiSvgIcon-root': { color: T.textMuted },
              '& .MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { color: T.textMuted } }}
          />
        </Paper>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && !isLoading && (
        <Box>
          <Grid container spacing={1.5}>
            {paginated.length === 0 ? (
              <Grid item xs={12}>
                <Typography sx={{ textAlign: 'center', py: 6, color: T.textFaint }}>
                  {search || filterLinked !== 'all' || filterRes !== 'all' ? 'No files match the current filters' : 'No media files found'}
                </Typography>
              </Grid>
            ) : paginated.map((file) => (
              <Grid key={file.id ?? file.mediaFileId ?? file.filePath} item xs={12} sm={6} md={4} lg={3}>
                <FileCard file={file} selected={isSelected(file)}
                  onSelect={handleSelect} onAction={handleAction} T={T} />
              </Grid>
            ))}
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[25, 50, 100]}
              sx={{ color: T.textMuted, '& .MuiSvgIcon-root': { color: T.textMuted } }}
            />
          </Box>
        </Box>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      {linkFile && (
        <LinkRecordDialog
          file={linkFile}
          open={Boolean(linkFile)}
          onClose={() => setLinkFile(null)}
          onLinked={() => qc.invalidateQueries(['allMediaFiles'])}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteFile)}
        title="Delete Media File"
        message={`Delete "${deleteFile?.fileName ?? deleteFile?.filePath?.split('/').pop()}"? This cannot be undone.`}
        onConfirm={() => deleteMut.mutate(deleteFile)}
        onClose={() => setDeleteFile(null)}
        loading={deleteMut.isPending}
        danger
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title="Delete Selected Files"
        message={`Delete ${selected.length} files? This cannot be undone.`}
        onConfirm={() => bulkDeleteMut.mutate()}
        onClose={() => setConfirmBulkDelete(false)}
        loading={bulkDeleteMut.isPending}
        danger
      />

      <ConfirmDialog
        open={confirmCleanup}
        title="Cleanup Orphaned Files"
        message="Remove DB entries for files that no longer exist on disk?"
        onConfirm={() => cleanupMut.mutate()}
        onClose={() => setConfirmCleanup(false)}
        loading={cleanupMut.isPending}
        danger
      />

      <ConfirmDialog
        open={confirmRebuild}
        title="Rebuild All Symlinks"
        message="Delete all existing symlinks and recreate them from scratch. Proceed?"
        onConfirm={() => rebuildMut.mutate()}
        onClose={() => setConfirmRebuild(false)}
        loading={rebuildMut.isPending}
      />

      <ConfirmDialog
        open={confirmRepairAll}
        title="Repair All Symlinks"
        message="Detect and repair all broken symlinks?"
        onConfirm={() => repairAllMut.mutate()}
        onClose={() => setConfirmRepairAll(false)}
        loading={repairAllMut.isPending}
      />
    </Box>
  );
}
