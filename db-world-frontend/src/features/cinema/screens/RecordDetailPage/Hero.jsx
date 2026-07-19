import React, { useEffect, useState } from 'react';
import {
  Box, Button, Chip, IconButton, Skeleton, Tooltip, Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import StarRoundedIcon from '@mui/icons-material/StarRounded';

import { tmdbImg } from '../../api/cinemaApi';
import { formatRuntime } from './helpers';
import ShareButton from './shared/ShareButton';
import ReactionButton from './ReactionButton';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS

   Like + Love are merged into ReactionButton (Netflix-style),
   so only the simple toggles live here.
═══════════════════════════════════════════════════════════ */

const WATCHLIST = { key: 'watchlisted', label: 'My List', ActiveIcon: BookmarkIcon, InactiveIcon: BookmarkBorderIcon, activeColor: '#0d9488' };
const WATCHED = { key: 'watched', label: 'Watched', ActiveIcon: VisibilityIcon, InactiveIcon: VisibilityOffIcon, activeColor: '#22c55e' };

/* ═══════════════════════════════════════════════════════════
   TOGGLE BUTTON

   A single on/off interaction (My List, Watched). Stays
   responsive while the request is in flight — the parent does
   an optimistic update + rollback, so disabling here would only
   make the button feel laggy.
═══════════════════════════════════════════════════════════ */

function ToggleButton({ cfg, active, onToggle, btnSize, iconSize }) {
  const { key, label, ActiveIcon, InactiveIcon, activeColor } = cfg;
  return (
    <Tooltip title={active ? `Remove from ${label}` : label} placement="top">
      <span data-noexpand>
        <IconButton
          size="small"
          onClick={() => onToggle(key, active)}
          aria-label={active ? `Remove from ${label}` : `Add to ${label}`}
          sx={{
            bgcolor: active ? alpha(activeColor, 0.25) : alpha('#fff', 0.1),
            border: `1.5px solid ${active ? activeColor : alpha('#fff', 0.2)}`,
            color: active ? activeColor : '#e5e5e5',
            width: btnSize, height: btnSize,
            backdropFilter: 'blur(6px)',
            transition: 'all 0.18s',
            '&:hover': {
              bgcolor: active ? alpha(activeColor, 0.35) : alpha('#fff', 0.2),
              transform: 'scale(1.08)',
            },
          }}
        >
          {active
            ? <ActiveIcon sx={{ fontSize: iconSize }} />
            : <InactiveIcon sx={{ fontSize: iconSize }} />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACCENT

   A per-poster dominant colour used to be extracted here, but it
   resolved a beat late (the Watch button visibly changed colour)
   and its corner glow read poorly. A stable brand accent is
   cleaner and matches TMDB/Netflix's neutral treatment.
═══════════════════════════════════════════════════════════ */

const DEFAULT_ACCENT = '#0d9488';

/* ═══════════════════════════════════════════════════════════
   HERO COMPONENT
═══════════════════════════════════════════════════════════ */

export default function Hero({
  record, interaction, onToggle,
  onPlayTrailer, onWatchClick, onBack, inModal = false, preview = null,
  loading = false,
}) {
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const theme = useTheme();

  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));
  const isTv = useMediaQuery('(min-width:1920px)');

  const backdropUrl = tmdbImg(tmdb.backdropPath, isXs ? 'w780' : isTv ? 'original' : 'w1280');
  const posterUrl = tmdbImg(tmdb.posterPath, 'w342');
  const logoUrl = tmdbImg(tmdb.logoPath, isTv ? 'w780' : 'w500');
  // Instant poster base from the clicked card, so the real one crossfades in.
  const previewPosterUrl = tmdbImg(preview?.posterPathClean ?? preview?.posterPath ?? preview?.backdropPath, 'w342');

  const accentColor = DEFAULT_ACCENT;

  const [posterLoaded, setPosterLoaded] = useState(false);
  useEffect(() => { setPosterLoaded(false); }, [posterUrl]);

  // Flash-free backdrop: only ever SHOW a source that has already finished
  // loading. So when the preview backdrop is replaced by the full (or higher-res)
  // one, it crossfades cached-frame → cached-frame instead of blanking to black
  // and reloading (which was the "backdrop still flashing" on open).
  const [shownBackdrop, setShownBackdrop] = useState(null);
  useEffect(() => {
    if (!backdropUrl) return undefined;
    let cancelled = false;
    const img = new Image();
    img.src = backdropUrl;
    const done = () => { if (!cancelled) setShownBackdrop(backdropUrl); };
    if (img.complete) done(); else img.onload = done;
    return () => { cancelled = true; };
  }, [backdropUrl]);

  const year = isMovie ? tmdb.releaseDate?.slice(0, 4) : tmdb.firstAirDate?.slice(0, 4);
  const endYear = !isMovie && tmdb.lastAirDate ? tmdb.lastAirDate.slice(0, 4) : null;

  const runtimeLine = isMovie
    ? formatRuntime(tmdb.runtime)
    : tmdb.numberOfSeasons != null
      ? `${tmdb.numberOfSeasons} Season${tmdb.numberOfSeasons !== 1 ? 's' : ''}${tmdb.numberOfEpisodes ? ` · ${tmdb.numberOfEpisodes} Eps` : ''}`
      : null;

  const rating = tmdb.voteAverage ? Math.round(tmdb.voteAverage * 10) / 10 : null;
  const genres = (tmdb.genres ?? []).filter((g) => g?.name).slice(0, isTv ? 5 : 3);

  const overview = tmdb.overview ?? '';
  const heroOverview = overview.length > 200 ? overview.slice(0, 200).trimEnd() + '…' : overview;

  const metaDot = (
    <Box component="span" sx={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', bgcolor: alpha('#fff', 0.4), verticalAlign: 'middle' }} />
  );

  const btnSize = isTv ? 52 : isXl ? 44 : isXs ? 34 : 38;
  const iconSize = isTv ? 24 : isXl ? 20 : isXs ? 16 : 18;

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: { xs: 340, sm: 420, md: 500, lg: 560, xl: 620 },
        ...(isTv && { minHeight: '75vh' }),
        overflow: 'hidden',
        bgcolor: '#050505',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      {/* Backdrop — crossfades between already-loaded frames, so it never blanks
          to black when the preview image is upgraded to the full one. */}
      <AnimatePresence initial={false}>
        {shownBackdrop && (
          <Box
            component={motion.img}
            key={shownBackdrop}
            src={shownBackdrop}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.6, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.6, ease: 'easeOut' }, scale: { duration: 1.4, ease: 'easeOut' } }}
            sx={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 25%',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Scrims */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 25%)',
      }} />

      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to top, #141414 0%, rgba(20,20,20,0.7) 30%, rgba(20,20,20,0.15) 60%, rgba(20,20,20,0.05) 80%)',
      }} />

      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        display: { xs: 'none', md: 'block' },
        background: 'linear-gradient(to right, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.4) 40%, transparent 75%)',
      }} />

      {/* Back button */}
      {!inModal && (
        <IconButton
          size="small"
          aria-label="Go back"
          onClick={onBack ?? (() => window.history.back())}
          sx={{
            position: 'absolute', top: 16,
            left: { xs: 12, md: 24, xl: 40 },
            zIndex: 3,
            bgcolor: alpha('#000', 0.5), color: '#fff',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha('#fff', 0.14)}`,
            '&:hover': { bgcolor: alpha('#000', 0.72) },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: { xs: 20, xl: 24 } }} />
        </IconButton>
      )}

      {/* Foreground content */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        sx={{
          position: 'relative', zIndex: 2, width: '100%',
          px: { xs: 2, sm: 3, md: 5, xl: 8 },
          pt: { xs: 3, md: 6 },
          pb: { xs: 2, md: 3.5, xl: 5 },
        }}
      >
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1.5, sm: 2.5, md: 3, xl: 4 },
          alignItems: { xs: 'flex-start', sm: 'flex-end' },
          width: '100%',
          maxWidth: { xs: '100%', lg: 1200, xl: 1400 },
          mx: 'auto',
        }}>

          {/* Poster — only when there's no logo (logo + backdrop is the hero;
              the poster would be redundant). Hidden on mobile regardless. */}
          {posterUrl && !logoUrl && (
            <Box sx={{
              position: 'relative',
              width: { xs: 0, sm: 120, md: 160, lg: 180, xl: 220 },
              display: { xs: 'none', sm: 'block' },
              flexShrink: 0,
              alignSelf: 'flex-end',
            }}>
              {previewPosterUrl ? (
                /* Instant preview poster — the real one crossfades in over it. */
                <Box
                  component="img"
                  src={previewPosterUrl}
                  alt=""
                  draggable={false}
                  sx={{
                    position: 'absolute', inset: 0,
                    width: '100%', aspectRatio: '2/3',
                    borderRadius: { sm: 2, md: 2.5 },
                    objectFit: 'cover',
                  }}
                />
              ) : (!posterLoaded && (
                <Skeleton
                  variant="rounded"
                  sx={{
                    position: 'absolute', inset: 0,
                    width: '100%', aspectRatio: '2/3',
                    borderRadius: { sm: 2, md: 2.5 },
                    bgcolor: alpha('#fff', 0.06),
                  }}
                />
              ))}
              <Box
                component={motion.img}
                src={posterUrl}
                alt={tmdb.title ?? record?.name}
                draggable={false}
                onLoad={() => setPosterLoaded(true)}
                onError={() => setPosterLoaded(true)}
                initial={{ opacity: 0, y: 18 }}
                animate={{
                  opacity: posterLoaded ? 1 : 0,
                  y: posterLoaded ? 0 : 18,
                }}
                transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
                sx={{
                  width: '100%',
                  aspectRatio: '2/3',
                  borderRadius: { sm: 2, md: 2.5 },
                  boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px ${alpha(accentColor, 0.12)}`,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </Box>
          )}

          {/* Info column — logo/title first, then the type chip + the rest */}
          <Box sx={{ flex: 1, minWidth: 0, pb: { xs: 0, md: 1, xl: 2 } }}>

            {logoUrl ? (
              <Box
                component="img"
                src={logoUrl}
                alt={tmdb.title ?? record?.name}
                draggable={false}
                sx={{
                  // Capped so a wide logo doesn't dominate small screens.
                  maxWidth: { xs: 200, sm: 280, md: 340, lg: 380, xl: 440 },
                  maxHeight: { xs: 72, sm: 92, md: 124, lg: 144, xl: 168 },
                  ...(isTv && { maxHeight: 200 }),
                  objectFit: 'contain',
                  objectPosition: 'left center',
                  display: 'block',
                  mb: 0.5,
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.7))',
                }}
              />
            ) : (
              <Typography
                variant="h1"
                sx={{
                  color: '#fff', fontWeight: 800, lineHeight: 1.05,
                  fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2.5rem', lg: '2.8rem', xl: '3.2rem' },
                  ...(isTv && { fontSize: '3.8rem' }),
                  textShadow: '0 2px 18px rgba(0,0,0,0.85)',
                  letterSpacing: -0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {tmdb.title ?? record?.name}
              </Typography>
            )}

            {tmdb.tagline && (
              <Typography sx={{
                color: alpha('#fff', 0.6),
                fontSize: { xs: '0.8rem', md: '0.92rem', xl: '1.05rem' },
                ...(isTv && { fontSize: '1.2rem' }),
                fontWeight: 500, fontStyle: 'italic',
                letterSpacing: 0.3, mt: 0.5,
                textShadow: '0 1px 8px rgba(0,0,0,0.6)',
              }}>
                {tmdb.tagline}
              </Typography>
            )}

            <Box sx={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              gap: { xs: 0.75, md: 1, xl: 1.5 }, mt: 1, mb: 1,
            }}>
              {rating != null && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 0.4,
                  bgcolor: alpha('#000', 0.35), borderRadius: 1,
                  px: { xs: 0.75, xl: 1 }, py: 0.25,
                }}>
                  <StarRoundedIcon sx={{ fontSize: { xs: 16, xl: 20 }, color: '#fbbf24' }} />
                  <Typography sx={{
                    color: '#fde68a',
                    fontSize: { xs: '0.8rem', xl: '0.95rem' },
                    ...(isTv && { fontSize: '1.1rem' }),
                    fontWeight: 800,
                  }}>
                    {rating}
                  </Typography>
                </Box>
              )}

              {year && (
                <Typography sx={{
                  color: '#d4d4d4',
                  fontSize: { xs: '0.82rem', xl: '0.95rem' },
                  ...(isTv && { fontSize: '1.1rem' }),
                  fontWeight: 600,
                }}>
                  {year}{endYear && endYear !== year ? `–${endYear}` : ''}
                </Typography>
              )}

              {runtimeLine ? (
                <>
                  {metaDot}
                  <Typography sx={{
                    color: '#d4d4d4',
                    fontSize: { xs: '0.82rem', xl: '0.95rem' },
                    ...(isTv && { fontSize: '1.1rem' }),
                  }}>
                    {runtimeLine}
                  </Typography>
                </>
              ) : loading ? (
                <>
                  {metaDot}
                  <Skeleton width={64} height={16} sx={{ bgcolor: alpha('#fff', 0.09), borderRadius: 0.5 }} />
                </>
              ) : null}

              {tmdb.status && (
                <Chip
                  label={tmdb.status}
                  size="small"
                  sx={{
                    height: { xs: 18, xl: 22 },
                    fontSize: { xs: '0.62rem', xl: '0.72rem' },
                    fontWeight: 700,
                    bgcolor: (tmdb.status === 'Released' || tmdb.status === 'Ended')
                      ? alpha('#22c55e', 0.16) : alpha('#f59e0b', 0.16),
                    color: (tmdb.status === 'Released' || tmdb.status === 'Ended')
                      ? '#4ade80' : '#fbbf24',
                    '& .MuiChip-label': { px: 0.8 },
                  }}
                />
              )}
            </Box>

            {genres.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.25 }}>
                {genres.map((g) => (
                  <Chip
                    key={g.id}
                    label={g.name}
                    size="small"
                    sx={{
                      bgcolor: alpha('#fff', 0.08), color: '#e5e5e5',
                      fontSize: { xs: '0.68rem', xl: '0.78rem' },
                      height: { xs: 22, xl: 26 },
                      border: `1px solid ${alpha('#fff', 0.1)}`,
                    }}
                  />
                ))}
              </Box>
            ) : loading ? (
              <Box sx={{ display: 'flex', gap: 0.6, mb: 1.25 }}>
                {[62, 80, 54].map((w, i) => (
                  <Skeleton key={i} variant="rounded" width={w} height={isXs ? 22 : 26}
                    sx={{ bgcolor: alpha('#fff', 0.08), borderRadius: 1 }} />
                ))}
              </Box>
            ) : null}

            {heroOverview && !isXs ? (
              <Typography sx={{
                color: alpha('#fff', 0.55),
                fontSize: { sm: '0.82rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                ...(isTv && { fontSize: '1.15rem' }),
                lineHeight: 1.6,
                mb: 1.75,
                maxWidth: { sm: 400, md: 520, lg: 600, xl: 700 },
                display: '-webkit-box',
                WebkitLineClamp: 2,
                ...(isTv && { WebkitLineClamp: 4 }),
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {heroOverview}
              </Typography>
            ) : loading && !isXs ? (
              <Box sx={{ mb: 1.75, maxWidth: { sm: 400, md: 520, lg: 600, xl: 700 } }}>
                <Skeleton width="92%" height={16} sx={{ bgcolor: alpha('#fff', 0.08) }} />
                <Skeleton width="74%" height={16} sx={{ bgcolor: alpha('#fff', 0.08) }} />
              </Box>
            ) : null}

            <Box sx={{
              display: 'flex',
              gap: { xs: 0.75, md: 1, xl: 1.25 },
              flexWrap: 'wrap', alignItems: 'center',
            }}>
              {onWatchClick && (
                <Button
                  component={motion.button}
                  whileTap={{ scale: 0.97 }}
                  variant="contained"
                  startIcon={<OndemandVideoIcon sx={{ fontSize: { xl: '1.3rem !important' } }} />}
                  onClick={onWatchClick}
                  sx={{
                    bgcolor: accentColor, color: '#fff', fontWeight: 800,
                    textTransform: 'none',
                    px: { xs: 2, sm: 2.5, xl: 3.5 },
                    py: { xs: 0.85, xl: 1.2 },
                    borderRadius: 999,
                    fontSize: { xs: '0.82rem', sm: '0.88rem', xl: '1.05rem' },
                    ...(isTv && { fontSize: '1.2rem', px: 4.5, py: 1.5 }),
                    boxShadow: `0 8px 24px ${alpha(accentColor, 0.4)}`,
                    '&:hover': { bgcolor: accentColor, filter: 'brightness(0.85)' },
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
                  startIcon={<PlayArrowIcon sx={{ fontSize: { xl: '1.3rem !important' } }} />}
                  onClick={onPlayTrailer}
                  sx={{
                    color: '#fff', fontWeight: 700, textTransform: 'none',
                    px: { xs: 1.75, sm: 2, xl: 3 },
                    py: { xs: 0.85, xl: 1.2 },
                    borderRadius: 999,
                    fontSize: { xs: '0.82rem', sm: '0.88rem', xl: '1.05rem' },
                    ...(isTv && { fontSize: '1.2rem', px: 4, py: 1.5 }),
                    bgcolor: alpha('#fff', 0.12),
                    backdropFilter: 'blur(6px)',
                    border: `1px solid ${alpha('#fff', 0.2)}`,
                    '&:hover': { bgcolor: alpha('#fff', 0.22) },
                  }}
                >
                  Trailer
                </Button>
              )}

              <Box sx={{
                display: 'flex',
                gap: { xs: 0.6, md: 0.75, xl: 1 },
                ml: { xs: 0, sm: 0.5 },
              }}>
                <ToggleButton
                  cfg={WATCHLIST}
                  active={interaction?.watchlisted ?? false}
                  onToggle={onToggle}
                  btnSize={btnSize}
                  iconSize={iconSize}
                />

                <ReactionButton
                  liked={interaction?.liked ?? false}
                  loved={interaction?.loved ?? false}
                  onToggle={onToggle}
                  btnSize={btnSize}
                  iconSize={iconSize}
                />

                <ToggleButton
                  cfg={WATCHED}
                  active={interaction?.watched ?? false}
                  onToggle={onToggle}
                  btnSize={btnSize}
                  iconSize={iconSize}
                />

                <Box component="span" data-noexpand sx={{ display: 'inline-flex' }}>
                  <ShareButton record={record} size={btnSize} />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}