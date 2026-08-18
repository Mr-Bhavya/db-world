import React, { useMemo, useState } from 'react';
import {
  Box, Chip, MenuItem, Select, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import StarIcon from '@mui/icons-material/Star';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import { formatDate, formatRuntime } from '../helpers';

/* ═══════════════════════════════════════════════════════════
   EPISODE ROW

   Accordions nested episodes two levels deep and made comparing
   seasons a click-per-season affair. One season is picked at the
   top and its episodes get the full width instead.
═══════════════════════════════════════════════════════════ */

function EpisodeRow({ episode, index }) {
  const T = useT();
  const still = tmdbImg(episode.stillPath, 'w300');
  const rating = episode.voteAverage > 0 ? Math.round(episode.voteAverage * 10) / 10 : null;

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
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{
        position: 'relative', flexShrink: 0,
        width: { xs: 116, sm: 168, xl: 208 },
        '@media (min-width:1920px)': { width: 260 },
        aspectRatio: '16/9',
        borderRadius: 1.5, overflow: 'hidden',
        bgcolor: alpha(T.text, 0.06),
      }}>
        {still && (
          <Box
            component="img"
            src={still}
            alt=""
            loading="lazy"
            draggable={false}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        <Box sx={{
          position: 'absolute', top: 4, left: 4,
          px: 0.7, py: 0.15, borderRadius: 0.75,
          bgcolor: alpha('#000', 0.68), backdropFilter: 'blur(6px)',
          fontSize: '0.62rem', fontWeight: 800, color: '#fff',
          fontVariantNumeric: 'tabular-nums',
        }}>
          E{String(episode.episodeNumber).padStart(2, '0')}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: T.text, fontWeight: 700, lineHeight: 1.35 }}>
            {episode.name}
          </Typography>
          {rating != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <StarIcon sx={{ fontSize: 12, color: '#fbbf24' }} />
              <Typography variant="caption" sx={{ color: T.textFaint, fontWeight: 700 }}>{rating}</Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
          {episode.airDate && (
            <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(episode.airDate)}</Typography>
          )}
          {episode.runtime != null && (
            <>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: alpha(T.text, 0.3) }} />
              <Typography variant="caption" sx={{ color: T.textFaint }}>{formatRuntime(episode.runtime)}</Typography>
            </>
          )}
        </Box>

        {episode.overview && (
          <Typography variant="caption" sx={{
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            color: T.textMuted, lineHeight: 1.55, mt: 0.6,
          }}>
            {episode.overview}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   SEASONS SECTION
═══════════════════════════════════════════════════════════ */

export default function SeasonsSection({ record }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};
  const seasons = useMemo(() => tmdb.seasons ?? [], [tmdb.seasons]);

  // Default to the first real season — a specials season (0) is rarely what
  // someone opening a series wants to see first.
  const defaultIndex = useMemo(() => {
    const idx = seasons.findIndex((s) => (s.seasonNumber ?? 0) > 0);
    return idx === -1 ? 0 : idx;
  }, [seasons]);

  const [selected, setSelected] = useState(defaultIndex);
  const season = seasons[selected] ?? seasons[0];

  if (seasons.length === 0) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="body2" sx={{ color: T.textFaint }}>No season information available.</Typography>
      </Box>
    );
  }

  const episodes = season?.episodes ?? [];
  const posterUrl = tmdbImg(season?.posterPath, 'w185');

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, mb: 2,
        flexWrap: 'wrap', justifyContent: 'space-between',
      }}>
        <SectionHeading sx={{ mb: 0 }}>Episodes</SectionHeading>

        <Select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          size="small"
          sx={{
            minWidth: 180,
            color: T.text,
            bgcolor: alpha(T.text, 0.05),
            borderRadius: 1.5,
            fontWeight: 700, fontSize: '0.86rem',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(T.text, 0.14) },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(T.teal, 0.5) },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
            '& .MuiSvgIcon-root': { color: T.textFaint },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                bgcolor: T.bg === '#000000' ? '#1a1a1a' : T.bg,
                backgroundImage: 'none',
                border: `1px solid ${alpha(T.text, 0.1)}`,
                maxHeight: 380,
              },
            },
          }}
        >
          {seasons.map((s, i) => (
            <MenuItem key={s.seasonNumber ?? i} value={i} sx={{ fontSize: '0.86rem', color: T.text }}>
              {s.name || `Season ${s.seasonNumber}`}
              {s.episodeCount != null && (
                <Typography component="span" variant="caption" sx={{ color: T.textFaint, ml: 1 }}>
                  {s.episodeCount} eps
                </Typography>
              )}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Season header — poster, air window and synopsis for the chosen season. */}
      <Box sx={{
        display: 'flex', gap: 2, mb: 1,
        p: { xs: 1.5, sm: 2 },
        bgcolor: T.glass,
        border: `1px solid ${alpha(T.text, 0.07)}`,
        borderRadius: 1.5,
      }}>
        {posterUrl && (
          <Box
            component="img"
            src={posterUrl}
            alt=""
            draggable={false}
            sx={{
              width: { xs: 56, sm: 72 }, aspectRatio: '2/3',
              objectFit: 'cover', borderRadius: 1, flexShrink: 0,
            }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: T.text, fontWeight: 800 }}>
              {season?.name || `Season ${season?.seasonNumber}`}
            </Typography>
            {season?.episodeCount != null && (
              <Chip
                label={`${season.episodeCount} eps`}
                size="small"
                sx={{ bgcolor: alpha(T.teal, 0.14), color: T.teal, fontSize: '0.62rem', height: 18, fontWeight: 700 }}
              />
            )}
            {season?.airDate && (
              <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(season.airDate)}</Typography>
            )}
          </Box>
          {season?.overview && (
            <Typography variant="caption" sx={{
              color: T.textMuted, lineHeight: 1.6,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {season.overview}
            </Typography>
          )}
        </Box>
      </Box>

      <AnimatePresence mode="wait">
        <Box key={selected}>
          {episodes.length > 0 ? (
            episodes.map((ep, i) => (
              <EpisodeRow key={ep.episodeNumber ?? i} episode={ep} index={i} />
            ))
          ) : (
            <Typography variant="body2" sx={{ color: T.textFaint, py: 2 }}>
              No episode data available for this season.
            </Typography>
          )}
        </Box>
      </AnimatePresence>
    </Box>
  );
}
