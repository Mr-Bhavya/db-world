import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { notify } from '@shared/notify';
import {
  Box, Typography, Stack, Chip, Tooltip, Checkbox, IconButton,
  Button, TextField, InputAdornment, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Select, MenuItem, FormControl,
  InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Divider,
  Alert, CircularProgress, alpha, useMediaQuery, useTheme as useMuiTheme,
  Menu, ListItemIcon, ListItemText, Tab, Tabs, Skeleton, LinearProgress, Collapse,
} from '@mui/material';
import {
  SearchRounded, DeleteOutlineRounded, RefreshRounded, LinkOffRounded, LinkRounded,
  VideoFileRounded, AudioFileRounded, SubtitlesRounded, ImageRounded,
  BuildRounded, DeleteForeverRounded, LibraryAddCheckRounded, CheckCircleRounded,
  MoreVertRounded, ContentCopyRounded, SyncRounded, CleaningServicesRounded,
  AutoFixHighRounded, DangerousRounded, InsertDriveFileRounded, KeyboardArrowDownRounded,
  CloseRounded, OpenInNewRounded, TvRounded, SaveRounded, BurstModeRounded,
  AspectRatioRounded, ChecklistRounded, InfoOutlineRounded, VideoLibraryRounded,
  FourKRounded, HdrOnRounded, StorageRounded,
} from '@mui/icons-material';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
import {
  AdminPage, SectionCard, StatCard, StatGrid, StickyBar, AdminActionButton,
  EmptyState, ErrorState, TableSkeleton, adminSurface, useSwipeNav,
} from '@features/admin/adminUi';
import RecordSearch from '../ingestion/form/RecordSearch';
import { EpisodePicker, SeasonPicker, useTmdbSeasons } from '../ingestion/form/EpisodePickers';
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

// Resolution tier → theme token (replaces the old hardcoded RES_COLOR hex map so
// the badges stay legible + on-palette in both light and dark).
function resTierColor(T, label) {
  switch (label) {
    case '8K':    return T.error;
    case '4K':    return T.warning;
    case '1440p': return T.violet;
    case '1080p': return T.success;
    case '720p':  return T.info;
    case '480p':  return T.textMuted;
    default:      return T.textFaint;   // SD / unknown
  }
}

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

// Track type → { token key on the theme, icon }. Colours route through tokens so
// every track chip adapts to the active theme.
const TRACK_META = {
  General: { key: 'textMuted', icon: InsertDriveFileRounded, label: 'General'  },
  Video:   { key: 'teal',      icon: VideoFileRounded,       label: 'Video'    },
  Audio:   { key: 'success',   icon: AudioFileRounded,       label: 'Audio'    },
  Text:    { key: 'warning',   icon: SubtitlesRounded,       label: 'Subtitle' },
  Image:   { key: 'violet',    icon: ImageRounded,           label: 'Image'    },
};

// ─── small shared bits ──────────────────────────────────────────────────────

const chipSx = { height: 18, fontSize: '0.62rem', fontWeight: 600 };

/** A flat, theme-aware chip tinted by a single token colour. */
const tintChip = (color) => ({
  ...chipSx, color,
  bgcolor: alpha(color, 0.14),
  border: `1px solid ${alpha(color, 0.32)}`,
  '& .MuiChip-icon': { color },
});

/** Neutral outlined chip (ext / codec) — solid, token borders. */
const neutralChipSx = (T, S) => ({
  ...chipSx, color: T.textMuted, bgcolor: S.inset, border: `1px solid ${S.border}`,
});

/** Shared token styling for portalled Menus. */
const menuPaper = (T) => {
  const S = adminSurface(T);
  return {
    bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 2,
    boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
    '& .MuiMenuItem-root': { fontSize: '0.82rem', color: T.text, '&:hover': { bgcolor: T.tealBg } },
    '& .MuiListItemIcon-root': { color: T.textMuted, minWidth: 32 },
    '& .MuiListItemText-secondary': { color: T.textFaint, fontSize: '0.7rem' },
  };
};

/** Token-styled input sx (used for dialogs / inline forms). */
const fieldSx = (T) => ({
  '& .MuiOutlinedInput-root': {
    color: T.text, bgcolor: T.inputBg,
    '& fieldset': { borderColor: T.border },
    '&:hover fieldset': { borderColor: T.teal },
    '&.Mui-focused fieldset': { borderColor: T.teal },
  },
  '& .MuiInputLabel-root': { color: T.textMuted },
  '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: T.textFaint },
});

function ExtChip({ name }) {
  const T = useT(); const S = adminSurface(T);
  return <Chip label={getExt(name)} size="small" sx={neutralChipSx(T, S)} />;
}

function LinkChip({ linked, onLink }) {
  const T = useT(); const S = adminSurface(T);
  return linked
    ? <Chip icon={<CheckCircleRounded sx={{ fontSize: '11px !important' }} />} label="Linked" size="small" sx={tintChip(T.success)} />
    : <Chip icon={<LinkOffRounded sx={{ fontSize: '11px !important' }} />} label="Unlinked" size="small"
        onClick={onLink ? (e) => { e.stopPropagation(); onLink(); } : undefined}
        sx={{ ...neutralChipSx(T, S), cursor: onLink ? 'pointer' : 'default',
          ...(onLink && { '&:hover': { borderColor: T.teal, color: T.teal } }) }} />;
}

function EpisodeChip({ file }) {
  const T = useT();
  if (file.tmdbSeasonNumber == null && file.tmdbEpisodeNumber == null) return null;
  return (
    <Chip icon={<TvRounded sx={{ fontSize: '11px !important' }} />}
      label={`S${String(file.tmdbSeasonNumber ?? '?').padStart(2, '0')}E${String(file.tmdbEpisodeNumber ?? '?').padStart(2, '0')}`}
      size="small" sx={tintChip(T.info)} />
  );
}

