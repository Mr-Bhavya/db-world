import React, { useMemo, useState } from 'react';
import {
  Box, Chip, CircularProgress, Dialog, Drawer, IconButton, Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { useT } from '@shared/theme/ThemeContext';
import { notify } from '@shared/notify';
import { resolveMediaUrl } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import { Capacitor, registerPlugin } from '@capacitor/core';

import { tmdbImg } from '../../api/cinemaApi';
import { getCodec, getHdrTags, getQuality, qualityRank } from '../../media/helpers';
import { QUALITY_META } from '../../media/constants';
import { pickAutoQuality } from '../../media/pickAutoQuality';

const DbWorldDownload = registerPlugin('DbWorldDownload');

/* ── formatting ─────────────────────────────────────────────────────────── */

const fmtMbps = (bps) => {
  const n = Number(bps);
  return Number.isFinite(n) && n > 0 ? `${(n / 1e6).toFixed(1)} Mbps` : null;
};

const fmtDuration = (secs) => {
  const n = Number(secs);
  if (!Number.isFinite(n) || n <= 0) return null;
  const h = Math.floor(n / 3600);
  const m = Math.round((n % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/* ── one file row ───────────────────────────────────────────────────────── */

function FileRow({ file, recommended, poster, title }) {
  const T = useT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const quality = getQuality(file?.video ?? {}, file?.general?.fileName);
  const codec = getCodec(file?.video?.format);
  const hdr = getHdrTags(file?.video?.hdrDetails, file?.general?.fileName);
  const meta = QUALITY_META[quality] ?? QUALITY_META.Unknown;

  const bits = [
    file?.video?.resolution,
    file?.general?.fileSize,
    fmtMbps(file?.video?.bitRate),
    file?.video?.bitDepth ? `${file.video.bitDepth}-bit` : null,
    fmtDuration(file?.general?.duration),
  ].filter(Boolean);

  const audio = Array.isArray(file?.audio) ? file.audio : [];
  const subs = Array.isArray(file?.subtitle) ? file.subtitle : [];

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await resolveMediaUrl(file.mediaFileId, 'DOWNLOAD');
      const cdnUrl = res?.data?.cdnUrl;
      if (!cdnUrl) throw new Error('No download URL');

      if (Capacitor.isNativePlatform()) {
        await DbWorldDownload.ensurePermissions();
        const started = await DbWorldDownload.startDownload({
          url: cdnUrl,
          fileName: file?.general?.fileName,
          title,
          thumbnailUrl: poster ?? undefined,
        });
        notify.success(started?.alreadyDownloaded ? 'Already downloaded.' : 'Download started.');
      } else {
        CommonServices.handleDownload(cdnUrl, {
          fileName: file?.general?.fileName,
          openInNewTab: true,
        });
        notify.success('Download started.');
      }
      setDone(true);
    } catch {
      notify.error('Could not start the download.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      component={motion.div}
      whileTap={{ scale: 0.995 }}
      onClick={download}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); download(); } }}
      aria-label={`Download ${quality} ${file?.general?.fileName ?? ''}`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        p: { xs: 1.25, sm: 1.5 }, borderRadius: 2, cursor: 'pointer',
        border: `1px solid ${recommended ? alpha(T.teal, 0.35) : 'transparent'}`,
        bgcolor: recommended ? alpha(T.teal, 0.08) : 'transparent',
        transition: 'background-color .16s',
        '&:hover': { bgcolor: recommended ? alpha(T.teal, 0.14) : alpha(T.text, 0.05) },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          color: T.text, fontWeight: 600, fontSize: { xs: '0.78rem', sm: '0.82rem' },
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {file?.general?.fileName ?? 'Untitled file'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', mt: 0.75 }}>
          <Chip label={meta.label} size="small" sx={{
            height: 19, fontSize: '0.6rem', fontWeight: 800, letterSpacing: 0.4,
            bgcolor: alpha(meta.color, 0.22), color: meta.color,
            border: `1px solid ${alpha(meta.color, 0.4)}`,
            '& .MuiChip-label': { px: 0.7 },
          }} />
          {hdr.map((h) => (
            <Chip key={h} label={h} size="small" sx={{
              height: 19, fontSize: '0.6rem', fontWeight: 800,
              bgcolor: alpha('#f59e0b', 0.2), color: '#fbbf24',
              border: `1px solid ${alpha('#f59e0b', 0.4)}`,
              '& .MuiChip-label': { px: 0.7 },
            }} />
          ))}
          {codec && (
            <Chip label={codec} size="small" sx={{
              height: 19, fontSize: '0.6rem', fontWeight: 700,
              bgcolor: alpha(T.text, 0.08), color: T.textMuted,
              '& .MuiChip-label': { px: 0.7 },
            }} />
          )}
          {recommended && (
            <Chip label="BEST FOR YOU" size="small" sx={{
              height: 19, fontSize: '0.58rem', fontWeight: 800, letterSpacing: 0.5,
              bgcolor: alpha(T.teal, 0.2), color: T.teal,
              border: `1px solid ${alpha(T.teal, 0.42)}`,
              '& .MuiChip-label': { px: 0.7 },
            }} />
          )}
        </Box>

        {bits.length > 0 && (
          <Typography sx={{ color: T.textFaint, fontSize: '0.7rem', fontWeight: 500, mt: 0.75 }}>
            {bits.join('  ·  ')}
          </Typography>
        )}

        {(audio.length > 0 || subs.length > 0) && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.85 }}>
            {audio.slice(0, 3).map((a, i) => (
              <Chip
                key={`a${i}`}
                label={[a.language, a.format?.split('(')[0]?.trim(), a.channels ? `${a.channels}ch` : null]
                  .filter(Boolean).join(' · ')}
                size="small"
                sx={{
                  height: 20, fontSize: '0.62rem', fontWeight: 600,
                  bgcolor: alpha(T.text, 0.06), color: T.textMuted,
                  border: `1px solid ${alpha(T.text, 0.09)}`,
                  '& .MuiChip-label': { px: 0.8 },
                }}
              />
            ))}
            {audio.length > 3 && (
              <Chip label={`+${audio.length - 3} audio`} size="small" sx={{
                height: 20, fontSize: '0.62rem', fontWeight: 600,
                bgcolor: alpha(T.text, 0.06), color: T.textFaint,
                '& .MuiChip-label': { px: 0.8 },
              }} />
            )}
            {subs.length > 0 && (
              <Chip label={`${subs.length} subtitle${subs.length === 1 ? '' : 's'}`} size="small" sx={{
                height: 20, fontSize: '0.62rem', fontWeight: 600,
                bgcolor: alpha('#6366f1', 0.14), color: '#a5b4fc',
                border: `1px solid ${alpha('#6366f1', 0.28)}`,
                '& .MuiChip-label': { px: 0.8 },
              }} />
            )}
          </Box>
        )}
      </Box>

      <Box sx={{
        flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        bgcolor: done ? alpha('#22c55e', 0.18) : alpha(T.text, 0.08),
        border: `1px solid ${done ? alpha('#22c55e', 0.45) : alpha(T.text, 0.14)}`,
        color: done ? '#4ade80' : T.text,
        transition: 'all .18s',
      }}>
        {busy
          ? <CircularProgress size={18} sx={{ color: T.teal }} />
          : done
            ? <CheckCircleIcon sx={{ fontSize: 20 }} />
            : <DownloadIcon sx={{ fontSize: 20 }} />}
      </Box>
    </Box>
  );
}

