import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, Tooltip, Checkbox, IconButton,
  Button, TextField, InputAdornment, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Select, MenuItem, FormControl,
  InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Divider,
  Alert, CircularProgress, alpha, useMediaQuery, useTheme as useMuiTheme,
  Menu, ListItemIcon, ListItemText, Tab, Tabs, Skeleton, LinearProgress, Collapse,
  createTheme, ThemeProvider,
} from '@mui/material';
import {
  Search, Delete, Refresh, LinkOff, Link as LinkIcon,
  FolderOpen, VideoFile, AudioFile, Subtitles, Image as ImageIcon,
  Build, DeleteForever, LibraryAddCheck, CheckCircle, Warning,
  MoreVert, ContentCopy, Sync, CleaningServices, RestorePage, Dangerous,
  InsertDriveFile, KeyboardArrowDown, Close, OpenInNew, Tv, Save, Theaters,
  AspectRatio, Checklist, InfoOutlined,
} from '@mui/icons-material';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { motion, AnimatePresence } from 'framer-motion';
import { useT, useThemeMode } from '@shared/theme';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
import RecordSearch from '../ingestion/form/RecordSearch';
import {
  getMediaFilesPaged, getMediaFilesStats, getMediaFileDetail,
  deleteMediaFileById, bulkDeleteMediaFiles,
  repairSymlink, repairAllSymlinks, rebuildAllSymlinks,
  cleanupOrphanedFiles, rescanMediaFile, linkMediaFileToRecord,
  updateMediaFileEpisode, generateStoryboard,
} from '../api/adminApi';

// ─── formatting helpers ─────────────────────────────────────────────────────

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

function fmtDate(v) { return v ? new Date(v).toLocaleDateString() : '—'; }

function getExt(filePath) {
  if (!filePath) return '';
  return filePath.split('.').pop()?.toUpperCase() ?? '';
}

// ─── resolution helpers ──────────────────────────────────────────────────────
// Detected pixel dimensions are unreliable: a file may carry an attached cover
// image (whose dimensions can be mistaken for the video), and black-bar cropping
// during encoding changes the height. So we treat the filename's resolution token
// (720p / 1080p / 2160p) as the primary quality signal and show the detected
// dimensions alongside it for reference. The backend already excludes cover-art
// tracks when picking the primary video, so detected dims are the real video's.

function tierLabel(w, h) {
  w = w || 0; h = h || 0;
  if (!w && !h) return null;
  if (w >= 7680 || h >= 4320) return '8K';
  if (w >= 3840 || h >= 2160) return '4K';
  if (w >= 2560 || h >= 1440) return '1440p';
  if (w >= 1900 || h >= 1000) return '1080p';
  if (w >= 1260 || h >= 680)  return '720p';
  if (w >= 840  || h >= 460)  return '480p';
  return 'SD';
}

/** Resolution tier the filename claims (e.g. "…720p…", "…2160p…", "…4K…"). */
function fileNameTier(name) {
  if (!name) return null;
  const m = name.match(/(\d{3,4})p|\b(4k|8k|uhd)\b/i);
  if (!m) return null;
  if (m[2]) { const t = m[2].toUpperCase(); return t === 'UHD' ? '4K' : t; }
  const p = parseInt(m[1], 10);
  if (p >= 4320) return '8K';
  if (p >= 2160) return '4K';
  if (p >= 1440) return '1440p';
  if (p >= 1080) return '1080p';
  if (p >= 720)  return '720p';
  if (p >= 480)  return '480p';
  return `${p}p`;
}

const RES_COLOR = {
  '8K': '#ff3d00', '4K': '#ff6b35', '1440p': '#f59e0b',
  '1080p': '#10b981', '720p': '#3b82f6', '480p': '#8b5cf6', 'SD': '#6b7280',
};

const IMAGE_CODEC = /jpe?g|png|gif|bmp|mjpeg|m-jpeg|webp/i;
function isCoverArt(format) { return !!format && IMAGE_CODEC.test(format); }

/** Normalises a summary/track object into one resolution view model. */
function resolutionView({ resolutionLabel, displayWidth, displayHeight, videoWidth, videoHeight, width, height, anamorphic, fileName }) {
  const rawW = videoWidth ?? width;
  const rawH = videoHeight ?? height;
  const dispW = displayWidth ?? rawW;
  const dispH = displayHeight ?? rawH;
  const detectedLabel = resolutionLabel || tierLabel(dispW, dispH);
  const nameTier = fileNameTier(fileName);
  const label = nameTier || detectedLabel;           // filename token wins when present
  const isAnamorphic = anamorphic ?? (!!dispW && !!rawW && Math.abs(dispW - rawW) / rawW > 0.02);
  const mismatch = !!(detectedLabel && nameTier && detectedLabel !== nameTier);
  return { label, detectedLabel, dispW, dispH, rawW, rawH, anamorphic: isAnamorphic, nameTier, mismatch };
}

const TRACK_META = {
  General: { color: 'default',   icon: InsertDriveFile, label: 'General' },
  Video:   { color: 'primary',   icon: VideoFile,       label: 'Video'   },
  Audio:   { color: 'success',   icon: AudioFile,       label: 'Audio'   },
  Text:    { color: 'warning',   icon: Subtitles,       label: 'Subtitle'},
  Image:   { color: 'secondary', icon: ImageIcon,       label: 'Image'   },
};

// ─── small shared bits ──────────────────────────────────────────────────────

const chipSx = { height: 18, fontSize: '0.62rem', fontWeight: 600 };

function ExtChip({ name }) {
  return <Chip label={getExt(name)} size="small" variant="outlined" sx={chipSx} />;
}

function LinkChip({ linked, onLink }) {
  return linked
    ? <Chip icon={<CheckCircle sx={{ fontSize: '11px !important' }} />} label="Linked" size="small" color="success" variant="outlined" sx={chipSx} />
    : <Chip icon={<LinkOff sx={{ fontSize: '11px !important' }} />} label="Unlinked" size="small" variant="outlined" sx={chipSx}
        onClick={onLink ? (e) => { e.stopPropagation(); onLink(); } : undefined} />;
}

function EpisodeChip({ file }) {
  if (file.tmdbSeasonNumber == null && file.tmdbEpisodeNumber == null) return null;
  return (
    <Chip icon={<Tv sx={{ fontSize: '11px !important' }} />}
      label={`S${String(file.tmdbSeasonNumber ?? '?').padStart(2, '0')}E${String(file.tmdbEpisodeNumber ?? '?').padStart(2, '0')}`}
      size="small" color="info" variant="outlined" sx={chipSx} />
  );
}

