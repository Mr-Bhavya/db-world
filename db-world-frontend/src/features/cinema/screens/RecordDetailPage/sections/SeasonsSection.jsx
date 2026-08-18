import React, { useEffect, useMemo, useState } from 'react';
import { Box, Chip, MenuItem, Select, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import StarIcon from '@mui/icons-material/Star';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import MovieIcon from '@mui/icons-material/Movie';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import { getQuality, getHdrTags, qualityRank } from '../../../media/helpers';
import { QUALITY_META } from '../../../media/constants';
import { episodeRefOf } from '../../../utils/episodeUtils';
import SectionHeading from '../shared/SectionHeading';
import { formatDate, formatRuntime } from '../helpers';

/* ═══════════════════════════════════════════════════════════
   MERGE

   TMDB knows what episodes exist; the library knows which ones
   you actually have. Neither alone is the truth:

     • TMDB-only  → episode you can't play (offer to request)
     • file-only  → episode TMDB has never heard of, or a file
                    whose numbering TMDB disagrees with
     • both       → the normal case

   Specials (season 0) are first-class here rather than skipped:
   a bonus episode you own is more useful than a numbered one you
   don't.
═══════════════════════════════════════════════════════════ */

/** Group files by season, then episode. Files with no ref land in `loose`. */
function indexFiles(files) {
  const bySeason = new Map();
  const loose = [];
  for (const f of files ?? []) {
    const ref = episodeRefOf(f);
    if (!ref || !Number.isFinite(ref.season) || !Number.isFinite(ref.episode)) {
      loose.push(f);
      continue;
    }
    if (!bySeason.has(ref.season)) bySeason.set(ref.season, new Map());
    const eps = bySeason.get(ref.season);
    if (!eps.has(ref.episode)) eps.set(ref.episode, []);
    eps.get(ref.episode).push(f);
  }
  return { bySeason, loose };
}

/** Best (highest) quality label across a set of files. */
function bestQuality(files) {
  let best = null;
  for (const f of files ?? []) {
    const q = getQuality(f?.video ?? {}, f?.general?.fileName);
    if (best === null || qualityRank(q) < qualityRank(best)) best = q;
  }
  return best;
}

/**
 * One row per episode, merged from both sides.
 *
 * Seasons come from the union of TMDB seasons and seasons that have files, so a
 * library holding only seasons 3-4 of a six-season show still lists them, and a
 * file whose season TMDB doesn't list still gets somewhere to live.
 */
function buildSeasons(tmdbSeasons, files) {
  const { bySeason, loose } = indexFiles(files);
  const numbers = new Set();
  for (const s of tmdbSeasons ?? []) if (s?.seasonNumber != null) numbers.add(Number(s.seasonNumber));
  for (const n of bySeason.keys()) numbers.add(n);

  const seasons = [...numbers].sort((a, b) => a - b).map((num) => {
    const meta = (tmdbSeasons ?? []).find((s) => Number(s?.seasonNumber) === num) ?? null;
    const fileEps = bySeason.get(num) ?? new Map();

    const epNumbers = new Set();
    for (const e of meta?.episodes ?? []) if (e?.episodeNumber != null) epNumbers.add(Number(e.episodeNumber));
    for (const n of fileEps.keys()) epNumbers.add(n);

    const episodes = [...epNumbers].sort((a, b) => a - b).map((epNum) => {
      const tmdbEp = (meta?.episodes ?? []).find((e) => Number(e?.episodeNumber) === epNum) ?? null;
      const epFiles = fileEps.get(epNum) ?? [];
      return {
        seasonNumber: num,
        episodeNumber: epNum,
        tmdb: tmdbEp,
        files: epFiles,
        available: epFiles.length > 0,
        // A file whose numbering TMDB has no entry for — still playable, but
        // worth marking so the missing artwork doesn't look like a bug.
        orphan: epFiles.length > 0 && !tmdbEp,
      };
    });

    const fileCount = [...fileEps.values()].reduce((n, arr) => n + arr.length, 0);

    return {
      seasonNumber: num,
      name: meta?.name || (num === 0 ? 'Specials' : `Season ${num}`),
      overview: meta?.overview ?? '',
      posterPath: meta?.posterPath ?? null,
      airDate: meta?.airDate ?? null,
      isSpecials: num === 0,
      episodes,
      fileCount,
      hasFiles: fileCount > 0,
      // Only meaningful when TMDB knows the season at all.
      knownToTmdb: !!meta,
    };
  });

  return { seasons, loose };
}

/* ═══════════════════════════════════════════════════════════
   EPISODE ROW
═══════════════════════════════════════════════════════════ */

function EpisodeRow({ ep, index, onPlay, onDownload, onRequest }) {
  const T = useT();
  const meta = ep.tmdb;
  const still = tmdbImg(meta?.stillPath, 'w300');
  const rating = meta?.voteAverage > 0 ? Math.round(meta.voteAverage * 10) / 10 : null;

  const quality = ep.available ? bestQuality(ep.files) : null;
  const qMeta = quality ? (QUALITY_META[quality] ?? QUALITY_META.Unknown) : null;
  const hdr = ep.available
    ? getHdrTags(ep.files[0]?.video?.hdrDetails, ep.files[0]?.general?.fileName)
    : [];

  const title = meta?.name || (ep.orphan ? `Episode ${ep.episodeNumber}` : `Episode ${ep.episodeNumber}`);

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        display: 'flex',
        gap: { xs: 1.5, sm: 2 },
        py: 1.75,
        borderBottom: `1px solid ${alpha(T.text, 0.06)}`,
        '&:last-of-type': { borderBottom: 'none' },
        // Centred, not top-aligned: rows vary a lot in height (a long synopsis
        // versus none at all), and a still pinned to the top left short rows
        // looking lopsided.
        alignItems: 'center',
        opacity: ep.available ? 1 : 0.55,
      }}
    >
      {/* Still + prominent episode number */}
      <Box sx={{
        position: 'relative', flexShrink: 0,
        width: { xs: 116, sm: 168, xl: 208 },
        '@media (min-width:1920px)': { width: 260 },
        aspectRatio: '16/9',
        borderRadius: 1.5, overflow: 'hidden',
        bgcolor: alpha(T.text, 0.06),
        border: `1px solid ${alpha(T.text, 0.08)}`,
        display: 'grid', placeItems: 'center',
        filter: ep.available ? 'none' : 'grayscale(0.7) brightness(0.7)',
      }}>
        {still ? (
          <Box
            component="img" src={still} alt="" loading="lazy" draggable={false}
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <MovieIcon sx={{ fontSize: 28, color: alpha(T.text, 0.18) }} />
        )}

        {/* The episode number is the thing people scan for, so it reads as a
            label rather than a caption — solid plate, not a translucent chip. */}
        <Box sx={{
          position: 'absolute', top: 6, left: 6,
          px: 0.9, py: 0.3, borderRadius: 1,
          bgcolor: ep.available ? alpha(T.teal, 0.95) : alpha('#000', 0.72),
          border: `1px solid ${ep.available ? T.teal : alpha('#fff', 0.22)}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        }}>
          <Typography sx={{
            color: '#fff', fontWeight: 900, lineHeight: 1,
            fontSize: { xs: '0.72rem', sm: '0.78rem', xl: '0.86rem' },
            letterSpacing: 0.4, fontVariantNumeric: 'tabular-nums',
          }}>
            {ep.seasonNumber === 0 ? 'SP' : 'E'}{String(ep.episodeNumber).padStart(2, '0')}
          </Typography>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, justifyContent: 'space-between' }}>
          <Typography sx={{
            color: T.text, fontWeight: 700, lineHeight: 1.3,
            fontSize: { xs: '0.88rem', sm: '0.94rem', xl: '1.05rem' },
          }}>
            {title}
          </Typography>
          {quality && (
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              <Chip label={qMeta.label} size="small" sx={{
                height: 19, fontSize: '0.6rem', fontWeight: 800,
                bgcolor: alpha(qMeta.color, 0.2), color: qMeta.color,
                border: `1px solid ${alpha(qMeta.color, 0.38)}`,
                '& .MuiChip-label': { px: 0.7 },
              }} />
              {hdr.slice(0, 1).map((h) => (
                <Chip key={h} label={h} size="small" sx={{
                  height: 19, fontSize: '0.6rem', fontWeight: 800,
                  bgcolor: alpha('#f59e0b', 0.2), color: '#fbbf24',
                  border: `1px solid ${alpha('#f59e0b', 0.38)}`,
                  '& .MuiChip-label': { px: 0.7 },
                }} />
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap',
          mt: 0.4, color: T.textFaint, fontSize: '0.72rem', fontWeight: 500,
        }}>
          {rating != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <StarIcon sx={{ fontSize: 12, color: '#fbbf24' }} />
              <span>{rating}</span>
            </Box>
          )}
          {meta?.airDate && <span>{formatDate(meta.airDate)}</span>}
          {meta?.runtime > 0 && <span>{formatRuntime(meta.runtime)}</span>}
          {ep.orphan && (
            <Box component="span" sx={{ color: '#fbbf24', fontWeight: 700 }}>
              Not in TMDB
            </Box>
          )}
          {ep.available && ep.files.length > 1 && (
            <Box component="span" sx={{ color: T.teal, fontWeight: 700 }}>
              {ep.files.length} files
            </Box>
          )}
        </Box>

        {meta?.overview ? (
          <Typography sx={{
            color: T.textMuted, lineHeight: 1.6, mt: 0.85,
            fontSize: { xs: '0.76rem', sm: '0.8rem', xl: '0.88rem' },
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {meta.overview}
          </Typography>
        ) : ep.orphan ? (
          <Typography sx={{
            color: T.textFaint, fontStyle: 'italic', mt: 0.85,
            fontSize: { xs: '0.74rem', sm: '0.78rem' },
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {ep.files[0]?.general?.fileName}
          </Typography>
        ) : null}

        <Box sx={{ display: 'flex', gap: 1, mt: 1.25, flexWrap: 'wrap' }}>
          {ep.available ? (
            <>
              <Box
                component={motion.button}
                whileTap={{ scale: 0.95 }}
                onClick={() => onPlay(ep)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.6,
                  border: 'none', borderRadius: 999, cursor: 'pointer',
                  bgcolor: T.teal, color: '#fff',
                  px: 1.75, py: 0.65, fontWeight: 800, fontSize: '0.75rem',
                  '&:hover': { filter: 'brightness(1.12)' },
                }}
              >
                <PlayArrowIcon sx={{ fontSize: 16 }} /> Play
              </Box>
              <Box
                component={motion.button}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDownload(ep)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.6,
                  borderRadius: 999, cursor: 'pointer',
                  bgcolor: alpha(T.text, 0.08), color: T.text,
                  border: `1px solid ${alpha(T.text, 0.14)}`,
                  px: 1.75, py: 0.65, fontWeight: 700, fontSize: '0.75rem',
                  '&:hover': { bgcolor: alpha(T.text, 0.16) },
                }}
              >
                <DownloadIcon sx={{ fontSize: 15 }} /> Download
              </Box>
            </>
          ) : (
            <Box
              component={motion.button}
              whileTap={{ scale: 0.95 }}
              onClick={onRequest}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.6,
                borderRadius: 999, cursor: 'pointer',
                bgcolor: 'transparent', color: T.textFaint,
                border: `1px solid ${alpha(T.text, 0.14)}`,
                px: 1.5, py: 0.55, fontWeight: 700, fontSize: '0.72rem',
                '&:hover': { color: T.text, borderColor: alpha(T.text, 0.28) },
              }}
            >
              Not in library · request
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   SEASONS SECTION
═══════════════════════════════════════════════════════════ */

export default function SeasonsSection({ record, files = [], onPlayEpisode, onDownloadEpisode, onRequest }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};

  const { seasons, loose } = useMemo(
    () => buildSeasons(tmdb.seasons ?? [], files),
    [tmdb.seasons, files],
  );

  // Open on something worth looking at: the first season you actually have
  // files for, then the first real season, then whatever exists. A library
  // that starts at season 3 shouldn't open on an empty season 1.
  const defaultIndex = useMemo(() => {
    const withFiles = seasons.findIndex((s) => s.hasFiles && !s.isSpecials);
    if (withFiles !== -1) return withFiles;
    const anyFiles = seasons.findIndex((s) => s.hasFiles);
    if (anyFiles !== -1) return anyFiles;
    const real = seasons.findIndex((s) => !s.isSpecials);
    return real === -1 ? 0 : real;
  }, [seasons]);

  const [selected, setSelected] = useState(defaultIndex);
  useEffect(() => { setSelected(defaultIndex); }, [defaultIndex]);

  if (seasons.length === 0) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="body2" sx={{ color: T.textFaint }}>No season information available.</Typography>
      </Box>
    );
  }

  const season = seasons[selected] ?? seasons[0];

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      {/* Season picker sits ON the heading line, the way Netflix and Prime do
          it — a rail was a scrolling chore at 12 seasons, and the count text
          that used to live here said less than the dropdown itself does. */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: { xs: 1.25, sm: 2 }, flexWrap: 'wrap', mb: 2, mt: 1,
      }}>
        <Typography sx={{
          color: T.text, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.2,
          fontSize: { xs: '1.05rem', md: '1.15rem', xl: '1.35rem' },
          '@media (min-width:1920px)': { fontSize: '1.6rem' },
          flexShrink: 0,
        }}>
          Episodes
        </Typography>

      <Select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        size="small"
        MenuProps={{
          slotProps: {
            // Menu's backdrop is invisible by default, so the open list competed
            // with the episode art behind it. Pushing the page back a little
            // makes the season you're choosing the only thing in focus.
            backdrop: {
              invisible: false,
              sx: {
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
                bgcolor: alpha('#000', 0.32),
              },
            },
            paper: {
              sx: {
                bgcolor: T.bg === '#000000' ? '#1a1a1a' : T.bg,
                backgroundImage: 'none',
                border: `1px solid ${alpha(T.text, 0.14)}`,
                boxShadow: `0 18px 48px ${alpha('#000', 0.6)}`,
                maxHeight: 420,
              },
            },
          },
        }}
        sx={{
          // Sized to its content rather than pinned to 100% on xs, so it sits
          // beside the heading on a phone too. The parent still wraps, so a
          // genuinely long season name drops it to its own line rather than
          // squeezing the title.
          minWidth: { xs: 168, sm: 300 },
          maxWidth: '100%',
          flexShrink: 1,
          color: T.text,
          bgcolor: alpha(T.text, 0.05),
          borderRadius: 2,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(T.text, 0.14) },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(T.text, 0.28) },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
          '& .MuiSelect-icon': { color: T.textMuted },
          '& .MuiSelect-select': { py: 1.1 },
        }}
        renderValue={(i) => {
          const s = seasons[i] ?? seasons[0];
          return (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.9rem' }}>
                {s.isSpecials ? 'Specials' : `Season ${s.seasonNumber}`}
              </Typography>
              <Typography component="span" sx={{ fontSize: '0.72rem', color: T.textFaint, fontWeight: 600 }}>
                {s.episodes.length} ep
              </Typography>
            </Box>
          );
        }}
      >
        {seasons.map((s, i) => (
          <MenuItem key={s.seasonNumber} value={i} sx={{ py: 1.1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', color: T.text }}>
                  {s.isSpecials ? 'Specials' : `Season ${s.seasonNumber}`}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: T.textFaint, fontWeight: 600, mt: 0.2 }}>
                  {s.episodes.length} episode{s.episodes.length === 1 ? '' : 's'}
                  {s.airDate ? ` · ${String(s.airDate).slice(0, 4)}` : ''}
                </Typography>
              </Box>
              {/* What you actually have — the reason to pick this season. */}
              <Chip
                size="small"
                label={s.hasFiles ? `${s.fileCount} file${s.fileCount === 1 ? '' : 's'}` : 'none yet'}
                sx={{
                  height: 20, fontSize: '0.62rem', fontWeight: 800, flexShrink: 0,
                  bgcolor: s.hasFiles ? alpha(T.teal, 0.18) : alpha(T.text, 0.06),
                  color: s.hasFiles ? T.teal : T.textFaint,
                  border: `1px solid ${s.hasFiles ? alpha(T.teal, 0.35) : alpha(T.text, 0.1)}`,
                  '& .MuiChip-label': { px: 0.8 },
                }}
              />
            </Box>
          </MenuItem>
        ))}
      </Select>
      </Box>

      {/* Season blurb */}
      {(season?.overview || season?.airDate) && (
        <Box sx={{ display: 'flex', gap: 2, mb: 1, alignItems: 'flex-start' }}>
          {season.posterPath && (
            <Box
              component="img"
              src={tmdbImg(season.posterPath, 'w185')}
              alt=""
              draggable={false}
              sx={{
                width: { xs: 56, sm: 72 }, aspectRatio: '2/3', borderRadius: 1.5,
                objectFit: 'cover', flexShrink: 0,
                border: `1px solid ${alpha(T.text, 0.1)}`,
              }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {season.airDate && (
              <Typography sx={{ color: T.textFaint, fontSize: '0.72rem', fontWeight: 600, mb: 0.4 }}>
                {formatDate(season.airDate)}
              </Typography>
            )}
            {season.overview && (
              <Typography sx={{
                color: T.textMuted, fontSize: '0.8rem', lineHeight: 1.6,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {season.overview}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      <AnimatePresence mode="wait">
        <Box key={selected}>
          {season.episodes.map((ep, i) => (
            <EpisodeRow
              key={`${ep.seasonNumber}-${ep.episodeNumber}`}
              ep={ep}
              index={i}
              onPlay={onPlayEpisode}
              onDownload={onDownloadEpisode}
              onRequest={onRequest}
            />
          ))}
        </Box>
      </AnimatePresence>

      {/* Files that carry no season/episode at all. Previously these went into
          an "Unknown" bucket at the end of a list nobody scrolled to. */}
      {loose.length > 0 && (
        <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${alpha(T.text, 0.08)}` }}>
          <SectionHeading sx={{ fontSize: '0.95rem' }} action={`${loose.length} file${loose.length === 1 ? '' : 's'}`}>
            Other files
          </SectionHeading>
          <Typography sx={{ color: T.textFaint, fontSize: '0.76rem', mb: 1.5 }}>
            No season or episode could be determined for these — extras, or a naming the parser didn&apos;t recognise.
          </Typography>
          {loose.map((f) => {
            const q = getQuality(f?.video ?? {}, f?.general?.fileName);
            const qm = QUALITY_META[q] ?? QUALITY_META.Unknown;
            return (
              <Box
                key={f.mediaFileId ?? f.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 1.1,
                  borderBottom: `1px solid ${alpha(T.text, 0.05)}`,
                  '&:last-of-type': { borderBottom: 'none' },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{
                    color: T.text, fontWeight: 600, fontSize: '0.78rem',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {f?.general?.fileName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 0.4 }}>
                    <Chip label={qm.label} size="small" sx={{
                      height: 18, fontSize: '0.58rem', fontWeight: 800,
                      bgcolor: alpha(qm.color, 0.2), color: qm.color,
                      '& .MuiChip-label': { px: 0.6 },
                    }} />
                    <Typography sx={{ color: T.textFaint, fontSize: '0.68rem' }}>
                      {f?.general?.fileSize}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  component={motion.button}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onPlayEpisode({ files: [f], available: true })}
                  aria-label="Play file"
                  sx={{
                    flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
                    display: 'grid', placeItems: 'center', cursor: 'pointer',
                    bgcolor: alpha(T.teal, 0.18), color: T.teal,
                    border: `1px solid ${alpha(T.teal, 0.35)}`,
                    '&:hover': { bgcolor: alpha(T.teal, 0.3) },
                  }}
                >
                  <PlayArrowIcon sx={{ fontSize: 18 }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