/* ── the sheet ──────────────────────────────────────────────────────────── */

/**
 * Every file behind one title (or one episode), grouped by quality.
 *
 * This replaces the old standalone media-files grid. That screen forced anyone
 * who just wanted to press play to first choose a file; here the choice is made
 * automatically for playback and this sheet exists only for the case where
 * someone genuinely wants a specific file.
 *
 * Bottom sheet on phones, centred dialog from `sm` up — a full-height sheet on
 * a desktop monitor is a lot of travel for a short list.
 */
export default function DownloadSheet({ open, onClose, files, record, heading, subheading }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const poster = tmdbImg(record?.tmdb?.posterPath, 'w185');
  const title = record?.tmdb?.title ?? record?.name ?? '';

  // Group by quality tier, best first. Unknown tiers are kept in their own
  // bucket rather than dropped — the old grid flat-mapped a fixed order and
  // silently hid anything outside it.
  const groups = useMemo(() => {
    const byQuality = new Map();
    for (const f of files ?? []) {
      const q = getQuality(f?.video ?? {}, f?.general?.fileName);
      if (!byQuality.has(q)) byQuality.set(q, []);
      byQuality.get(q).push(f);
    }
    return [...byQuality.entries()]
      .sort((a, b) => qualityRank(a[0]) - qualityRank(b[0]))
      .map(([quality, list]) => ({
        quality,
        label: QUALITY_META[quality]?.label ?? quality,
        files: list.sort((x, y) => Number(y?.video?.bitRate ?? 0) - Number(x?.video?.bitRate ?? 0)),
      }));
  }, [files]);

  const recommendedId = useMemo(
    () => pickAutoQuality(files ?? []).file?.mediaFileId ?? null,
    [files],
  );

  const total = files?.length ?? 0;

  const body = (
    <Box sx={{ bgcolor: T.bg === '#000000' ? '#141414' : T.bg, color: T.text }}>
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
        px: { xs: 2, sm: 2.5 }, pt: { xs: 2, sm: 2.5 }, pb: 1.75,
        borderBottom: `1px solid ${alpha(T.text, 0.08)}`,
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.02rem', letterSpacing: -0.2 }}>
            {heading ?? 'Download'}
          </Typography>
          <Typography sx={{ color: T.textFaint, fontSize: '0.74rem', fontWeight: 500, mt: 0.35 }}>
            {subheading ? `${subheading} · ` : ''}
            {total} file{total === 1 ? '' : 's'} available
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close downloads" sx={{ color: T.textMuted }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <Box sx={{
        px: { xs: 1, sm: 1.5 }, py: 1,
        maxHeight: { xs: '68vh', sm: 520 }, overflowY: 'auto',
      }}>
        {total === 0 ? (
          <Typography sx={{ color: T.textFaint, fontSize: '0.85rem', textAlign: 'center', py: 5 }}>
            No files available for this title yet.
          </Typography>
        ) : groups.map((g) => (
          <Box key={g.quality} sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, mt: 1.25, mb: 0.5 }}>
              <Typography sx={{
                fontSize: '0.62rem', fontWeight: 800, letterSpacing: 1.1,
                textTransform: 'uppercase', color: T.textFaint,
              }}>
                {g.label}
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: alpha(T.text, 0.07) }} />
            </Box>
            {g.files.map((f) => (
              <FileRow
                key={f.mediaFileId ?? f.id}
                file={f}
                recommended={f.mediaFileId === recommendedId}
                poster={poster}
                title={title}
              />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );

  if (fullScreen) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        // Above RecordDetailSheet (1300) and its backdrop.
        sx={{ zIndex: 1400 }}
        slotProps={{ backdrop: { sx: { zIndex: 1400, bgcolor: alpha('#000', 0.6) } } }}
        PaperProps={{
          sx: {
            zIndex: 1401, bgcolor: 'transparent', backgroundImage: 'none',
            borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden',
            pb: 'env(safe-area-inset-bottom)',
          },
          // The sheet behind this one owns a drag gesture; without this every
          // tap in here would also be read as a drag on it.
          onTouchStart: (e) => e.stopPropagation(),
          onTouchMove: (e) => e.stopPropagation(),
          onClick: (e) => e.stopPropagation(),
        }}
      >
        {body}
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: 1400 }}
      PaperProps={{
        sx: { borderRadius: 3, bgcolor: 'transparent', backgroundImage: 'none', overflow: 'hidden' },
        onClick: (e) => e.stopPropagation(),
      }}
      slotProps={{ backdrop: { sx: { bgcolor: alpha('#000', 0.7), backdropFilter: 'blur(4px)' } } }}
    >
      {body}
    </Dialog>
  );
}