function ResChips({ file, showDims }) {
  const r = resolutionView(file);
  if (!r.label && !file.hdrFormat) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = RES_COLOR[r.label] ?? '#6b7280';
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      {r.label && (
        <Chip label={r.label} size="small"
          sx={{ ...chipSx, fontWeight: 700, color, bgcolor: alpha(color, 0.16), border: `1px solid ${alpha(color, 0.4)}` }} />
      )}
      {file.hdrFormat && (
        <Chip label="HDR" size="small" sx={{ ...chipSx, color: '#d97706', bgcolor: alpha('#d97706', 0.16), border: `1px solid ${alpha('#d97706', 0.4)}` }} />
      )}
      {showDims && r.dispW && r.dispH && (
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {r.dispW}×{r.dispH}
        </Typography>
      )}
    </Stack>
  );
}

function audioSummary(file) {
  return [file.audioFormat, file.audioChannels ? `${file.audioChannels}ch` : null, file.audioLanguage?.toUpperCase()]
    .filter(Boolean).join(' · ');
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'text.secondary', loading, compact }) {
  const T = useT();
  const bgMap = {
    'primary.main': '#0d9488', 'success.main': '#10b981', 'warning.main': '#f59e0b',
    'error.main': '#ef4444', 'secondary.main': '#8b5cf6',
  };
  const bgColor = bgMap[color] ?? T.border;
  return (
    <Paper variant="outlined" sx={{ p: compact ? 1 : 1.5, borderRadius: 2, flex: '1 1 110px', minWidth: compact ? 92 : 110 }}>
      <Stack direction="row" spacing={compact ? 1 : 1.5} alignItems="center">
        <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: alpha(bgColor, 0.12), display: 'flex', flexShrink: 0 }}>
          <Icon sx={{ fontSize: compact ? 16 : 18, color }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {loading
            ? <Skeleton width={36} height={22} />
            : <Typography variant={compact ? 'subtitle1' : 'h6'} fontWeight={700} lineHeight={1}>{value}</Typography>}
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: compact ? '0.62rem' : undefined }}>{label}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

// ─── shared per-file action menu (used by rows, cards, and the modal) ────────

function fileActionItems(file, actions, close) {
  const run = (fn, arg) => () => { fn(arg); close(); };
  const { onOpen, onRescan, onStoryboard, onRepair, onLink, onCopyPath, onDelete } = actions;
  return (
    <>
      {onOpen && (
        <MenuItem onClick={run(onOpen, file.id)}>
          <ListItemIcon><OpenInNew fontSize="small" /></ListItemIcon>
          <ListItemText>View details</ListItemText>
        </MenuItem>
      )}
      <MenuItem onClick={run(onRescan, file.id)}>
        <ListItemIcon><Refresh fontSize="small" /></ListItemIcon>
        <ListItemText>Rescan metadata</ListItemText>
      </MenuItem>
      <MenuItem onClick={run(onStoryboard, file.id)}>
        <ListItemIcon><Theaters fontSize="small" /></ListItemIcon>
        <ListItemText>{file.hasStoryboard || file.storyboardCount ? 'Regenerate storyboard' : 'Generate storyboard'}</ListItemText>
      </MenuItem>
      <MenuItem onClick={run(onRepair, file.id)}>
        <ListItemIcon><Build fontSize="small" /></ListItemIcon>
        <ListItemText>Repair symlink</ListItemText>
      </MenuItem>
      <MenuItem onClick={run(onLink, file.id)}>
        <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
        <ListItemText>Link to record</ListItemText>
      </MenuItem>
      <MenuItem onClick={run(onCopyPath, file.filePath)}>
        <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
        <ListItemText>Copy path</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={run(onDelete, [file.id])} sx={{ color: 'error.main' }}>
        <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
        <ListItemText>Delete</ListItemText>
      </MenuItem>
    </>
  );
}

function FileActionsMenu({ file, anchorEl, onClose, ...actions }) {
  return (
    // stopPropagation: the Menu portals to <body> in the DOM but stays a React child
    // of the clickable row/card, so item/backdrop clicks would otherwise bubble
    // (through the portal) into the row onClick and open the detail modal.
    <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={onClose}
      onClick={(e) => e.stopPropagation()}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
      {fileActionItems(file, actions, onClose)}
    </Menu>
  );
}

// ─── desktop / monitor table row ─────────────────────────────────────────────

function MediaRow({ file, isLg, isXl, selected, selectMode, actions }) {
  const T = useT();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const { onSelect, onOpen, onLink } = actions;
  const handleClick = () => (selectMode ? onSelect(file.id) : onOpen(file.id));

  return (
    <TableRow hover onClick={handleClick}
      sx={{ cursor: 'pointer', bgcolor: selected ? alpha(T.teal, 0.06) : undefined, '& td': { py: 0.75 } }}>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          {selectMode && (
            <Checkbox size="small" checked={selected} onClick={(e) => e.stopPropagation()}
              onChange={() => onSelect(file.id)} sx={{ p: 0.25, flexShrink: 0 }} />
          )}
          <InsertDriveFile sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={file.fileName}
              sx={{ maxWidth: { md: 220, lg: 320, xl: 460 } }}>
              {file.fileName}
            </Typography>
            <Stack direction="row" spacing={0.5} mt={0.25} alignItems="center" flexWrap="wrap" useFlexGap>
              <ExtChip name={file.fileName} />
              <LinkChip linked={!!file.recordId} onLink={() => onLink(file.id)} />
              <EpisodeChip file={file} />
              {file.hasStoryboard && (
                <Tooltip title="Scrub-preview storyboard available">
                  <Theaters sx={{ fontSize: 15, color: 'text.disabled' }} />
                </Tooltip>
              )}
            </Stack>
          </Box>
        </Stack>
      </TableCell>

      <TableCell><ResChips file={file} showDims={isLg} /></TableCell>
      <TableCell align="right"><Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtBytes(file.fileSize)}</Typography></TableCell>
      <TableCell><Typography variant="caption" color="text.secondary">{fmtDuration(file.duration)}</Typography></TableCell>

      {isLg && (
        <TableCell>
          {file.videoCodec
            ? <Chip label={file.videoCodec} size="small" variant="outlined" sx={chipSx} />
            : <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}
      {isLg && (
        <TableCell>
          <Typography variant="caption" color="text.secondary" noWrap>{audioSummary(file) || '—'}</Typography>
        </TableCell>
      )}
      {isXl && (
        <TableCell>
          <Stack direction="row" spacing={0.5}>
            {file.videoCount > 0 && <Chip icon={<VideoFile sx={{ fontSize: '11px !important' }} />} label={file.videoCount} size="small" color="primary" variant="outlined" sx={chipSx} />}
            {file.audioCount > 0 && <Chip icon={<AudioFile sx={{ fontSize: '11px !important' }} />} label={file.audioCount} size="small" color="success" variant="outlined" sx={chipSx} />}
            {file.textCount  > 0 && <Chip icon={<Subtitles  sx={{ fontSize: '11px !important' }} />} label={file.textCount}  size="small" color="warning" variant="outlined" sx={chipSx} />}
          </Stack>
        </TableCell>
      )}
      {isXl && <TableCell><Typography variant="caption" color="text.secondary">{fmtDate(file.createdAt)}</Typography></TableCell>}

      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}><MoreVert fontSize="small" /></IconButton>
        <FileActionsMenu file={file} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} {...actions} />
      </TableCell>
    </TableRow>
  );
}

