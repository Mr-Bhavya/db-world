import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Chip, CircularProgress, Dialog, Drawer, IconButton, MenuItem, Select, Tooltip,
  Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';

import { useT } from '@shared/theme/ThemeContext';
import { notify } from '@shared/notify';
import { haptic } from '@shared/platform/platform';
import { resolveMediaUrl } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import { Capacitor, registerPlugin } from '@capacitor/core';

import { tmdbImg } from '../../api/cinemaApi';
import { getCodec, getHdrTags, getQuality, qualityRank } from '../../media/helpers';
import { QUALITY_META } from '../../media/constants';
import { pickAutoQuality } from '../../media/pickAutoQuality';
import { episodeRefOf } from '../../utils/episodeUtils';

const DbWorldDownload = registerPlugin('DbWorldDownload');

const ALL = 'ALL';

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

/** Total size of a file list. Needs raw bytes — the formatted "2.1 GB" can't be summed. */
const fmtTotalSize = (files) => {
  const bytes = (files ?? []).reduce((sum, f) => sum + (Number(f?.general?.fileSizeBytes) || 0), 0);
  if (bytes <= 0) return null;
  const { value, suffix } = CommonServices.bytesToReadbleFormat(bytes);
  return `${value} ${suffix}`;
};

/** `E05`, or `SP05` for a special — the same plate language the Episodes section uses. */
const episodePlate = (ref) =>
  ref ? `${ref.season === 0 ? 'SP' : 'E'}${String(ref.episode).padStart(2, '0')}` : null;

const seasonLabel = (season) => (season === 0 ? 'Specials' : `Season ${season}`);

/**
 * How long a signed URL stays valid, read out of the URL itself.
 *
 * The download TTL is a live server setting, so hardcoding a number here would drift.
 * nginx's secure_link puts the expiry in the query string, which makes the URL its own
 * source of truth — and a blank result (signing disabled) correctly promises nothing.
 */
function expiryHint(url) {
  try {
    const expires = Number(new URL(url, window.location.origin).searchParams.get('expires'));
    if (!Number.isFinite(expires) || expires <= 0) return null;
    const mins = Math.round((expires * 1000 - Date.now()) / 60000);
    if (mins <= 0) return null;
    if (mins < 90) return `${mins} min`;
    return `${Math.round(mins / 60)} h`;
  } catch {
    return null;
  }
}

/* ── one file row ───────────────────────────────────────────────────────── */

