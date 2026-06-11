import React from 'react';
import {
  Box, Button, Chip, IconButton, Tooltip, Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import StarRoundedIcon from '@mui/icons-material/StarRounded';

import {
  tmdbImg,
  addWatchlist, removeWatchlist,
  addLike, removeLike,
  addLove, removeLove,
  addWatched, removeWatched,
} from '../../api/cinemaApi';
import { formatRuntime } from './helpers';
import ShareButton from './shared/ShareButton';

const INTERACTIONS = [
  { key: 'watchlisted', label: 'My List', ActiveIcon: BookmarkIcon, InactiveIcon: BookmarkBorderIcon, activeColor: '#0d9488', add: addWatchlist, remove: removeWatchlist },
  { key: 'liked',       label: 'Like',    ActiveIcon: ThumbUpIcon,  InactiveIcon: ThumbUpOutlinedIcon,activeColor: '#3b82f6', add: addLike,      remove: removeLike      },
  { key: 'loved',       label: 'Love',    ActiveIcon: FavoriteIcon, InactiveIcon: FavoriteBorderIcon, activeColor: '#ec4899', add: addLove,      remove: removeLove      },
  { key: 'watched',     label: 'Watched', ActiveIcon: VisibilityIcon, InactiveIcon: VisibilityOffIcon, activeColor: '#22c55e', add: addWatched, remove: removeWatched },
];

/**
 * Cinematic record-detail header. Full-bleed backdrop with a deep scrim, a
 * floating poster, title + metadata, and a clean action row. Designed so the
 * title + primary actions sit low in the frame — they remain visible when the
 * mobile detail sheet is only 75% open.
 */
export default function Hero({
  record, interaction, onToggle, interactionLoading,
  onPlayTrailer, onWatchClick, onBack, inModal = false,
}) {
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const backdropUrl = tmdbImg(tmdb.backdropPath, 'original');
  const posterUrl   = tmdbImg(tmdb.posterPath,   'w342');

  const year = isMovie ? tmdb.releaseDate?.slice(0, 4) : tmdb.firstAirDate?.slice(0, 4);
  const endYear = !isMovie && tmdb.lastAirDate ? tmdb.lastAirDate.slice(0, 4) : null;

  const runtimeLine = isMovie
    ? formatRuntime(tmdb.runtime)
    : tmdb.numberOfSeasons != null
      ? `${tmdb.numberOfSeasons} Season${tmdb.numberOfSeasons !== 1 ? 's' : ''}${tmdb.numberOfEpisodes ? ` · ${tmdb.numberOfEpisodes} Eps` : ''}`
      : null;

  const rating = tmdb.voteAverage ? Math.round(tmdb.voteAverage * 10) / 10 : null;
  const genres = (tmdb.genres ?? []).filter((g) => g?.name).slice(0, 3);

  const metaDot = <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: alpha('#fff', 0.4) }} />;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: { xs: 420, sm: 480, md: 560 },
        overflow: 'hidden',
        bgcolor: '#050505',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      {/* Backdrop with a slow parallax settle */}
      {backdropUrl && (
        <Box
          component={motion.img}
          src={backdropUrl}
          alt=""
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 18%',
          }}
        />
      )}

      {/* Scrims — bottom-up for text legibility + a soft left bias on wide screens.
          Bottom stop matches the detail surface (#141414) so the hero blends
          seamlessly into the body below. */}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #141414 2%, rgba(20,20,20,0.55) 38%, rgba(20,20,20,0.05) 78%)' }} />
      <Box sx={{ position: 'absolute', inset: 0, display: { xs: 'none', md: 'block' }, background: 'linear-gradient(to right, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.25) 45%, transparent 80%)' }} />
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(120% 80% at 0% 100%, rgba(13,148,136,0.20) 0%, transparent 55%)' }} />

      {/* Back button (page mode only — sheet/modal provide their own close) */}
      {!inModal && (
        <IconButton
          size="small"
          onClick={onBack ?? (() => window.history.back())}
          sx={{
            position: 'absolute', top: 16, left: { xs: 12, md: 24 }, zIndex: 3,
            bgcolor: alpha('#000', 0.5), color: '#fff',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha('#fff', 0.14)}`,
            '&:hover': { bgcolor: alpha('#000', 0.72) },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
      )}

      {/* Foreground content */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
        sx={{
          position: 'relative', zIndex: 2, width: '100%',
          px: { xs: 2, sm: 3, md: 5 }, pt: 6,
          pb: { xs: 2.5, md: 4 },
        }}
      >
        <Box sx={{
          display: 'flex', gap: { xs: 1.75, md: 3 }, alignItems: 'flex-end',
          width: '100%', maxWidth: { xs: '100%', lg: 1200 }, mx: 'auto',
        }}>
          {/* Poster — shown on every size now (anchors the layout) */}
          {posterUrl && (
            <Box
              component={motion.img}
              src={posterUrl}
              alt={tmdb.title ?? record?.name}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
              sx={{
                width: { xs: 92, sm: 124, md: 168 },
                aspectRatio: '2/3',
                borderRadius: { xs: 1.5, md: 2.5 },
                boxShadow: '0 18px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)',
                flexShrink: 0, objectFit: 'cover',
              }}
            />
          )}

          {/* Info column */}
          <Box sx={{ flex: 1, minWidth: 0, pb: { xs: 0.5, md: 1 } }}>
            <Chip
              label={isMovie ? 'MOVIE' : 'TV SERIES'}
              size="small"
              sx={{
                bgcolor: alpha('#0d9488', 0.22), color: '#5eead4',
                fontSize: '0.62rem', fontWeight: 800, mb: 1, height: 20,
                border: `1px solid ${alpha('#0d9488', 0.45)}`, letterSpacing: 1,
                '& .MuiChip-label': { px: 1 },
              }}
            />

            <Typography
              sx={{
                color: '#fff', fontWeight: 800, lineHeight: 1.05,
                fontSize: { xs: '1.45rem', sm: '2rem', md: '2.7rem' },
                textShadow: '0 2px 18px rgba(0,0,0,0.85)',
                letterSpacing: -0.5,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {tmdb.title ?? record?.name}
            </Typography>

            {/* Meta row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 0.85, md: 1.2 }, mt: 1, mb: 1.25 }}>
              {rating != null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, bgcolor: alpha('#000', 0.35), borderRadius: 1, px: 0.85, py: 0.25 }}>
                  <StarRoundedIcon sx={{ fontSize: 16, color: '#fbbf24' }} />
                  <Typography sx={{ color: '#fde68a', fontSize: '0.8rem', fontWeight: 800 }}>{rating}</Typography>
                </Box>
              )}
              {year && <Typography sx={{ color: '#d4d4d4', fontSize: '0.82rem', fontWeight: 600 }}>{year}{endYear && endYear !== year ? `–${endYear}` : ''}</Typography>}
              {runtimeLine && (<>{metaDot}<Typography sx={{ color: '#d4d4d4', fontSize: '0.82rem' }}>{runtimeLine}</Typography></>)}
              {tmdb.status && (
                <Chip
                  label={tmdb.status}
                  size="small"
                  sx={{
                    height: 18, fontSize: '0.62rem', fontWeight: 700,
                    bgcolor: (tmdb.status === 'Released' || tmdb.status === 'Ended') ? alpha('#22c55e', 0.16) : alpha('#f59e0b', 0.16),
                    color:   (tmdb.status === 'Released' || tmdb.status === 'Ended') ? '#4ade80' : '#fbbf24',
                    '& .MuiChip-label': { px: 0.8 },
                  }}
                />
              )}
            </Box>

            {/* Genres */}
            {genres.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
                {genres.map((g) => (
                  <Chip key={g.id} label={g.name} size="small"
                    sx={{ bgcolor: alpha('#fff', 0.08), color: '#e5e5e5', fontSize: '0.68rem', height: 22, border: `1px solid ${alpha('#fff', 0.1)}` }} />
                ))}
              </Box>
            )}

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {onWatchClick && (
                <Button
                  component={motion.button}
                  whileTap={{ scale: 0.97 }}
                  variant="contained"
                  startIcon={<OndemandVideoIcon />}
                  onClick={onWatchClick}
                  sx={{
                    bgcolor: '#0d9488', color: '#fff', fontWeight: 800,
                    textTransform: 'none', px: 2.75, py: 0.9, borderRadius: 999, fontSize: '0.9rem',
                    boxShadow: '0 8px 24px rgba(13,148,136,0.4)',
                    '&:hover': { bgcolor: '#0f766e' },
                  }}
                >
                  Watch Now
                </Button>
              )}

              {onPlayTrailer && (
                <Button
                  component={motion.button}
                  whileTap={{ scale: 0.97 }}
                  variant="text"
                  startIcon={<PlayArrowIcon />}
                  onClick={onPlayTrailer}
                  sx={{
                    color: '#fff', fontWeight: 700, textTransform: 'none',
                    px: 2, py: 0.9, borderRadius: 999, fontSize: '0.9rem',
                    bgcolor: alpha('#fff', 0.14), backdropFilter: 'blur(6px)',
                    border: `1px solid ${alpha('#fff', 0.2)}`,
                    '&:hover': { bgcolor: alpha('#fff', 0.24) },
                  }}
                >
                  Trailer
                </Button>
              )}

              {/* Quick-action toggles — circular, glassy. data-noexpand keeps them
                  from promoting the mobile sheet to full. */}
              <Box sx={{ display: 'flex', gap: 0.75, ml: { xs: 0, sm: 0.5 } }}>
                {INTERACTIONS.map(({ key, label, ActiveIcon, InactiveIcon, activeColor }) => {
                  const active = interaction?.[key] ?? false;
                  return (
                    <Tooltip key={key} title={label} placement="top">
                      <span data-noexpand>
                        <IconButton
                          size="small"
                          disabled={interactionLoading}
                          onClick={() => onToggle(key, active)}
                          sx={{
                            bgcolor: active ? alpha(activeColor, 0.25) : alpha('#fff', 0.1),
                            border: `1.5px solid ${active ? activeColor : alpha('#fff', 0.2)}`,
                            color: active ? activeColor : '#e5e5e5',
                            width: 38, height: 38, backdropFilter: 'blur(6px)',
                            transition: 'all 0.18s',
                            '&:hover': { bgcolor: active ? alpha(activeColor, 0.35) : alpha('#fff', 0.2) },
                          }}
                        >
                          {active ? <ActiveIcon sx={{ fontSize: 18 }} /> : <InactiveIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  );
                })}
                <Box component="span" data-noexpand sx={{ display: 'inline-flex' }}>
                  <ShareButton record={record} />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