// ─── mobile card — compact, nothing cut off ──────────────────────────────────

function MediaCard({ file, selected, selectMode, actions }) {
  const T = useT();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const { onSelect, onOpen, onLink } = actions;
  const audio = audioSummary(file);
  const handleClick = () => (selectMode ? onSelect(file.id) : onOpen(file.id));

  return (
    <Paper variant="outlined" onClick={handleClick}
      sx={{
        borderRadius: 2, p: 1.25, cursor: 'pointer',
        borderColor: selected ? 'primary.main' : undefined,
        bgcolor: selected ? alpha(T.teal, 0.05) : undefined,
        transition: 'border-color .15s, background .15s',
        '&:active': { bgcolor: alpha(T.teal, 0.04) },
      }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        {selectMode && (
          <Checkbox size="small" checked={selected} onClick={(e) => e.stopPropagation()}
            onChange={() => onSelect(file.id)} sx={{ p: 0.25, mt: -0.25, flexShrink: 0 }} />
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Full filename — wraps, never truncated */}
          <Typography variant="body2" fontWeight={600} title={file.fileName}
            sx={{ fontSize: '0.8rem', lineHeight: 1.35, wordBreak: 'break-word' }}>
            {file.fileName}
          </Typography>

          <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.75} alignItems="center" useFlexGap>
            <ExtChip name={file.fileName} />
            <ResChips file={file} />
            {file.videoCodec && <Chip label={file.videoCodec} size="small" variant="outlined" sx={chipSx} />}
            <Chip label={fmtBytes(file.fileSize)} size="small" sx={chipSx} />
            {fmtDuration(file.duration) !== '—' && <Chip label={fmtDuration(file.duration)} size="small" sx={chipSx} />}
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5} alignItems="center" useFlexGap>
            <LinkChip linked={!!file.recordId} onLink={() => onLink(file.id)} />
            <EpisodeChip file={file} />
            {file.hasStoryboard && <Chip icon={<Theaters sx={{ fontSize: '11px !important' }} />} label="preview" size="small" variant="outlined" sx={chipSx} />}
          </Stack>

          {audio && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-word' }}>
              {audio}
            </Typography>
          )}
        </Box>

        {!selectMode && (
          <IconButton size="small" sx={{ flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}>
            <MoreVert fontSize="small" />
          </IconButton>
        )}
        <FileActionsMenu file={file} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} {...actions} />
      </Stack>
    </Paper>
  );
}

// ─── skeletons ────────────────────────────────────────────────────────────────

function SkeletonRow({ cols }) {
  return (
    <TableRow>
      <TableCell><Stack direction="row" spacing={1}><Skeleton variant="circular" width={18} height={18} /><Box><Skeleton width={200} height={16} /><Skeleton width={90} height={12} sx={{ mt: 0.5 }} /></Box></Stack></TableCell>
      {[...Array(cols)].map((_, i) => <TableCell key={i}><Skeleton width={60} /></TableCell>)}
      <TableCell align="right"><Skeleton width={28} height={28} sx={{ ml: 'auto' }} /></TableCell>
    </TableRow>
  );
}

function SkeletonCard() {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.25 }}>
      <Skeleton height={16} width="80%" />
      <Skeleton height={16} width="55%" sx={{ mb: 0.75 }} />
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {[50, 40, 60, 45].map((w, i) => <Skeleton key={i} width={w} height={20} sx={{ borderRadius: 3 }} />)}
      </Stack>
    </Paper>
  );
}

// ─── detail modal helpers ──────────────────────────────────────────────────────

function primaryVideoTrack(file) {
  const vids = (file?.tracks ?? []).filter(t => t.type === 'Video');
  if (!vids.length) return null;
  // Skip attached cover art (JPEG/PNG/MJPEG) so we read the real video's dimensions.
  const real = vids.filter(t => !isCoverArt(t.format));
  const pool = real.length ? real : vids;
  return pool.find(t => t.frameRate) ?? pool.reduce((a, b) => ((b.height ?? 0) > (a.height ?? 0) ? b : a));
}

function primaryAudioTrack(file) {
  const auds = (file?.tracks ?? []).filter(t => t.type === 'Audio');
  if (!auds.length) return null;
  return auds.find(t => t.defaultTrack === 'Yes') ?? auds[0];
}