function ResChips({ file, showDims }) {
  const T = useT();
  const r = resolutionView(file);
  if (!r.label && !file.hdrFormat) return <Typography variant="caption" sx={{ color: T.textFaint }}>—</Typography>;
  const color = resTierColor(T, r.label);
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      {r.label && <Chip label={r.label} size="small" sx={{ ...tintChip(color), fontWeight: 700 }} />}
      {file.hdrFormat && <Chip label="HDR" size="small" sx={tintChip(T.warning)} />}
      {showDims && r.dispW && r.dispH && (
        <Typography variant="caption" sx={{ color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>
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

// ─── shared per-file action menu (used by rows, cards, and the modal) ────────

function fileActionItems(file, actions, close, T) {
  const S = adminSurface(T);
  const run = (fn, arg) => () => { fn(arg); close(); };
  const { onOpen, onRescan, onStoryboard, onRepair, onLink, onCopyPath, onDelete } = actions;
  return (
    <>
      {onOpen && (
        <MenuItem onClick={run(onOpen, file.id)}>
          <ListItemIcon><OpenInNewRounded fontSize="small" /></ListItemIcon>
          <ListItemText>View details</ListItemText>
        </MenuItem>
      )}
      <MenuItem onClick={run(onRescan, file.id)}>
        <ListItemIcon><RefreshRounded fontSize="small" /></ListItemIcon>
        <ListItemText>Rescan metadata</ListItemText>
      </MenuItem>
      <MenuItem onClick={run(onStoryboard, file.id)}>
        <ListItemIcon><BurstModeRounded fontSize="small" /></ListItemIcon>
        <ListItemText>{file.hasStoryboard || file.storyboardCount ? 'Regenerate storyboard' : 'Generate storyboard'}</ListItemText>
      </MenuItem>
      <MenuItem onClick={run(onRepair, file.id)}>
        <ListItemIcon><AutoFixHighRounded fontSize="small" /></ListItemIcon>
        <ListItemText>Repair symlink</ListItemText>
      </MenuItem>
      <MenuItem onClick={run(onLink, file.id)}>
        <ListItemIcon><LinkRounded fontSize="small" /></ListItemIcon>
        <ListItemText>Link to record</ListItemText>
      </MenuItem>
      <MenuItem onClick={run(onCopyPath, file.filePath)}>
        <ListItemIcon><ContentCopyRounded fontSize="small" /></ListItemIcon>
        <ListItemText>Copy path</ListItemText>
      </MenuItem>
      <Divider sx={{ borderColor: S.divider }} />
      <MenuItem onClick={run(onDelete, [file.id])} sx={{ color: T.error, '&:hover': { bgcolor: T.errorBg } }}>
        <ListItemIcon sx={{ color: `${T.error} !important` }}><DeleteOutlineRounded fontSize="small" /></ListItemIcon>
        <ListItemText>Delete</ListItemText>
      </MenuItem>
    </>
  );
}

function FileActionsMenu({ file, anchorEl, onClose, ...actions }) {
  const T = useT();
  return (
    // stopPropagation: the Menu portals to <body> in the DOM but stays a React child
    // of the clickable row/card, so item/backdrop clicks would otherwise bubble
    // (through the portal) into the row onClick and open the detail modal.
    <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={onClose}
      onClick={(e) => e.stopPropagation()}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      slotProps={{ paper: { sx: menuPaper(T) } }}>
      {fileActionItems(file, actions, onClose, T)}
    </Menu>
  );
}

// ─── desktop / monitor table row ─────────────────────────────────────────────

function MediaRow({ file, isLg, isXl, selected, selectMode, actions }) {
  const T = useT(); const S = adminSurface(T);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const { onSelect, onOpen, onLink } = actions;
  const handleClick = () => (selectMode ? onSelect(file.id) : onOpen(file.id));

  return (
    <TableRow hover onClick={handleClick}
      sx={{ cursor: 'pointer', bgcolor: selected ? T.tealBg : undefined,
        '& td': { py: 0.75, borderColor: S.divider },
        '&:hover': { bgcolor: selected ? T.tealBgHover : S.cardHover } }}>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          {selectMode && (
            <Checkbox size="small" checked={selected} onClick={(e) => e.stopPropagation()}
              onChange={() => onSelect(file.id)}
              sx={{ p: 0.25, flexShrink: 0, color: T.textMuted, '&.Mui-checked': { color: T.teal } }} />
          )}
          <InsertDriveFileRounded sx={{ fontSize: 18, color: T.textFaint, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={file.fileName}
              sx={{ color: T.text, maxWidth: { md: 220, lg: 320, xl: 460 } }}>
              {file.fileName}
            </Typography>
            <Stack direction="row" spacing={0.5} mt={0.25} alignItems="center" flexWrap="wrap" useFlexGap>
              <ExtChip name={file.fileName} />
              <LinkChip linked={!!file.recordId} onLink={() => onLink(file.id)} />
              <EpisodeChip file={file} />
              {file.hasStoryboard && (
                <Tooltip title="Scrub-preview storyboard available">
                  <BurstModeRounded sx={{ fontSize: 15, color: T.textFaint }} />
                </Tooltip>
              )}
            </Stack>
          </Box>
        </Stack>
      </TableCell>

      <TableCell><ResChips file={file} showDims={isLg} /></TableCell>
      <TableCell align="right"><Typography variant="caption" sx={{ color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fmtBytes(file.fileSize)}</Typography></TableCell>
      <TableCell><Typography variant="caption" sx={{ color: T.textMuted }}>{fmtDuration(file.duration)}</Typography></TableCell>

      {isLg && (
        <TableCell>
          {file.videoCodec
            ? <Chip label={file.videoCodec} size="small" sx={neutralChipSx(T, S)} />
            : <Typography variant="caption" sx={{ color: T.textFaint }}>—</Typography>}
        </TableCell>
      )}
      {isLg && (
        <TableCell>
          <Typography variant="caption" sx={{ color: T.textMuted }} noWrap>{audioSummary(file) || '—'}</Typography>
        </TableCell>
      )}
      {isXl && (
        <TableCell>
          <Stack direction="row" spacing={0.5}>
            {file.videoCount > 0 && <Chip icon={<VideoFileRounded sx={{ fontSize: '11px !important' }} />} label={file.videoCount} size="small" sx={tintChip(T.teal)} />}
            {file.audioCount > 0 && <Chip icon={<AudioFileRounded sx={{ fontSize: '11px !important' }} />} label={file.audioCount} size="small" sx={tintChip(T.success)} />}
            {file.textCount  > 0 && <Chip icon={<SubtitlesRounded  sx={{ fontSize: '11px !important' }} />} label={file.textCount}  size="small" sx={tintChip(T.warning)} />}
          </Stack>
        </TableCell>
      )}
      {isXl && <TableCell><Typography variant="caption" sx={{ color: T.textMuted }}>{fmtDate(file.createdAt)}</Typography></TableCell>}

      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}><MoreVertRounded fontSize="small" /></IconButton>
        <FileActionsMenu file={file} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} {...actions} />
      </TableCell>
    </TableRow>
  );
}

// ─── mobile card — compact, nothing cut off ──────────────────────────────────

function MediaCard({ file, selected, selectMode, actions }) {
  const T = useT(); const S = adminSurface(T);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const { onSelect, onOpen, onLink } = actions;
  const audio = audioSummary(file);
  const handleClick = () => (selectMode ? onSelect(file.id) : onOpen(file.id));

  return (
    <Box onClick={handleClick}
      sx={{
        borderRadius: 2.5, p: 1.25, cursor: 'pointer',
        bgcolor: selected ? T.tealBg : S.card,
        border: `1px solid ${selected ? T.teal : S.border}`,
        transition: 'border-color .15s, background .15s',
        '&:active': { bgcolor: T.tealBg },
      }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        {selectMode && (
          <Checkbox size="small" checked={selected} onClick={(e) => e.stopPropagation()}
            onChange={() => onSelect(file.id)}
            sx={{ p: 0.25, mt: -0.25, flexShrink: 0, color: T.textMuted, '&.Mui-checked': { color: T.teal } }} />
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Full filename — wraps, never truncated */}
          <Typography variant="body2" fontWeight={600} title={file.fileName}
            sx={{ color: T.text, fontSize: '0.8rem', lineHeight: 1.35, wordBreak: 'break-word' }}>
            {file.fileName}
          </Typography>

          <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.75} alignItems="center" useFlexGap>
            <ExtChip name={file.fileName} />
            <ResChips file={file} />
            {file.videoCodec && <Chip label={file.videoCodec} size="small" sx={neutralChipSx(T, S)} />}
            <Chip label={fmtBytes(file.fileSize)} size="small" sx={neutralChipSx(T, S)} />
            {fmtDuration(file.duration) !== '—' && <Chip label={fmtDuration(file.duration)} size="small" sx={neutralChipSx(T, S)} />}
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5} alignItems="center" useFlexGap>
            <LinkChip linked={!!file.recordId} onLink={() => onLink(file.id)} />
            <EpisodeChip file={file} />
            {file.hasStoryboard && <Chip icon={<BurstModeRounded sx={{ fontSize: '11px !important' }} />} label="preview" size="small" sx={neutralChipSx(T, S)} />}
          </Stack>

          {audio && (
            <Typography variant="caption" sx={{ color: T.textMuted, display: 'block', mt: 0.5, wordBreak: 'break-word' }}>
              {audio}
            </Typography>
          )}
        </Box>

        {!selectMode && (
          <IconButton size="small" sx={{ flexShrink: 0, color: T.textMuted, '&:hover': { color: T.teal } }}
            onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}>
            <MoreVertRounded fontSize="small" />
          </IconButton>
        )}
        <FileActionsMenu file={file} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} {...actions} />
      </Stack>
    </Box>
  );
}

// ─── skeletons ────────────────────────────────────────────────────────────────

function SkeletonRow({ cols }) {
  const T = useT(); const S = adminSurface(T);
  const bg = { bgcolor: S.inset };
  return (
    <TableRow>
      <TableCell sx={{ borderColor: S.divider }}><Stack direction="row" spacing={1}><Skeleton variant="circular" width={18} height={18} sx={bg} /><Box><Skeleton width={200} height={16} sx={bg} /><Skeleton width={90} height={12} sx={{ ...bg, mt: 0.5 }} /></Box></Stack></TableCell>
      {[...Array(cols)].map((_, i) => <TableCell key={i} sx={{ borderColor: S.divider }}><Skeleton width={60} sx={bg} /></TableCell>)}
      <TableCell align="right" sx={{ borderColor: S.divider }}><Skeleton width={28} height={28} sx={{ ...bg, ml: 'auto' }} /></TableCell>
    </TableRow>
  );
}

function SkeletonCard() {
  const T = useT(); const S = adminSurface(T);
  const bg = { bgcolor: S.inset };
  return (
    <Box sx={{ borderRadius: 2.5, p: 1.25, bgcolor: S.card, border: `1px solid ${S.border}` }}>
      <Skeleton height={16} width="80%" sx={bg} />
      <Skeleton height={16} width="55%" sx={{ ...bg, mb: 0.75 }} />
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {[50, 40, 60, 45].map((w, i) => <Skeleton key={i} width={w} height={20} sx={{ ...bg, borderRadius: 3 }} />)}
      </Stack>
    </Box>
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
  const T = useT(); const S = adminSurface(T);
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
          <Stack key={k} direction="row" spacing={1} sx={{ py: 0.4, borderBottom: `1px solid ${S.divider}`, minWidth: 0 }}>
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
  const T = useT(); const S = adminSurface(T);
  const [showPreview, setShowPreview] = useState(true);   // expanded by default so Overview isn't empty
  const has = !!file?.storyboardCount;
  const spriteUrl = has ? `${getApiBaseUrl()}/storyboard/${file.id}.jpg` : null;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: `1px solid ${S.divider}` }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <BurstModeRounded sx={{ fontSize: 18, color: T.textMuted }} />
        <Typography variant="body2" fontWeight={600} sx={{ color: T.text }}>Storyboard</Typography>
        {has
          ? <Chip size="small" label={`${file.storyboardCount} frames · ${file.storyboardCols}×${file.storyboardRows}`} sx={{ ...tintChip(T.success), height: 20, fontSize: '0.65rem' }} />
          : <Chip size="small" label="Not generated" sx={{ ...neutralChipSx(T, S), height: 20, fontSize: '0.65rem' }} />}
        <Box sx={{ flex: 1 }} />
        {has && (
          <Button size="small" onClick={() => setShowPreview(v => !v)} sx={{ textTransform: 'none', color: T.teal }}>
            {showPreview ? 'Hide' : 'Preview'}
          </Button>
        )}
        <Button size="small" variant="outlined" startIcon={<BurstModeRounded sx={{ fontSize: 15 }} />}
          onClick={() => onStoryboard(file.id)}
          sx={{ textTransform: 'none', borderColor: S.border, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg } }}>
          {has ? 'Regenerate' : 'Generate'}
        </Button>
      </Stack>
      <Collapse in={showPreview && has} unmountOnExit>
        <Box sx={{ mt: 1.5, overflow: 'auto', borderRadius: 1, border: `1px solid ${S.border}` }}>
          <img src={spriteUrl} alt="storyboard sprite" style={{ display: 'block', maxWidth: 'none', height: 120 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </Box>
      </Collapse>
    </Box>
  );
}

function EpisodeSection({ file }) {
  const T = useT(); const S = adminSurface(T);
  const [season, setSeason] = useState('');
  const [ep, setEp] = useState('');
  const [busy, setBusy] = useState(false);
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
      notify.success(clear ? 'Episode cleared' : 'Episode saved', { duration: 2000 });
      if (clear) { setSeason(''); setEp(''); }
    } catch (err) {
      notify.error(err?.response?.data?.message ?? 'Failed to save episode');
    } finally { setBusy(false); }
  };

  const current = file?.tmdbSeasonNumber != null || file?.tmdbEpisodeNumber != null;

  // The file already knows its record, so the pickers can offer that show's
  // real seasons and episodes rather than asking the admin to remember numbers.
  const tmdbSeasons = useTmdbSeasons(
    file?.recordId ? { id: file.recordId, type: file.recordType ?? 'TV_SERIES' } : null,
  );

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: `1px solid ${S.divider}` }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <TvRounded sx={{ fontSize: 18, color: T.textMuted }} />
        <Typography variant="body2" fontWeight={600} sx={{ color: T.text }}>Episode</Typography>
        {current
          ? <Chip size="small" sx={{ ...tintChip(T.info), height: 20, fontSize: '0.65rem' }}
              label={`S${String(file.tmdbSeasonNumber ?? '?').padStart(2, '0')}E${String(file.tmdbEpisodeNumber ?? '?').padStart(2, '0')}`} />
          : <Chip size="small" label="Not set" sx={{ ...neutralChipSx(T, S), height: 20, fontSize: '0.65rem' }} />}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
        {/* Same pickers as the ingestion form: TMDB's real seasons/episodes as a
            dropdown, but freeSolo so an unlisted episode is still typeable. */}
        <SeasonPicker
          seasons={tmdbSeasons}
          value={season === '' ? null : Number(season)}
          onChange={(v) => setSeason(v == null ? '' : String(v))}
          helperText={tmdbSeasons.length ? ' ' : 'TMDB has no seasons listed'}
          sx={{ ...fieldSx(T), width: 190 }}
        />
        <EpisodePicker
          seasons={tmdbSeasons}
          seasonNumber={season === '' ? null : Number(season)}
          value={ep === '' ? null : Number(ep)}
          onChange={(v) => setEp(v == null ? '' : String(v))}
          helperText=" "
          sx={{ ...fieldSx(T), width: 230 }}
        />
        <Button size="small" variant="contained" disabled={busy}
          startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <SaveRounded sx={{ fontSize: 15 }} />}
          onClick={() => persist(false)}
          sx={{ textTransform: 'none', bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Save</Button>
        {current && (
          <Button size="small" disabled={busy} onClick={() => persist(true)}
            sx={{ textTransform: 'none', color: T.error, '&:hover': { bgcolor: T.errorBg } }}>
            Clear
          </Button>
        )}
      </Stack>
      <Typography variant="caption" sx={{ color: T.textMuted, display: 'block', mt: 0.75 }}>
        Auto-detected from the filename on ingest; override here if it was wrong or missing.
      </Typography>
    </Box>
  );
}

const SEASON_EP_RE = /s\d{1,2}\s*[._-]?\s*e\d{1,3}/i;

function TrackDetailModal({ fileId, onClose, onRescan, onRepair, onLink, onCopyPath, onDelete, onStoryboard }) {
  const T = useT(); const S = adminSurface(T);
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
    const defs = [{ key: 'overview', label: 'Overview', icon: InfoOutlineRounded }];
    const byType = (type) => (file.tracks ?? []).filter(t => t.type === type);
    const g = byType('General');
    if (g.length) defs.push({ key: 'General', label: 'General', tracks: g, icon: InsertDriveFileRounded });
    const push = (type, label, icon) => { const t = byType(type); if (t.length) defs.push({ key: type, label: `${label} (${t.length})`, tracks: t, icon }); };
    push('Video', 'Video', VideoFileRounded);
    push('Audio', 'Audio', AudioFileRounded);
    push('Text', 'Subtitle', SubtitlesRounded);
    push('Image', 'Image', ImageRounded);
    return defs;
  }, [file]);

  const safeTab = Math.min(tab, Math.max(0, tabDefs.length - 1));
  const active = tabDefs[safeTab];

  // Swipe between tabs on touch devices — spread onto the scrollable content Box.
  const swipe = useSwipeNav({
    onPrev: () => setTab(() => Math.max(0, safeTab - 1)),
    onNext: () => setTab(() => Math.min(tabDefs.length - 1, safeTab + 1)),
  });

  return (
    <Dialog open={!!fileId} onClose={onClose} maxWidth="md" fullWidth fullScreen={mobile}
      slotProps={{ paper: { sx: { bgcolor: S.card, backgroundImage: 'none', border: mobile ? 'none' : `1px solid ${S.border}`, borderRadius: mobile ? 0 : 3, height: mobile ? '100%' : '82vh', maxHeight: mobile ? '100%' : '82vh', display: 'flex', flexDirection: 'column' } } }}>
      {/* Compact header — filename, path, actions. Kept small so the tabs sit high. */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1, flexShrink: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} title={file?.fileName}
              sx={{ color: T.text, wordBreak: 'break-word', lineHeight: 1.3, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              {isLoading ? <Skeleton width={220} sx={{ bgcolor: S.inset }} /> : file?.fileName}
            </Typography>
            <Typography variant="caption" fontFamily="monospace"
              sx={{ color: T.textMuted, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isLoading ? <Skeleton width={280} sx={{ bgcolor: S.inset }} /> : file?.filePath}
            </Typography>
          </Box>
          {/* Actions: overflow menu on mobile, icon row on desktop. Close always visible. */}
          <Stack direction="row" spacing={0.5} flexShrink={0}>
            {file && (mobile ? (
              <>
                <IconButton size="small" onClick={(e) => setActAnchor(e.currentTarget)} sx={{ color: T.textMuted }}><MoreVertRounded fontSize="small" /></IconButton>
                <Menu anchorEl={actAnchor} open={!!actAnchor} onClose={() => setActAnchor(null)} slotProps={{ paper: { sx: menuPaper(T) } }}>
                  {fileActionItems(file, actions, () => setActAnchor(null), T)}
                </Menu>
              </>
            ) : (
              <>
                <Tooltip title="Rescan metadata"><IconButton size="small" onClick={() => { onRescan(fileId); onClose(); }} sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}><RefreshRounded fontSize="small" /></IconButton></Tooltip>
                <Tooltip title={file.storyboardCount ? 'Regenerate storyboard' : 'Generate storyboard'}><IconButton size="small" onClick={() => onStoryboard(fileId)} sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}><BurstModeRounded fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Repair symlink"><IconButton size="small" onClick={() => onRepair(fileId)} sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}><AutoFixHighRounded fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Copy path"><IconButton size="small" onClick={() => onCopyPath(file?.filePath)} sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}><ContentCopyRounded fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" onClick={() => { onDelete([fileId]); onClose(); }} sx={{ color: T.textMuted, '&:hover': { color: T.error } }}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>
              </>
            ))}
            <IconButton size="small" onClick={onClose} sx={{ color: T.textMuted, '&:hover': { color: T.text } }}><CloseRounded fontSize="small" /></IconButton>
          </Stack>
        </Stack>
      </Box>

      {isLoading && <LinearProgress sx={{ bgcolor: T.tealBg, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />}

      {!isLoading && tabDefs.length > 0 && (
        <Tabs value={safeTab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ borderTop: `1px solid ${S.divider}`, borderBottom: `1px solid ${S.divider}`, minHeight: 42, flexShrink: 0,
                '& .MuiTabs-indicator': { backgroundColor: T.teal },
                '& .MuiTab-root': { minHeight: 42, fontSize: '0.75rem', py: 0.5, textTransform: 'none', color: T.textMuted, '&.Mui-selected': { color: T.teal } } }}>
          {tabDefs.map((td, i) => { const Ic = td.icon; return <Tab key={i} label={td.label} icon={<Ic sx={{ fontSize: 15 }} />} iconPosition="start" />; })}
        </Tabs>
      )}

      <DialogContent {...swipe} sx={{ p: 0, overflow: 'auto', flex: 1, bgcolor: S.card }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}>{[...Array(8)].map((_, i) => <Skeleton key={i} height={20} sx={{ mb: 0.5, bgcolor: S.inset }} />)}</Box>
        ) : !file ? null : active?.key === 'overview' ? (
          <Box>
            {(res?.mismatch || res?.anamorphic || !file.tracks?.length) && (
              <Box sx={{ px: { xs: 2, sm: 3 }, pt: 1.5 }}>
                {res && res.dispW && (res.mismatch || res.anamorphic) && (
                  <Alert severity="info" variant="outlined" icon={<AspectRatioRounded fontSize="small" />} sx={{ py: 0, color: T.text, borderColor: alpha(T.info, 0.4), '& .MuiAlert-icon': { color: T.info }, '& .MuiAlert-message': { py: 0.5 } }}>
                    <Typography variant="caption">
                      {res.anamorphic
                        ? <>Anamorphic — stored <b>{res.rawW}×{res.rawH}</b>, displays <b>{res.dispW}×{res.dispH}</b>. </>
                        : null}
                      Detected video is <b>{res.dispW}×{res.dispH}</b> ({res.detectedLabel}); showing <b>{res.label}</b> from the filename.
                    </Typography>
                  </Alert>
                )}
                {!file.tracks?.length && (
                  <Alert severity="warning" variant="outlined" sx={{ mt: (res?.mismatch || res?.anamorphic) ? 1 : 0, py: 0, color: T.text, borderColor: alpha(T.warning, 0.4), '& .MuiAlert-icon': { color: T.warning }, '& .MuiAlert-message': { py: 0.5 } }}>
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
            const metaColor = T[meta.key] ?? T.textMuted;
            const list = active.tracks;
            const cover = track.type === 'Video' && isCoverArt(track.format);
            return (
              <Box key={i} sx={{ p: 2, borderBottom: i < list.length - 1 ? `1px solid ${S.divider}` : 'none' }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1} flexWrap="wrap" useFlexGap>
                  <Chip icon={<Ic sx={{ fontSize: '13px !important' }} />} label={`${meta.label} ${i + 1}`}
                    size="small" sx={{ ...tintChip(metaColor), fontSize: '0.7rem', height: 22 }} />
                  {cover && <Chip label="cover art" size="small" sx={tintChip(T.violet)} />}
                  {track.type === 'Video' && !cover && track.resolutionLabel && (
                    <Chip label={`${track.resolutionLabel}${track.displayWidth ? ` · ${track.displayWidth}×${track.displayHeight}` : ''}`}
                      size="small" sx={neutralChipSx(T, S)} />
                  )}
                  {track.defaultTrack === 'Yes' && <Chip label="default" size="small" sx={neutralChipSx(T, S)} />}
                  {track.forced === 'Yes' && <Chip label="forced" size="small" sx={tintChip(T.warning)} />}
                  {track.language && <Chip label={track.language.toUpperCase()} size="small" sx={neutralChipSx(T, S)} />}
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
  const T = useT();
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== '' && v !== undefined);
  if (entries.length === 0) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2px 12px' }}>
      {entries.map(([k, v]) => (
        <Stack key={k} direction="row" spacing={0.75} alignItems="baseline" sx={{ overflow: 'hidden', py: '1px' }}>
          <Typography variant="caption"
            sx={{ color: T.textMuted, minWidth: 0, flexShrink: 0, maxWidth: '42%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.68rem' }}>
            {k}
          </Typography>
          <Typography variant="caption" fontWeight={500}
            sx={{ color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: '0.72rem' }}>
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

// ─── DeleteDialog ──────────────────────────────────────────────────────────────

function DeleteDialog({ open, count, onClose, onConfirm }) {
  const T = useT(); const S = adminSurface(T);
  const [purge, setPurge] = useState(false);
  const handleClose = () => { setPurge(false); onClose(); };
  const optionSx = (activeCol, on) => ({
    p: 1.5, borderRadius: 2, cursor: 'pointer',
    bgcolor: on ? alpha(activeCol, 0.1) : S.card,
    border: `1px solid ${on ? activeCol : S.border}`,
    transition: 'border-color .15s, background .15s',
  });
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth
      slotProps={{ paper: { sx: { bgcolor: S.card, backgroundImage: 'none', border: `1px solid ${S.border}`, borderRadius: 3 } } }}>
      <DialogTitle sx={{ color: T.text, fontWeight: 700 }}>Delete {count > 1 ? `${count} files` : 'file'}?</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Box onClick={() => setPurge(false)} sx={optionSx(T.teal, !purge)}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <LibraryAddCheckRounded sx={{ color: !purge ? T.teal : T.textFaint }} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: T.text }}>Remove from library</Typography>
                <Typography variant="caption" sx={{ color: T.textMuted }}>Removes DB entry and symlink. File stays on disk.</Typography>
              </Box>
            </Stack>
          </Box>
          <Box onClick={() => setPurge(true)} sx={optionSx(T.error, purge)}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DeleteForeverRounded sx={{ color: purge ? T.error : T.textFaint }} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: purge ? T.error : T.text }}>Delete permanently</Typography>
                <Typography variant="caption" sx={{ color: T.textMuted }}>Removes DB entry, symlink, <strong>and the actual file</strong>. Cannot be undone.</Typography>
              </Box>
            </Stack>
          </Box>
          {purge && (
            <Alert severity="error" variant="outlined" icon={<DangerousRounded fontSize="small" />} sx={{ py: 0.5, color: T.text, borderColor: alpha(T.error, 0.4), '& .MuiAlert-icon': { color: T.error } }}>
              <Typography variant="caption">File{count > 1 ? 's' : ''} will be permanently erased from storage.</Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" onClick={() => { onConfirm(purge); handleClose(); }}
          sx={{ bgcolor: purge ? T.error : T.teal, '&:hover': { bgcolor: purge ? T.error : T.tealHover, filter: purge ? 'brightness(0.92)' : 'none' } }}>
          {purge ? 'Delete permanently' : 'Remove from library'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── LinkRecordDialog ────────────────────────────────────────────────────────

function LinkRecordDialog({ open, fileId, onClose }) {
  const T = useT(); const S = adminSurface(T);
  const [record, setRecord] = useState(null);
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    if (!record) return;
    setLoading(true);
    try {
      await linkMediaFileToRecord(fileId, record.id);
      notify.success('File linked to record');
      qc.invalidateQueries({ queryKey: ['mediaFiles'] });
      qc.invalidateQueries({ queryKey: ['mediaFilesStats'] });
      qc.invalidateQueries({ queryKey: ['mediaFileDetail', fileId] });
      onClose();
      setRecord(null);
    } catch (e) {
      notify.error(e?.response?.data?.message ?? 'Failed to link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { bgcolor: S.card, backgroundImage: 'none', border: `1px solid ${S.border}`, borderRadius: 3 } } }}>
      <DialogTitle sx={{ color: T.text, fontWeight: 700 }}>Link to Record</DialogTitle>
      <DialogContent><Box pt={1}><RecordSearch value={record} onChange={setRecord} /></Box></DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" disabled={!record || loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <LinkRounded />} onClick={handleLink}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Link</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── MaintenanceMenu — single labeled page action + token-styled menu ──────────

function MaintenanceMenu({ onRepairAll, onRebuild, onCleanup, onSync, busy }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);
  return (
    <>
      <AdminActionButton variant="secondary" icon={BuildRounded} loading={busy}
        endIcon={<KeyboardArrowDownRounded sx={{ fontSize: 18 }} />}
        onClick={(e) => setAnchor(e.currentTarget)}>
        Maintenance
      </AdminActionButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close} slotProps={{ paper: { sx: menuPaper(T) } }}>
        <MenuItem onClick={() => { onSync(); close(); }}>
          <ListItemIcon><SyncRounded fontSize="small" /></ListItemIcon>
          <ListItemText primary="Sync (cleanup + repair)" secondary="Remove orphans, repair symlinks" />
        </MenuItem>
        <MenuItem onClick={() => { onRepairAll(); close(); }}>
          <ListItemIcon><AutoFixHighRounded fontSize="small" /></ListItemIcon>
          <ListItemText primary="Repair symlinks" />
        </MenuItem>
        <MenuItem onClick={() => { onRebuild(); close(); }}>
          <ListItemIcon><BuildRounded fontSize="small" /></ListItemIcon>
          <ListItemText primary="Rebuild all symlinks" />
        </MenuItem>
        <MenuItem onClick={() => { onCleanup(); close(); }}>
          <ListItemIcon><CleaningServicesRounded fontSize="small" /></ListItemIcon>
          <ListItemText primary="Cleanup orphaned entries" />
        </MenuItem>
      </Menu>
    </>
  );
}

// ─── MediaFilesPage (main export) ──────────────────────────────────────────────

export default function MediaFilesPage() {
  const T = useT();
  const S = adminSurface(T);
  const qc = useQueryClient();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const isLg = useMediaQuery(muiTheme.breakpoints.up('lg'));
  const isXl = useMediaQuery(muiTheme.breakpoints.up('xl'));

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
      notify.success(`${ids.length} file(s) ${purge ? 'permanently deleted' : 'removed from library'}`);
      invalidateAll();
      setSelected(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
    } catch (e) {
      notify.error(e?.response?.data?.message ?? 'Delete failed');
    }
  }, [invalidateAll]);

  const doRescan = useCallback(async (id) => {
    try {
      await rescanMediaFile(id);
      notify.info('Rescan started');
      setTimeout(() => { invalidateAll(); qc.invalidateQueries({ queryKey: ['mediaFileDetail', id] }); }, 2000);
    } catch { notify.error('Rescan failed'); }
  }, [invalidateAll, qc]);

  const doStoryboard = useCallback(async (id) => {
    try {
      await generateStoryboard(id);
      notify.info('Storyboard generation started — this can take up to a minute');
      setTimeout(() => { invalidateAll(); qc.invalidateQueries({ queryKey: ['mediaFileDetail', id] }); }, 15000);
    } catch (e) {
      notify.error(e?.response?.data?.message ?? 'Storyboard generation failed');
    }
  }, [invalidateAll, qc]);

  const doRepair = useCallback(async (id) => {
    try {
      await repairSymlink(id);
      notify.success('Symlink repaired');
    } catch { notify.error('Repair failed'); }
  }, []);

  const doCopyPath = useCallback((path) => {
    navigator.clipboard?.writeText(path ?? '');
    notify.info('Path copied');
  }, []);

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
    notify[fail ? 'warning' : 'info'](`${cfg.verb} started for ${ok} file(s)${fail ? ` · ${fail} failed` : ''}`);
    setTimeout(invalidateAll, cfg.delay);
    setSelectMode(false);
    setSelected(new Set());
  }, [invalidateAll]);

  const doMaintenance = useCallback(async (action) => {
    setMainBusy(true);
    try {
      if (action === 'sync')    { await cleanupOrphanedFiles(); await repairAllSymlinks(false); notify.success('Sync complete'); }
      if (action === 'repair')  { await repairAllSymlinks(false); notify.success('Symlinks repaired'); }
      if (action === 'rebuild') { await rebuildAllSymlinks(); notify.success('Symlinks rebuilt'); }
      if (action === 'cleanup') { await cleanupOrphanedFiles(); notify.success('Cleanup done'); }
      invalidateAll();
    } catch (e) {
      notify.error(e?.response?.data?.message ?? 'Operation failed');
    } finally { setMainBusy(false); }
  }, [invalidateAll]);

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

  const extraCols = 3 + (isLg ? 2 : 0) + (isXl ? 2 : 0); // Quality, Size, Duration (+ codec/audio) (+ tracks/added)
  const subtitle = isLoading ? 'Loading…'
    : totalLoaded < totalElements
      ? `${totalLoaded} of ${totalElements} · ${fmtBytes(stats?.totalSize)}`
      : `${totalElements} files · ${fmtBytes(stats?.totalSize)}`;

  return (
    <AdminPage
      title="Media Files"
      subtitle={subtitle}
      icon={VideoLibraryRounded}
      onRefresh={invalidateAll}
      refreshing={isLoading || mainBusy}
      actions={
        <MaintenanceMenu busy={mainBusy}
          onSync={() => doMaintenance('sync')} onRepairAll={() => doMaintenance('repair')}
          onRebuild={() => doMaintenance('rebuild')} onCleanup={() => doMaintenance('cleanup')} />
      }
    >
      {/* Stats */}
      <StatGrid min={140} sx={{ mb: 2.5 }}>
        <StatCard index={0} icon={InsertDriveFileRounded} label="Total"    value={stats?.total ?? '—'}        accent={T.teal}    loading={statsLoading} />
        <StatCard index={1} icon={CheckCircleRounded}     label="Linked"   value={stats?.linked ?? '—'}       accent={T.success} loading={statsLoading} />
        <StatCard index={2} icon={LinkOffRounded}         label="Unlinked" value={stats?.unlinked ?? '—'}     accent={T.warning} loading={statsLoading} />
        <StatCard index={3} icon={FourKRounded}           label="4K / UHD" value={stats?.uhdCount ?? '—'}     accent={T.info}    loading={statsLoading} />
        <StatCard index={4} icon={HdrOnRounded}           label="HDR"      value={stats?.hdrCount ?? '—'}     accent={T.violet}  loading={statsLoading} />
        <StatCard index={5} icon={StorageRounded}         label="Size"     value={fmtBytes(stats?.totalSize)} accent={T.teal}    loading={statsLoading} />
      </StatGrid>

      {/* Toolbar — sticky search / filters / sort */}
      <StickyBar>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
          <TextField size="small" placeholder="Search filename…" value={search} onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18, color: T.textMuted }} /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')} sx={{ color: T.textMuted }}><CloseRounded fontSize="small" /></IconButton></InputAdornment> : null,
            }}
            sx={{ ...fieldSx(T), flex: 1, minWidth: { xs: '100%', sm: 200 } }} />
          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }} flexWrap="wrap" useFlexGap>
            <FormControl size="small" sx={{ ...fieldSx(T), flex: 1, minWidth: 104 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); clearSelection(); }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="linked">Linked</MenuItem>
                <MenuItem value="unlinked">Unlinked</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ ...fieldSx(T), flex: 1, minWidth: 120 }}>
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
              <Button size="small" variant={selectMode ? 'contained' : 'outlined'} startIcon={<ChecklistRounded />}
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                sx={{ flexShrink: 0, minWidth: 0, textTransform: 'none',
                  ...(selectMode
                    ? { bgcolor: T.teal, color: '#fff', '&:hover': { bgcolor: T.tealHover } }
                    : { borderColor: S.border, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg } }) }}>
                {selectMode ? 'Cancel' : 'Select'}
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
      </StickyBar>

      {/* Content */}
      <SectionCard padding={false} flushMobile>
        {error ? (
          <ErrorState message={`Failed to load: ${error.message}`} onRetry={invalidateAll} />
        ) : isLoading ? (
          <Box sx={{ p: { xs: 0, sm: 1.5, md: 2 } }}>
            {isMobile
              ? <Stack spacing={1.25}>{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</Stack>
              : <TableSkeleton rows={10} />}
          </Box>
        ) : files.length === 0 ? (
          <EmptyState
            icon={InsertDriveFileRounded}
            title={totalElements === 0 ? 'No media files found' : 'No matching files'}
            message={totalElements === 0 ? 'Ingest media to populate the library.' : 'No files match the current filters.'}
          />
        ) : isMobile ? (
          <Stack spacing={1.25}>
            {files.map(file => (
              <MediaCard key={file.id} file={file} selected={selected.has(file.id)} selectMode={selectMode} actions={rowActions} />
            ))}
            {isFetchingNextPage && [...Array(3)].map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { borderColor: S.divider } }}>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '.05em', color: T.textMuted, bgcolor: S.inset } }}>
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
      </SectionCard>

      {/* Infinite-scroll sentinel */}
      <Box ref={sentinelRef} sx={{ height: 40, mt: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {!isLoading && hasNextPage && !isFetchingNextPage && <Typography variant="caption" sx={{ color: T.textFaint }}>Scroll to load more…</Typography>}
        {!isLoading && !hasNextPage && files.length > 0 && <Typography variant="caption" sx={{ color: T.textFaint }}>All {totalElements} files loaded</Typography>}
      </Box>

      {/* Spacer so the fixed selection bar never covers the last rows */}
      {selectMode && <Box sx={{ height: 80 }} />}

      {/* Selection action bar — full-width, pinned to the bottom on every screen
          (with safe-area inset) so the Delete button can never be clipped/hidden. */}
      <AnimatePresence>
        {selectMode && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1250 }}>
            <Box sx={{
              px: { xs: 1.5, sm: 3 }, py: 1,
              pb: 'calc(8px + env(safe-area-inset-bottom, 0px))',
              bgcolor: S.card, borderTop: `1px solid ${S.border}`,
              boxShadow: '0 -8px 28px rgba(0,0,0,0.24)',
              display: 'flex', alignItems: 'center', gap: 1,
            }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: T.text, whiteSpace: 'nowrap' }}>{selected.size} selected</Typography>
              <Button size="small" onClick={toggleAll} sx={{ textTransform: 'none', minWidth: 0, color: T.teal }}>{allSelected ? 'None' : 'All'}</Button>
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="contained" endIcon={<KeyboardArrowDownRounded />} disabled={selected.size === 0}
                onClick={(e) => setBulkAnchor(e.currentTarget)}
                sx={{ textTransform: 'none', bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}>Actions</Button>
              <Menu anchorEl={bulkAnchor} open={!!bulkAnchor} onClose={() => setBulkAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                slotProps={{ paper: { sx: menuPaper(T) } }}>
                <MenuItem onClick={() => { doBulkAction('rescan', [...selected]); setBulkAnchor(null); }}>
                  <ListItemIcon><RefreshRounded fontSize="small" /></ListItemIcon><ListItemText>Rescan metadata</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { doBulkAction('storyboard', [...selected]); setBulkAnchor(null); }}>
                  <ListItemIcon><BurstModeRounded fontSize="small" /></ListItemIcon><ListItemText>Generate storyboards</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { doBulkAction('repair', [...selected]); setBulkAnchor(null); }}>
                  <ListItemIcon><AutoFixHighRounded fontSize="small" /></ListItemIcon><ListItemText>Repair symlinks</ListItemText>
                </MenuItem>
                <Divider sx={{ borderColor: S.divider }} />
                <MenuItem onClick={() => { setDeleteTarget([...selected]); setBulkAnchor(null); }} sx={{ color: T.error, '&:hover': { bgcolor: T.errorBg } }}>
                  <ListItemIcon sx={{ color: `${T.error} !important` }}><DeleteOutlineRounded fontSize="small" /></ListItemIcon><ListItemText>Delete</ListItemText>
                </MenuItem>
              </Menu>
              <Button size="small" variant="outlined" onClick={exitSelect}
                sx={{ textTransform: 'none', borderColor: S.border, color: T.textMuted, '&:hover': { borderColor: T.teal, color: T.teal } }}>Done</Button>
            </Box>
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
    </AdminPage>
  );
}