function FileRow({ file, recommended, poster, title, plate }) {
  const T = useT();
  // Separate flags: a shared one put the spinner in the download button while the COPY
  // request was in flight. Each action still blocks the other, so one tap can't fire two
  // URL resolutions at once.
  const [busyDownload, setBusyDownload] = useState(false);
  const [busyCopy, setBusyCopy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy = busyDownload || busyCopy;

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
    setBusyDownload(true);
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
      haptic.success();
      setDone(true);
    } catch {
      notify.error('Could not start the download.');
    } finally {
      setBusyDownload(false);
    }
  };

  /**
   * Copy the direct link. This is what the download TTL is generous for: pasting into
   * aria2/idm on another machine, or into a TV that can't run the app. Goes through
   * CommonServices.handleCopy for its fallback chain — `navigator.clipboard` doesn't
   * exist on an insecure origin, which is exactly how the LAN dev build is served.
   */
  const copyLink = async () => {
    if (busy) return;
    setBusyCopy(true);
    try {
      const res = await resolveMediaUrl(file.mediaFileId, 'DOWNLOAD');
      const cdnUrl = res?.data?.cdnUrl;
      if (!cdnUrl) throw new Error('No download URL');

      const { success } = await CommonServices.handleCopy(cdnUrl);
      if (!success) throw new Error('Copy failed');

      const validFor = expiryHint(cdnUrl);
      notify.success(validFor ? `Link copied — valid for about ${validFor}.` : 'Link copied.');
      haptic.light();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      notify.error('Could not copy the link.');
    } finally {
      setBusyCopy(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 },
        p: { xs: 1.25, sm: 1.5 }, borderRadius: 2,
        border: `1px solid ${recommended ? alpha(T.teal, 0.35) : 'transparent'}`,
        bgcolor: recommended ? alpha(T.teal, 0.08) : 'transparent',
        transition: 'background-color .16s',
        '&:hover': { bgcolor: recommended ? alpha(T.teal, 0.14) : alpha(T.text, 0.05) },
      }}
    >
      {/* Episode plate. Solid, tabular figures — it's the thing the eye scans down. */}
      {plate && (
        <Box sx={{
          flexShrink: 0, alignSelf: 'flex-start', mt: 0.25,
          px: 0.85, py: 0.35, borderRadius: 1,
          bgcolor: alpha(T.text, 0.1),
          border: `1px solid ${alpha(T.text, 0.16)}`,
        }}>
          <Typography sx={{
            color: T.text, fontWeight: 900, lineHeight: 1, fontSize: '0.7rem',
            letterSpacing: 0.4, fontVariantNumeric: 'tabular-nums',
          }}>
            {plate}
          </Typography>
        </Box>
      )}

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

      {/* Two explicit actions instead of one row-wide click target: copying a link and
          starting a download are different enough that a stray tap shouldn't pick one. */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="Copy direct link" placement="top">
          <IconButton
            onClick={copyLink}
            disabled={busy}
            aria-label={`Copy link to ${file?.general?.fileName ?? 'file'}`}
            sx={{
              width: 36, height: 36,
              color: copied ? '#4ade80' : T.textMuted,
              bgcolor: copied ? alpha('#22c55e', 0.14) : 'transparent',
              border: `1px solid ${copied ? alpha('#22c55e', 0.4) : alpha(T.text, 0.12)}`,
              '&:hover': { bgcolor: alpha(T.text, 0.08), color: T.text },
            }}
          >
            {busyCopy
              ? <CircularProgress size={15} sx={{ color: T.teal }} />
              : copied
                ? <DoneRoundedIcon sx={{ fontSize: 18 }} />
                : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Download" placement="top">
          <IconButton
            onClick={download}
            disabled={busy}
            aria-label={`Download ${quality} ${file?.general?.fileName ?? ''}`}
            sx={{
              width: 40, height: 40,
              bgcolor: done ? alpha('#22c55e', 0.18) : alpha(T.text, 0.08),
              border: `1px solid ${done ? alpha('#22c55e', 0.45) : alpha(T.text, 0.14)}`,
              color: done ? '#4ade80' : T.text,
              transition: 'all .18s',
              '&:hover': { bgcolor: alpha(T.teal, 0.2), borderColor: alpha(T.teal, 0.45) },
            }}
          >
            {busyDownload
              ? <CircularProgress size={18} sx={{ color: T.teal }} />
              : done
                ? <CheckCircleIcon sx={{ fontSize: 20 }} />
                : <DownloadIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

/* ── grouping ───────────────────────────────────────────────────────────── */

/**
 * Two shapes, because "the files behind this title" means two different things.
 *
 * A movie's files are variants of ONE picture, so quality is the only axis and grouping
 * by it is the answer. A series' files are different EPISODES, and a flat list of 40
 * filenames grouped by resolution is unusable — there, season and episode order is the
 * spine and quality becomes a filter instead.
 *
 * Chosen by the data rather than the record type: a per-episode download opens with one
 * episode's files, which are variants of one picture and so want the movie treatment.
 */
function buildSections(files, episodeMode) {
  const rows = (files ?? []).map((file) => ({ file, ref: episodeRefOf(file) }));

  if (!episodeMode) {
    const byQuality = new Map();
    for (const { file } of rows) {
      const q = getQuality(file?.video ?? {}, file?.general?.fileName);
      if (!byQuality.has(q)) byQuality.set(q, []);
      byQuality.get(q).push({ file, plate: null });
    }
    return [...byQuality.entries()]
      .sort((a, b) => qualityRank(a[0]) - qualityRank(b[0]))
      .map(([quality, list]) => ({
        key: `q-${quality}`,
        label: QUALITY_META[quality]?.label ?? quality,
        rows: list.sort((x, y) => Number(y.file?.video?.bitRate ?? 0) - Number(x.file?.video?.bitRate ?? 0)),
      }));
  }

  const bySeason = new Map();
  const loose = [];
  for (const row of rows) {
    if (!row.ref) { loose.push({ file: row.file, plate: null }); continue; }
    if (!bySeason.has(row.ref.season)) bySeason.set(row.ref.season, []);
    bySeason.get(row.ref.season).push({ file: row.file, plate: episodePlate(row.ref), ref: row.ref });
  }

  const sections = [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, list]) => ({
      key: `s-${season}`,
      season,
      label: seasonLabel(season),
      rows: list.sort((x, y) => {
        // Episode order first — that is the whole point of this mode. Within one
        // episode, the best copy leads.
        if (x.ref.episode !== y.ref.episode) return x.ref.episode - y.ref.episode;
        const byQ = qualityRank(getQuality(x.file?.video ?? {}, x.file?.general?.fileName))
          - qualityRank(getQuality(y.file?.video ?? {}, y.file?.general?.fileName));
        if (byQ !== 0) return byQ;
        return Number(y.file?.video?.bitRate ?? 0) - Number(x.file?.video?.bitRate ?? 0);
      }),
    }));

  if (loose.length > 0) {
    sections.push({ key: 'loose', label: 'Other files', rows: loose });
  }
  return sections;
}

/* ── the sheet ──────────────────────────────────────────────────────────── */

/**
 * Every file behind one title (or one episode), ordered and filterable.
 *
 * This replaces the old standalone media-files grid. That screen forced anyone who just
 * wanted to press play to first choose a file; here the choice is made automatically for
 * playback and this sheet exists only for the case where someone genuinely wants a
 * specific file — or its link.
 *
 * Bottom sheet on phones, centred dialog from `sm` up — a full-height sheet on a desktop
 * monitor is a lot of travel for a short list.
 */
export default function DownloadSheet({ open, onClose, files, record, heading, subheading }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const poster = tmdbImg(record?.tmdb?.posterPath, 'w185');
  const title = record?.tmdb?.title ?? record?.name ?? '';

  const [quality, setQuality] = useState(ALL);
  const [season, setSeason] = useState(ALL);

  // A different file set (another episode, or the whole title) is a different question;
  // carrying a "4K only" filter into it would show an empty sheet for no visible reason.
  useEffect(() => { setQuality(ALL); setSeason(ALL); }, [files, open]);

  /** Episode mode only once more than one episode is in play — see buildSections. */
  const episodeMode = useMemo(() => {
    const keys = new Set();
    for (const f of files ?? []) {
      const ref = episodeRefOf(f);
      if (ref) keys.add(`${ref.season}:${ref.episode}`);
    }
    return keys.size > 1;
  }, [files]);

  /** Qualities actually present, best first, with counts for the filter chips. */
  const qualities = useMemo(() => {
    const counts = new Map();
    for (const f of files ?? []) {
      const q = getQuality(f?.video ?? {}, f?.general?.fileName);
      counts.set(q, (counts.get(q) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => qualityRank(a[0]) - qualityRank(b[0]))
      .map(([q, count]) => ({ quality: q, label: QUALITY_META[q]?.label ?? q, count }));
  }, [files]);

  const seasons = useMemo(() => {
    if (!episodeMode) return [];
    const set = new Set();
    for (const f of files ?? []) {
      const ref = episodeRefOf(f);
      if (ref) set.add(ref.season);
    }
    return [...set].sort((a, b) => a - b);
  }, [files, episodeMode]);

  const filtered = useMemo(() => (files ?? []).filter((f) => {
    if (quality !== ALL && getQuality(f?.video ?? {}, f?.general?.fileName) !== quality) return false;
    if (season !== ALL) {
      const ref = episodeRefOf(f);
      if (!ref || ref.season !== season) return false;
    }
    return true;
  }), [files, quality, season]);

  const sections = useMemo(() => buildSections(filtered, episodeMode), [filtered, episodeMode]);

  /**
   * "Best for you" is per episode in episode mode. One recommendation for a whole series
   * would be a single arbitrary episode wearing the badge.
   */
  const recommendedIds = useMemo(() => {
    const ids = new Set();
    if (!episodeMode) {
      const id = pickAutoQuality(filtered).file?.mediaFileId;
      if (id) ids.add(id);
      return ids;
    }
    const byEpisode = new Map();
    for (const f of filtered) {
      const ref = episodeRefOf(f);
      if (!ref) continue;
      const key = `${ref.season}:${ref.episode}`;
      if (!byEpisode.has(key)) byEpisode.set(key, []);
      byEpisode.get(key).push(f);
    }
    for (const list of byEpisode.values()) {
      // A single copy needs no recommending — the badge only earns its place as a choice.
      if (list.length < 2) continue;
      const id = pickAutoQuality(list).file?.mediaFileId;
      if (id) ids.add(id);
    }
    return ids;
  }, [filtered, episodeMode]);

  const total = files?.length ?? 0;
  const shown = filtered.length;
  const filtering = quality !== ALL || season !== ALL;
  const totalSize = fmtTotalSize(filtered);
  const showFilters = total > 1 && (qualities.length > 1 || seasons.length > 1);

  const chipSx = (active) => ({
    height: 26, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
    bgcolor: active ? alpha(T.teal, 0.18) : alpha(T.text, 0.05),
    color: active ? T.teal : T.textMuted,
    border: `1px solid ${active ? alpha(T.teal, 0.42) : alpha(T.text, 0.1)}`,
    '&:hover': { bgcolor: active ? alpha(T.teal, 0.24) : alpha(T.text, 0.1) },
  });

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
            {filtering ? `${shown} of ${total}` : total} file{(filtering ? shown : total) === 1 ? '' : 's'}
            {totalSize ? ` · ${totalSize}` : ''}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close downloads" sx={{ color: T.textMuted }}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {showFilters && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap',
          px: { xs: 2, sm: 2.5 }, py: 1.25,
          borderBottom: `1px solid ${alpha(T.text, 0.06)}`,
        }}>
          {seasons.length > 1 && (
            <Select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              size="small"
              MenuProps={{ slotProps: { paper: { sx: {
                bgcolor: T.bg === '#000000' ? '#1a1a1a' : T.bg,
                backgroundImage: 'none',
                border: `1px solid ${alpha(T.text, 0.14)}`,
              } } } }}
              sx={{
                minWidth: 132, mr: 0.5,
                color: T.text, bgcolor: alpha(T.text, 0.05), borderRadius: 2,
                fontSize: '0.72rem', fontWeight: 700,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(T.text, 0.12) },
                '& .MuiSelect-icon': { color: T.textMuted },
                '& .MuiSelect-select': { py: 0.6 },
              }}
            >
              <MenuItem value={ALL} sx={{ fontSize: '0.78rem' }}>All seasons</MenuItem>
              {seasons.map((s) => (
                <MenuItem key={s} value={s} sx={{ fontSize: '0.78rem' }}>{seasonLabel(s)}</MenuItem>
              ))}
            </Select>
          )}

          {qualities.length > 1 && (
            <>
              <Chip label="All" size="small" onClick={() => setQuality(ALL)} sx={chipSx(quality === ALL)} />
              {qualities.map((q) => (
                <Chip
                  key={q.quality}
                  size="small"
                  label={`${q.label} · ${q.count}`}
                  onClick={() => setQuality(q.quality)}
                  sx={chipSx(quality === q.quality)}
                />
              ))}
            </>
          )}
        </Box>
      )}

      <Box sx={{
        px: { xs: 1, sm: 1.5 }, py: 1,
        maxHeight: { xs: '62vh', sm: 480 }, overflowY: 'auto',
      }}>
        {total === 0 ? (
          <Typography sx={{ color: T.textFaint, fontSize: '0.85rem', textAlign: 'center', py: 5 }}>
            No files available for this title yet.
          </Typography>
        ) : shown === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Typography sx={{ color: T.textFaint, fontSize: '0.85rem' }}>
              Nothing matches that filter.
            </Typography>
            <Chip
              label="Clear filters"
              size="small"
              onClick={() => { setQuality(ALL); setSeason(ALL); }}
              sx={{ ...chipSx(true), mt: 1.5 }}
            />
          </Box>
        ) : sections.map((s) => (
          <Box key={s.key} sx={{ mb: 1 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1, mt: 1.25, mb: 0.5,
              // Sticks while you scroll a long season, so it's always clear which one
              // you are looking at.
              position: 'sticky', top: 0, zIndex: 1,
              bgcolor: T.bg === '#000000' ? '#141414' : T.bg,
              py: 0.5,
            }}>
              <Typography sx={{
                fontSize: '0.62rem', fontWeight: 800, letterSpacing: 1.1,
                textTransform: 'uppercase', color: T.textFaint,
              }}>
                {s.label}
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: alpha(T.text, 0.07) }} />
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: T.textFaint }}>
                {s.rows.length}
              </Typography>
            </Box>
            {s.rows.map((r) => (
              <FileRow
                key={r.file.mediaFileId ?? r.file.id}
                file={r.file}
                plate={r.plate}
                recommended={recommendedIds.has(r.file.mediaFileId)}
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
