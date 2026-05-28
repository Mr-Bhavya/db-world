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

import {
  tmdbImg,
  addWatchlist, removeWatchlist,
  addLike, removeLike,
  addLove, removeLove,
  addWatched, removeWatched,
} from '../../api/cinemaApi';
import { formatRuntime } from './helpers';
import RatingRing from './shared/RatingRing';
import ShareButton from './shared/ShareButton';

const INTERACTIONS = [
  { key: 'watchlisted', label: 'Watchlist', ActiveIcon: BookmarkIcon, InactiveIcon: BookmarkBorderIcon, activeColor: '#0d9488', add: addWatchlist, remove: removeWatchlist },
  { key: 'liked',       label: 'Like',      ActiveIcon: ThumbUpIcon,  InactiveIcon: ThumbUpOutlinedIcon,activeColor: '#2196f3', add: addLike,      remove: removeLike      },
  { key: 'loved',       label: 'Love',      ActiveIcon: FavoriteIcon, InactiveIcon: FavoriteBorderIcon, activeColor: '#e91e63', add: addLove,      remove: removeLove      },
  { key: 'watched',     label: 'Watched',   ActiveIcon: VisibilityIcon, InactiveIcon: VisibilityOffIcon, activeColor: '#4caf50', add: addWatched, remove: removeWatched },
];

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
      ? `${tmdb.numberOfSeasons} Season${tmdb.numberOfSeasons !== 1 ? 's' : ''}${tmdb.numberOfEpisodes ? ` · ${tmdb.numberOfEpisodes} Episodes` : ''}`
      : null;

  const rating = tmdb.voteAverage ? Math.round(tmdb.voteAverage * 10) / 10 : null;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: { xs: 440, sm: 500, md: 580 },
        overflow: 'hidden',
        bgcolor: '#050505',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      }}
    >
      {/* Backdrop with parallax-style scale */}
      {backdropUrl && (
        <Box
          component={motion.img}
          src={backdropUrl}
          alt=""
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.55 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
          }}
        />
      )}

      {/* Multi-stop gradient mesh — left-to-right and bottom-to-top depth */}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.62) 55%, rgba(0,0,0,0.05) 100%)' }} />
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.55) 38%, transparent 72%)' }} />
      {/* Subtle teal vignette for accent */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at bottom left, rgba(13,148,136,0.22) 0%, transparent 55%)',
      }} />

      {/* Back button (hidden when rendered inside the modal — modal has its own close) */}
      {!inModal && (
        <Box sx={{ position: 'absolute', top: 16, left: { xs: 12, md: 24 }, zIndex: 2 }}>
          <IconButton
            size="small"
            onClick={onBack ?? (() => window.history.back())}
            sx={{
              bgcolor: alpha('#000', 0.55), color: '#fff',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha('#fff', 0.12)}`,
              '&:hover': { bgcolor: alpha('#000', 0.75) },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      )}

      {/* Content */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
        sx={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'flex-end',
          px: { xs: 2, sm: 3, md: 5 },
          pb: { xs: 3, md: 5 },
        }}
      >
        <Box sx={{
          display: 'flex', gap: { xs: 2, md: 3.5 }, alignItems: 'flex-end',
          // Match the section Container's max-width below so the Hero content
          // and the rest of the page share the same horizontal rhythm and
          // both sit centered on big screens.
          width: '100%', maxWidth: { xs: '100%', lg: 1200 }, mx: 'auto',
        }}>

          {/* Poster */}
          {posterUrl && !isXs && (
            <Box
              component={motion.img}
              src={posterUrl}
              alt={tmdb.title ?? record?.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.25, ease: 'easeOut' }}
              sx={{
                width: { sm: 110, md: 160 },
                aspectRatio: '2/3',
                borderRadius: 2,
                boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)',
                flexShrink: 0,
                objectFit: 'cover',
              }}
            />
          )}

          {/* Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Chip
              label={isMovie ? 'Movie' : 'TV Series'}
              size="small"
              sx={{
                bgcolor: alpha('#0d9488', 0.28), color: '#5eead4',
                fontSize: '0.68rem', fontWeight: 700, mb: 1, height: 22,
                border: `1px solid ${alpha('#0d9488', 0.5)}`,
                letterSpacing: 0.5,
              }}
            />

            <Typography
              variant="h3"
              sx={{
                color: '#fff', fontWeight: 800, lineHeight: 1.05,
                fontSize: { xs: '1.6rem', sm: '2.1rem', md: '2.75rem' },
                textShadow: '0 2px 16px rgba(0,0,0,0.9)',
                mb: 0.5, letterSpacing: -0.6,
              }}
            >
              {tmdb.title ?? record?.name}
            </Typography>

            {tmdb.originalTitle && tmdb.originalTitle !== tmdb.title && (
              <Typography variant="body2" sx={{ color: '#9e9e9e', mb: 0.75, fontStyle: 'italic' }}>
                {tmdb.originalTitle}
              </Typography>
            )}

            {/* Meta row with animated rating */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1, md: 1.5 }, mb: 1.25 }}>
              {rating != null && <RatingRing value={rating} size={isXs ? 44 : 56} label="TMDB" />}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {year && (
                    <Typography variant="body2" sx={{ color: '#bdbdbd', fontWeight: 600 }}>
                      {year}{endYear && endYear !== year ? `–${endYear}` : ''}
                    </Typography>
                  )}
                  {runtimeLine && (
                    <>
                      <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: '#616161' }} />
                      <Typography variant="body2" sx={{ color: '#bdbdbd' }}>{runtimeLine}</Typography>
                    </>
                  )}
                  {tmdb.status && (
                    <Chip
                      label={tmdb.status}
                      size="small"
                      sx={{
                        bgcolor: tmdb.status === 'Released' || tmdb.status === 'Ended' ? alpha('#4caf50', 0.18) : alpha('#ff9800', 0.18),
                        color: tmdb.status === 'Released' || tmdb.status === 'Ended' ? '#4caf50' : '#ff9800',
                        fontSize: '0.65rem', height: 18, ml: 0.5,
                      }}
                    />
                  )}
                </Box>
                {tmdb.voteCount > 0 && rating != null && (
                  <Typography variant="caption" sx={{ color: '#9e9e9e' }}>
                    {tmdb.voteCount.toLocaleString()} votes
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Genres — filter out entries without a name so we never render an empty pill */}
            {(() => {
              const genres = (tmdb.genres ?? []).filter((g) => g?.name);
              if (!genres.length) return null;
              return (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
                  {genres.map((g) => (
                    <Chip
                      key={g.id}
                      label={g.name}
                      size="small"
                      sx={{
                        bgcolor: alpha('#fff', 0.08), color: '#e0e0e0',
                        fontSize: '0.7rem', height: 22, backdropFilter: 'blur(4px)',
                        border: `1px solid ${alpha('#fff', 0.1)}`,
                      }}
                    />
                  ))}
                </Box>
              );
            })()}

            {/* Tagline */}
            {tmdb.tagline && (
              <Typography variant="body2" sx={{
                color: '#9e9e9e', fontStyle: 'italic', mb: 1.75,
                fontSize: '0.88rem', display: { xs: 'none', sm: 'block' },
              }}>
                &quot;{tmdb.tagline}&quot;
              </Typography>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {onWatchClick && (
                <Button
                  component={motion.button}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  variant="contained"
                  startIcon={<OndemandVideoIcon />}
                  onClick={onWatchClick}
                  size="medium"
                  sx={{
                    bgcolor: '#0d9488', color: '#fff', fontWeight: 800,
                    textTransform: 'none', px: 2.5, py: 0.85,
                    borderRadius: 6, fontSize: '0.88rem',
                    boxShadow: '0 8px 24px rgba(13,148,136,0.35)',
                    '&:hover': { bgcolor: '#0f766e', boxShadow: '0 12px 32px rgba(13,148,136,0.5)' },
                  }}
                >
                  Watch Now
                </Button>
              )}

              {onPlayTrailer && (
                <Button
                  component={motion.button}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={onPlayTrailer}
                  size="medium"
                  sx={{
                    bgcolor: alpha('#fff', 0.16), color: '#fff', fontWeight: 700,
                    textTransform: 'none', px: 2.5, py: 0.85,
                    borderRadius: 6, fontSize: '0.88rem',
                    backdropFilter: 'blur(6px)',
                    border: `1px solid ${alpha('#fff', 0.22)}`,
                    '&:hover': { bgcolor: alpha('#fff', 0.26) },
                  }}
                >
                  Trailer
                </Button>
              )}

              {/* Interaction icons */}
              {INTERACTIONS.map(({ key, label, ActiveIcon, InactiveIcon, activeColor }) => {
                const active = interaction?.[key] ?? false;
                return (
                  <Tooltip key={key} title={label} placement="top">
                    <span>
                      <IconButton
                        size="small"
                        disabled={interactionLoading}
                        onClick={() => onToggle(key, active)}
                        sx={{
                          bgcolor: active ? alpha(activeColor, 0.28) : alpha('#fff', 0.1),
                          border: `1.5px solid ${active ? activeColor : alpha('#fff', 0.22)}`,
                          color: active ? activeColor : '#b3b3b3',
                          width: 40, height: 40,
                          backdropFilter: 'blur(6px)',
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: active ? alpha(activeColor, 0.38) : alpha('#fff', 0.2),
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        {active ? <ActiveIcon sx={{ fontSize: 19 }} /> : <InactiveIcon sx={{ fontSize: 19 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                );
              })}

              <ShareButton record={record} />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