function fmtBitrate(bps) {
  if (!bps) return null;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${Math.round(bps / 1e3)} kbps`;
  return `${bps} bps`;
}

/** Key facts for the Overview tab — keeps it informative instead of sparse. */
function OverviewFacts({ file, pv, generalTrack }) {
  const T = useT();
  const audio = primaryAudioTrack(file);
  const r = pv ? resolutionView({ ...pv, fileName: file.fileName }) : null;
  const fr = pv?.frameRate ? `${parseFloat(pv.frameRate).toFixed(3).replace(/\.?0+$/, '')} fps` : null;
  const facts = [
    ['Container', generalTrack?.format],
    ['Resolution', r?.label ? `${r.label}${r.dispW ? ` · ${r.dispW}×${r.dispH}` : ''}` : null],
    ['Video codec', pv && !isCoverArt(pv.format) ? pv.format : file.videoCodec],
    ['Bit depth', pv?.bitDepth ? `${pv.bitDepth}-bit` : null],
    ['HDR', pv?.hdrFormat],
    ['Colour space', pv?.colorSpace],
    ['Frame rate', fr],
    ['Video bitrate', fmtBitrate(pv?.bitRate)],
    ['Audio', audio ? [audio.format, audio.channels ? `${audio.channels}ch` : null, audio.language?.toUpperCase()].filter(Boolean).join(' · ') : null],
    ['Audio bitrate', fmtBitrate(audio?.bitRate)],
    ['Overall bitrate', fmtBitrate(generalTrack?.overallBitRate)],
    ['Tracks', `${generalTrack?.videoCount ?? 0} video · ${generalTrack?.audioCount ?? 0} audio · ${generalTrack?.textCount ?? 0} subtitle`],
    ['Duration', fmtDuration(generalTrack?.duration)],
    ['Size', fmtBytes(file.fileSize)],
    ['Linked record', file.recordId
      ? `${file.recordName || 'Unknown'} (#${file.recordId})${file.recordType ? ` · ${file.recordType === 'MOVIE' ? 'Movie' : 'TV Series'}` : ''}`
      : 'Not linked'],
    ['Added', fmtDate(file.createdAt)],
    ['Updated', fmtDate(file.updatedAt)],
  ].filter(([, v]) => v && v !== '—');

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 3, rowGap: 0.25 }}>
        {facts.map(([k, v]) => (
          <Stack key={k} direction="row" spacing={1} sx={{ py: 0.4, borderBottom: `1px solid ${alpha(T.border, 0.5)}`, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: T.textMuted, minWidth: 92, flexShrink: 0 }}>{k}</Typography>
            <Typography variant="caption" sx={{ color: T.text, fontWeight: 500, wordBreak: 'break-word' }}>{v}</Typography>
          </Stack>
        ))}
      </Box>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="flex-start">
        <Typography variant="caption" sx={{ color: T.textMuted, minWidth: 92, flexShrink: 0 }}>Path</Typography>
        <Typography variant="caption" sx={{ color: T.textMuted, fontFamily: 'monospace', fontSize: '0.68rem', wordBreak: 'break-all' }}>{file.filePath}</Typography>
      </Stack>
    </Box>
  );
}

function StoryboardSection({ file, onStoryboard }) {
  const T = useT();
  const [showPreview, setShowPreview] = useState(true);   // expanded by default so Overview isn't empty
  const has = !!file?.storyboardCount;
  const spriteUrl = has ? `${getApiBaseUrl()}/storyboard/${file.id}.jpg` : null;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Theaters sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="body2" fontWeight={600}>Storyboard</Typography>
        {has
          ? <Chip size="small" color="success" variant="outlined" label={`${file.storyboardCount} frames · ${file.storyboardCols}×${file.storyboardRows}`} sx={{ height: 20, fontSize: '0.65rem' }} />
          : <Chip size="small" variant="outlined" label="Not generated" sx={{ height: 20, fontSize: '0.65rem' }} />}
        <Box sx={{ flex: 1 }} />
        {has && (
          <Button size="small" onClick={() => setShowPreview(v => !v)} sx={{ textTransform: 'none' }}>
            {showPreview ? 'Hide' : 'Preview'}
          </Button>
        )}
        <Button size="small" variant="outlined" startIcon={<Theaters sx={{ fontSize: 15 }} />}
          onClick={() => onStoryboard(file.id)} sx={{ textTransform: 'none' }}>
          {has ? 'Regenerate' : 'Generate'}
        </Button>
      </Stack>
      <Collapse in={showPreview && has} unmountOnExit>
        <Box sx={{ mt: 1.5, overflow: 'auto', borderRadius: 1, border: `1px solid ${alpha(T.border, 0.6)}` }}>
          <img src={spriteUrl} alt="storyboard sprite" style={{ display: 'block', maxWidth: 'none', height: 120 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </Box>
      </Collapse>
    </Box>
  );
}

function EpisodeSection({ file }) {
  const [season, setSeason] = useState('');
  const [ep, setEp] = useState('');
  const [busy, setBusy] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  useEffect(() => {
    setSeason(file?.tmdbSeasonNumber != null ? String(file.tmdbSeasonNumber) : '');
    setEp(file?.tmdbEpisodeNumber != null ? String(file.tmdbEpisodeNumber) : '');
  }, [file?.id, file?.tmdbSeasonNumber, file?.tmdbEpisodeNumber]);

  const persist = async (clear) => {
    setBusy(true);
    const s = clear ? null : (season !== '' ? parseInt(season, 10) : null);
    const e = clear ? null : (ep !== '' ? parseInt(ep, 10) : null);
    try {
      const updated = await updateMediaFileEpisode(file.id, s, e);
      // Reflect immediately: seed the detail cache with the server's response, then
      // refresh the list so the SxxExx chip updates there too.
      if (updated && updated.id) qc.setQueryData?.(['mediaFileDetail', file.id], updated);
      qc.invalidateQueries({ queryKey: ['mediaFileDetail', file.id] });
      qc.invalidateQueries({ queryKey: ['mediaFiles'] });
      enqueueSnackbar(clear ? 'Episode cleared' : 'Episode saved', { variant: 'success', autoHideDuration: 2000 });
      if (clear) { setSeason(''); setEp(''); }
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message ?? 'Failed to save episode', { variant: 'error' });
    } finally { setBusy(false); }
  };

  const current = file?.tmdbSeasonNumber != null || file?.tmdbEpisodeNumber != null;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <Tv sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="body2" fontWeight={600}>Episode</Typography>
        {current
          ? <Chip size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }}
              label={`S${String(file.tmdbSeasonNumber ?? '?').padStart(2, '0')}E${String(file.tmdbEpisodeNumber ?? '?').padStart(2, '0')}`} />
          : <Chip size="small" variant="outlined" label="Not set" sx={{ height: 20, fontSize: '0.65rem' }} />}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField size="small" label="Season" type="number" value={season}
          onChange={e => setSeason(e.target.value)} inputProps={{ min: 0 }} sx={{ width: 100 }} />
        <TextField size="small" label="Episode" type="number" value={ep}
          onChange={e => setEp(e.target.value)} inputProps={{ min: 0 }} sx={{ width: 100 }} />
        <Button size="small" variant="contained" disabled={busy}
          startIcon={busy ? <CircularProgress size={13} /> : <Save sx={{ fontSize: 15 }} />}
          onClick={() => persist(false)} sx={{ textTransform: 'none' }}>Save</Button>
        {current && (
          <Button size="small" color="error" disabled={busy} onClick={() => persist(true)} sx={{ textTransform: 'none' }}>
            Clear
          </Button>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        Auto-detected from the filename on ingest; override here if it was wrong or missing.
      </Typography>
    </Box>
  );
}

const SEASON_EP_RE = /s\d{1,2}\s*[._-]?\s*e\d{1,3}/i;

function TrackDetailModal({ fileId, onClose, onRescan, onRepair, onLink, onCopyPath, onDelete, onStoryboard }) {
  const [tab, setTab] = useState(0);
  const [actAnchor, setActAnchor] = useState(null);
  const muiTheme = useMuiTheme();
  const mobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const { data: file, isLoading } = useQuery({
    queryKey: ['mediaFileDetail', fileId],
    queryFn: () => getMediaFileDetail(fileId),
    enabled: !!fileId,
    staleTime: 30_000,
  });

  useEffect(() => { setTab(0); }, [fileId]);

  const pv = primaryVideoTrack(file);
  const res = pv ? resolutionView({ ...pv, fileName: file?.fileName }) : null;
  const generalTrack = (file?.tracks ?? []).find(t => t.type === 'General');
  // Actions for the mobile overflow menu — rescan/delete also close the dialog,
  // matching the desktop icon row.
  const actions = {
    onRescan: (id) => { onRescan(id); onClose(); },
    onStoryboard,
    onRepair,
    onLink,
    onCopyPath,
    onDelete: (ids) => { onDelete(ids); onClose(); },
  };

  // Episode fields only make sense for TV. Trust the linked record's type; when
  // unlinked, fall back to whether it's tagged / named like an episode.
  const isEpisodeContext = !!file && (
    file.recordType
      ? file.recordType !== 'MOVIE'
      : (file.tmdbSeasonNumber != null || file.tmdbEpisodeNumber != null || SEASON_EP_RE.test(file.fileName || ''))
  );

  // First tab is a consolidated "Overview" (summary + episode + storyboard) so the
  // per-track detail tabs sit right under the header and get the full content height.
  const tabDefs = useMemo(() => {
    if (!file) return [];
    const defs = [{ key: 'overview', label: 'Overview', icon: InfoOutlined }];
    const byType = (type) => (file.tracks ?? []).filter(t => t.type === type);
    const g = byType('General');
    if (g.length) defs.push({ key: 'General', label: 'General', tracks: g, icon: InsertDriveFile });
    const push = (type, label, icon) => { const t = byType(type); if (t.length) defs.push({ key: type, label: `${label} (${t.length})`, tracks: t, icon }); };
    push('Video', 'Video', VideoFile);
    push('Audio', 'Audio', AudioFile);
    push('Text', 'Subtitle', Subtitles);
    push('Image', 'Image', ImageIcon);
    return defs;
  }, [file]);

  const safeTab = Math.min(tab, Math.max(0, tabDefs.length - 1));
  const active = tabDefs[safeTab];

  return (
    <Dialog open={!!fileId} onClose={onClose} maxWidth="md" fullWidth fullScreen={mobile}
      PaperProps={{ sx: { height: mobile ? '100%' : '82vh', maxHeight: mobile ? '100%' : '82vh', display: 'flex', flexDirection: 'column' } }}>
      {/* Compact header — filename, path, actions. Kept small so the tabs sit high. */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1, flexShrink: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} title={file?.fileName}
              sx={{ wordBreak: 'break-word', lineHeight: 1.3, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              {isLoading ? <Skeleton width={220} /> : file?.fileName}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontFamily="monospace"
              sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isLoading ? <Skeleton width={280} /> : file?.filePath}
            </Typography>
          </Box>
          {/* Actions: overflow menu on mobile, icon row on desktop. Close always visible. */}
          <Stack direction="row" spacing={0.5} flexShrink={0}>
            {file && (mobile ? (
              <>
                <IconButton size="small" onClick={(e) => setActAnchor(e.currentTarget)}><MoreVert fontSize="small" /></IconButton>
                <Menu anchorEl={actAnchor} open={!!actAnchor} onClose={() => setActAnchor(null)}>
                  {fileActionItems(file, actions, () => setActAnchor(null))}
                </Menu>
              </>
            ) : (
              <>
                <Tooltip title="Rescan metadata"><IconButton size="small" onClick={() => { onRescan(fileId); onClose(); }}><Refresh fontSize="small" /></IconButton></Tooltip>
                <Tooltip title={file.storyboardCount ? 'Regenerate storyboard' : 'Generate storyboard'}><IconButton size="small" onClick={() => onStoryboard(fileId)}><Theaters fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Repair symlink"><IconButton size="small" onClick={() => onRepair(fileId)}><Build fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Copy path"><IconButton size="small" onClick={() => onCopyPath(file?.filePath)}><ContentCopy fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => { onDelete([fileId]); onClose(); }}><Delete fontSize="small" /></IconButton></Tooltip>
              </>
            ))}
            <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
          </Stack>
        </Stack>
      </Box>

      {isLoading && <LinearProgress />}

      {!isLoading && tabDefs.length > 0 && (
        <Tabs value={safeTab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', minHeight: 42, flexShrink: 0,
                '& .MuiTab-root': { minHeight: 42, fontSize: '0.75rem', py: 0.5 } }}>
          {tabDefs.map((td, i) => { const Ic = td.icon; return <Tab key={i} label={td.label} icon={<Ic sx={{ fontSize: 15 }} />} iconPosition="start" />; })}
        </Tabs>
      )}

      <DialogContent sx={{ p: 0, overflow: 'auto', flex: 1 }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}>{[...Array(8)].map((_, i) => <Skeleton key={i} height={20} sx={{ mb: 0.5 }} />)}</Box>
        ) : !file ? null : active?.key === 'overview' ? (
          <Box>
            {(res?.mismatch || res?.anamorphic || !file.tracks?.length) && (
              <Box sx={{ px: { xs: 2, sm: 3 }, pt: 1.5 }}>
                {res && res.dispW && (res.mismatch || res.anamorphic) && (
                  <Alert severity="info" icon={<AspectRatio fontSize="small" />} sx={{ py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                    <Typography variant="caption">
                      {res.anamorphic
                        ? <>Anamorphic — stored <b>{res.rawW}×{res.rawH}</b>, displays <b>{res.dispW}×{res.dispH}</b>. </>
                        : null}
                      Detected video is <b>{res.dispW}×{res.dispH}</b> ({res.detectedLabel}); showing <b>{res.label}</b> from the filename.
                    </Typography>
                  </Alert>
                )}
                {!file.tracks?.length && (
                  <Alert severity="warning" sx={{ mt: (res?.mismatch || res?.anamorphic) ? 1 : 0, py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                    <Typography variant="caption">No track metadata — use Rescan to populate.</Typography>
                  </Alert>
                )}
              </Box>
            )}
            <OverviewFacts file={file} pv={pv} generalTrack={generalTrack} />
            {isEpisodeContext && <EpisodeSection file={file} />}
            <StoryboardSection file={file} onStoryboard={onStoryboard} />
          </Box>
        ) : (
          (active?.tracks ?? []).map((track, i) => {
            const meta = TRACK_META[track.type] ?? TRACK_META.General;
            const Ic = meta.icon;
            const list = active.tracks;
            const cover = track.type === 'Video' && isCoverArt(track.format);
            return (
              <Box key={i} sx={{ p: 2, borderBottom: i < list.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1} flexWrap="wrap" useFlexGap>
                  <Chip icon={<Ic sx={{ fontSize: '13px !important' }} />} label={`${meta.label} ${i + 1}`}
                    size="small" color={meta.color} variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                  {cover && <Chip label="cover art" size="small" color="secondary" variant="outlined" sx={chipSx} />}
                  {track.type === 'Video' && !cover && track.resolutionLabel && (
                    <Chip label={`${track.resolutionLabel}${track.displayWidth ? ` · ${track.displayWidth}×${track.displayHeight}` : ''}`}
                      size="small" sx={chipSx} />
                  )}
                  {track.defaultTrack === 'Yes' && <Chip label="default" size="small" sx={chipSx} />}
                  {track.forced === 'Yes' && <Chip label="forced" size="small" color="warning" sx={chipSx} />}
                  {track.language && <Chip label={track.language.toUpperCase()} size="small" variant="outlined" sx={chipSx} />}
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

// ─── RawFieldGrid — key/value pairs from raw mediainfo ────────────────────────

function RawFieldGrid({ data }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== '' && v !== undefined);
  if (entries.length === 0) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2px 12px' }}>
      {entries.map(([k, v]) => (
        <Stack key={k} direction="row" spacing={0.75} alignItems="baseline" sx={{ overflow: 'hidden', py: '1px' }}>
          <Typography variant="caption" color="text.secondary"
            sx={{ minWidth: 0, flexShrink: 0, maxWidth: '42%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.68rem' }}>
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

// ─── DeleteDialog ──────────────────────────────────────────────────────────────

function DeleteDialog({ open, count, onClose, onConfirm }) {
  const [purge, setPurge] = useState(false);
  const handleClose = () => { setPurge(false); onClose(); };
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete {count > 1 ? `${count} files` : 'file'}?</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Paper variant="outlined" onClick={() => setPurge(false)} sx={{ p: 1.5, cursor: 'pointer', borderColor: !purge ? 'primary.main' : undefined, bgcolor: !purge ? alpha('#0d9488', 0.06) : undefined }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <LibraryAddCheck color={!purge ? 'primary' : 'action'} />
              <Box>
                <Typography variant="body2" fontWeight={600}>Remove from library</Typography>
                <Typography variant="caption" color="text.secondary">Removes DB entry and symlink. File stays on disk.</Typography>
              </Box>
            </Stack>
          </Paper>
          <Paper variant="outlined" onClick={() => setPurge(true)} sx={{ p: 1.5, cursor: 'pointer', borderColor: purge ? 'error.main' : undefined, bgcolor: purge ? alpha('#ef4444', 0.06) : undefined }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DeleteForever color={purge ? 'error' : 'action'} />
              <Box>
                <Typography variant="body2" fontWeight={600} color={purge ? 'error' : undefined}>Delete permanently</Typography>
                <Typography variant="caption" color="text.secondary">Removes DB entry, symlink, <strong>and the actual file</strong>. Cannot be undone.</Typography>
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
        <Button variant="contained" color={purge ? 'error' : 'primary'} onClick={() => { onConfirm(purge); handleClose(); }}>
          {purge ? 'Delete permanently' : 'Remove from library'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── LinkRecordDialog ────────────────────────────────────────────────────────

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
          startIcon={loading ? <CircularProgress size={14} /> : <LinkIcon />} onClick={handleLink}>Link</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── MaintenanceMenu ───────────────────────────────────────────────────────────

function MaintenanceMenu({ onRepairAll, onRebuild, onCleanup, onSync, busy, compact }) {
  const [anchor, setAnchor] = useState(null);
  const open = (e) => setAnchor(e.currentTarget);
  return (
    <>
      {compact ? (
        <Tooltip title="Maintenance">
          <span>
            <IconButton size="small" onClick={open} disabled={busy}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              {busy ? <CircularProgress size={16} /> : <Build fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button variant="outlined" size="small" startIcon={busy ? <CircularProgress size={14} /> : <Build />} endIcon={<KeyboardArrowDown />}
          onClick={open} disabled={busy}>
          Maintenance
        </Button>
      )}
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

// ─── MediaFilesPage (main export) ──────────────────────────────────────────────

export default function MediaFilesPage() {
  const T = useT();
  const { mode } = useThemeMode();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const isLg = useMediaQuery(muiTheme.breakpoints.up('lg'));
  const isXl = useMediaQuery(muiTheme.breakpoints.up('xl'));

  // The app's global MUI theme follows the global (cinema) light/dark mode, but the
  // admin section runs on its own theme (useT). Re-scope MUI's palette to the admin
  // mode here so every surface/text (headers included) matches the admin theme —
  // otherwise white MUI text lands on the white admin background and vanishes.
  const adminMuiTheme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#0d9488', contrastText: '#ffffff' },
      secondary: { main: '#4db6ac' },
      background: {
        default: mode === 'dark' ? '#000000' : '#ffffff',
        paper: mode === 'dark' ? '#111111' : '#ffffff',
      },
    },
    shape: { borderRadius: 8 },
    typography: { fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif' },
  }), [mode]);

  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null);
  const [detailFileId, setDetailFileId] = useState(null);
  const [mainBusy, setMainBusy] = useState(false);
  const [bulkAnchor, setBulkAnchor] = useState(null);

  const sentinelRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const linked = statusFilter === 'all' ? undefined : statusFilter === 'linked';
  const queryParams = { q: debouncedQ || undefined, linked, sort };

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, error } = useInfiniteQuery({
    queryKey: ['mediaFiles', queryParams],
    queryFn: ({ pageParam = 0 }) => getMediaFilesPaged({ ...queryParams, page: pageParam, size: 50 }),
    getNextPageParam: (lastPage) => lastPage.last ? undefined : lastPage.number + 1,
    staleTime: 60_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['mediaFilesStats'],
    queryFn: getMediaFilesStats,
    staleTime: 30_000,
  });

  const files = useMemo(() => data?.pages?.flatMap(p => p.content) ?? [], [data]);
  const totalLoaded = files.length;
  const totalElements = data?.pages?.[0]?.totalElements ?? 0;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allSelected = files.length > 0 && files.every(f => selected.has(f.id));
  const toggleSelect = useCallback((id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(files.map(f => f.id)));
  const clearSelection = () => setSelected(new Set());
  const exitSelect = () => { setSelectMode(false); clearSelection(); };

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mediaFiles'] });
    qc.invalidateQueries({ queryKey: ['mediaFilesStats'] });
  }, [qc]);

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

  const doStoryboard = useCallback(async (id) => {
    try {
      await generateStoryboard(id);
      enqueueSnackbar('Storyboard generation started — this can take up to a minute', { variant: 'info' });
      setTimeout(() => { invalidateAll(); qc.invalidateQueries({ queryKey: ['mediaFileDetail', id] }); }, 15000);
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Storyboard generation failed', { variant: 'error' });
    }
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

  // Bulk versions of the per-file actions (rescan / storyboard / repair) — run the
  // existing endpoints across the selection, then refresh and leave select mode.
  const doBulkAction = useCallback(async (action, ids) => {
    const map = {
      rescan:     { fn: rescanMediaFile,    verb: 'Rescan',                delay: 2500 },
      storyboard: { fn: generateStoryboard, verb: 'Storyboard generation', delay: 15000 },
      repair:     { fn: repairSymlink,      verb: 'Symlink repair',        delay: 1500 },
    };
    const cfg = map[action];
    if (!cfg || !ids.length) return;
    const results = await Promise.allSettled(ids.map(id => cfg.fn(id)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    enqueueSnackbar(`${cfg.verb} started for ${ok} file(s)${fail ? ` · ${fail} failed` : ''}`,
      { variant: fail ? 'warning' : 'info' });
    setTimeout(invalidateAll, cfg.delay);
    setSelectMode(false);
    setSelected(new Set());
  }, [enqueueSnackbar, invalidateAll]);

  const doMaintenance = useCallback(async (action) => {
    setMainBusy(true);
    try {
      if (action === 'sync')    { await cleanupOrphanedFiles(); await repairAllSymlinks(false); enqueueSnackbar('Sync complete', { variant: 'success' }); }
      if (action === 'repair')  { await repairAllSymlinks(false); enqueueSnackbar('Symlinks repaired', { variant: 'success' }); }
      if (action === 'rebuild') { await rebuildAllSymlinks(); enqueueSnackbar('Symlinks rebuilt', { variant: 'success' }); }
      if (action === 'cleanup') { await cleanupOrphanedFiles(); enqueueSnackbar('Cleanup done', { variant: 'success' }); }
      invalidateAll();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Operation failed', { variant: 'error' });
    } finally { setMainBusy(false); }
  }, [enqueueSnackbar, invalidateAll]);

  const rowActions = useMemo(() => ({
    onSelect: toggleSelect,
    onOpen: setDetailFileId,
    onDelete: (ids) => setDeleteTarget(ids),
    onRescan: doRescan,
    onStoryboard: doStoryboard,
    onRepair: doRepair,
    onLink: (id) => setLinkTarget(id),
    onCopyPath: doCopyPath,
  }), [toggleSelect, doRescan, doStoryboard, doRepair, doCopyPath]);

  if (error) return <Alert severity="error" sx={{ m: 2 }}>Failed to load: {error.message}</Alert>;

  const extraCols = 3 + (isLg ? 2 : 0) + (isXl ? 2 : 0); // Quality, Size, Duration (+ codec/audio) (+ tracks/added)
  const subtitle = isLoading ? 'Loading…'
    : totalLoaded < totalElements
      ? `${totalLoaded} of ${totalElements} · ${fmtBytes(stats?.totalSize)}`
      : `${totalElements} files · ${fmtBytes(stats?.totalSize)}`;

  return (
    <ThemeProvider theme={adminMuiTheme}>
    <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 }, pb: selectMode ? 10 : undefined, minHeight: '100vh', color: T.text }}>
      {/* Header — compact on mobile */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={{ xs: 1.5, md: 2 }} gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant={isMobile ? 'subtitle1' : 'h5'} fontWeight={800} letterSpacing="-0.02em" noWrap>
            Media Files
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{subtitle}</Typography>
        </Box>
        <Stack direction="row" spacing={0.75} flexShrink={0} alignItems="center">
          <MaintenanceMenu compact={isMobile} busy={mainBusy}
            onSync={() => doMaintenance('sync')} onRepairAll={() => doMaintenance('repair')}
            onRebuild={() => doMaintenance('rebuild')} onCleanup={() => doMaintenance('cleanup')} />
          {isMobile ? (
            <Tooltip title="Refresh"><span>
              <IconButton size="small" onClick={invalidateAll} disabled={isLoading || mainBusy}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                {isLoading ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
              </IconButton>
            </span></Tooltip>
          ) : (
            <Button variant="outlined" size="small" startIcon={isLoading ? <CircularProgress size={14} /> : <Refresh />}
              onClick={invalidateAll} disabled={isLoading || mainBusy}>Refresh</Button>
          )}
        </Stack>
      </Stack>

      {/* Stats — horizontal scroll on mobile */}
      <Stack direction="row" gap={1} mb={2}
        sx={{ overflowX: { xs: 'auto', sm: 'visible' }, flexWrap: { xs: 'nowrap', sm: 'wrap' }, pb: { xs: 0.5, sm: 0 } }}>
        <StatCard icon={InsertDriveFile} label="Total" value={stats?.total ?? '—'} loading={statsLoading} compact={isMobile} />
        <StatCard icon={CheckCircle} label="Linked" value={stats?.linked ?? '—'} color="success.main" loading={statsLoading} compact={isMobile} />
        <StatCard icon={LinkOff} label="Unlinked" value={stats?.unlinked ?? '—'} color="warning.main" loading={statsLoading} compact={isMobile} />
        <StatCard icon={VideoFile} label="4K / UHD" value={stats?.uhdCount ?? '—'} color="primary.main" loading={statsLoading} compact={isMobile} />
        <StatCard icon={Warning} label="HDR" value={stats?.hdrCount ?? '—'} color="secondary.main" loading={statsLoading} compact={isMobile} />
        <StatCard icon={FolderOpen} label="Size" value={fmtBytes(stats?.totalSize)} loading={statsLoading} compact={isMobile} />
      </Stack>

      {/* Toolbar — sticky */}
      <Paper variant="outlined" sx={{ p: 1.25, mb: 2, borderRadius: 2, position: 'sticky', top: 0, zIndex: 5, backdropFilter: 'blur(6px)', bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9) }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
          <TextField size="small" placeholder="Search filename…" value={search} onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')}><Close fontSize="small" /></IconButton></InputAdornment> : null,
            }}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }} />
          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }} flexWrap="wrap" useFlexGap>
            <FormControl size="small" sx={{ flex: 1, minWidth: 104 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); clearSelection(); }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="linked">Linked</MenuItem>
                <MenuItem value="unlinked">Unlinked</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
              <InputLabel>Sort</InputLabel>
              <Select value={sort} label="Sort" onChange={(e) => { setSort(e.target.value); clearSelection(); }}>
                <MenuItem value="newest">Newest first</MenuItem>
                <MenuItem value="oldest">Oldest first</MenuItem>
                <MenuItem value="largest">Largest first</MenuItem>
                <MenuItem value="smallest">Smallest first</MenuItem>
                <MenuItem value="name-asc">Name A–Z</MenuItem>
                <MenuItem value="name-desc">Name Z–A</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title={selectMode ? 'Cancel selection' : 'Select multiple'}>
              <Button size="small" variant={selectMode ? 'contained' : 'outlined'} startIcon={<Checklist />}
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                sx={{ flexShrink: 0, minWidth: 0 }}>
                {selectMode ? 'Cancel' : 'Select'}
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Content */}
      {isLoading ? (
        isMobile ? (
          <Stack spacing={1}>{[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}</Stack>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small"><TableBody>{[...Array(8)].map((_, i) => <SkeletonRow key={i} cols={extraCols} />)}</TableBody></Table>
          </TableContainer>
        )
      ) : files.length === 0 ? (
        <Stack alignItems="center" py={8} spacing={1}>
          <InsertDriveFile sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography color="text.secondary">
            {totalElements === 0 ? 'No media files found' : 'No files match the current filters'}
          </Typography>
        </Stack>
      ) : isMobile ? (
        <Stack spacing={1}>
          {files.map(file => (
            <MediaCard key={file.id} file={file} selected={selected.has(file.id)} selectMode={selectMode} actions={rowActions} />
          ))}
          {isFetchingNextPage && [...Array(3)].map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Table size="small" stickyHeader sx={{ '& td, & th': { borderColor: alpha(T.border, 0.6) } }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '.04em', color: 'text.secondary', bgcolor: 'background.paper' } }}>
                <TableCell>File</TableCell>
                <TableCell>Quality</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell>Duration</TableCell>
                {isLg && <TableCell>Codec</TableCell>}
                {isLg && <TableCell>Audio</TableCell>}
                {isXl && <TableCell>Tracks</TableCell>}
                {isXl && <TableCell>Added</TableCell>}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map(file => (
                <MediaRow key={file.id} file={file} isLg={isLg} isXl={isXl}
                  selected={selected.has(file.id)} selectMode={selectMode} actions={rowActions} />
              ))}
              {isFetchingNextPage && [...Array(3)].map((_, i) => <SkeletonRow key={`sk-${i}`} cols={extraCols} />)}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Infinite-scroll sentinel */}
      <Box ref={sentinelRef} sx={{ height: 40, mt: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {!isLoading && hasNextPage && !isFetchingNextPage && <Typography variant="caption" color="text.disabled">Scroll to load more…</Typography>}
        {!isLoading && !hasNextPage && files.length > 0 && <Typography variant="caption" color="text.disabled">All {totalElements} files loaded</Typography>}
      </Box>

      {/* Selection action bar — full-width, pinned to the bottom on every screen
          (with safe-area inset) so the Delete button can never be clipped/hidden. */}
      <AnimatePresence>
        {selectMode && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1250 }}>
            <Paper elevation={8} square sx={{
              px: { xs: 1.5, sm: 3 }, py: 1,
              pb: 'calc(8px + env(safe-area-inset-bottom, 0px))',
              borderTop: '1px solid', borderColor: 'divider',
              display: 'flex', alignItems: 'center', gap: 1,
            }}>
              <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>{selected.size} selected</Typography>
              <Button size="small" onClick={toggleAll} sx={{ textTransform: 'none', minWidth: 0 }}>{allSelected ? 'None' : 'All'}</Button>
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="contained" endIcon={<KeyboardArrowDown />} disabled={selected.size === 0}
                onClick={(e) => setBulkAnchor(e.currentTarget)}
                sx={{ bgcolor: T.teal, '&:hover': { bgcolor: '#0f766e' } }}>Actions</Button>
              <Menu anchorEl={bulkAnchor} open={!!bulkAnchor} onClose={() => setBulkAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <MenuItem onClick={() => { doBulkAction('rescan', [...selected]); setBulkAnchor(null); }}>
                  <ListItemIcon><Refresh fontSize="small" /></ListItemIcon><ListItemText>Rescan metadata</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { doBulkAction('storyboard', [...selected]); setBulkAnchor(null); }}>
                  <ListItemIcon><Theaters fontSize="small" /></ListItemIcon><ListItemText>Generate storyboards</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { doBulkAction('repair', [...selected]); setBulkAnchor(null); }}>
                  <ListItemIcon><Build fontSize="small" /></ListItemIcon><ListItemText>Repair symlinks</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { setDeleteTarget([...selected]); setBulkAnchor(null); }} sx={{ color: 'error.main' }}>
                  <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete</ListItemText>
                </MenuItem>
              </Menu>
              <Button size="small" variant="outlined" onClick={exitSelect}>Done</Button>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      <TrackDetailModal fileId={detailFileId} onClose={() => setDetailFileId(null)}
        onRescan={doRescan} onStoryboard={doStoryboard} onRepair={doRepair}
        onLink={(id) => setLinkTarget(id)} onCopyPath={doCopyPath} onDelete={(ids) => setDeleteTarget(ids)} />

      <DeleteDialog open={!!deleteTarget} count={deleteTarget?.length ?? 0}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(purge) => { doDelete(deleteTarget, purge); if (selectMode) exitSelect(); }} />

      <LinkRecordDialog open={!!linkTarget} fileId={linkTarget} onClose={() => setLinkTarget(null)} />
    </Box>
    </ThemeProvider>
  );
}
