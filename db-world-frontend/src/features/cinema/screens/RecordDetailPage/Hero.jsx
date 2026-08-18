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
import HeroTrailer, { HERO_CONTROL_SIZE, HERO_CONTROL_TOP } from './HeroTrailer';
import TechBadgeRow from './shared/TechBadgeRow';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS

   Like + Love are merged into ReactionButton (Netflix-style),
   so only the simple toggles live here.
═══════════════════════════════════════════════════════════ */

const WATCHLIST = { key: 'watchlisted', label: 'My List', ActiveIcon: BookmarkIcon, InactiveIcon: BookmarkBorderIcon, activeColor: '#0d9488' };
const WATCHED = { key: 'watched', label: 'Watched', ActiveIcon: VisibilityIcon, InactiveIcon: VisibilityOffIcon, activeColor: '#22c55e' };

/* ═══════════════════════════════════════════════════════════
   ENTRY CHOREOGRAPHY

   One block fade-up read as a single lump. Staggering the rows
   lets the eye land title → meta → actions in that order, which
   is the whole point of a hero. Distances stay small (<24px) so
   nothing reads as sliding furniture.
═══════════════════════════════════════════════════════════ */

const EASE = [0.22, 1, 0.36, 1];

const COLUMN = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.14 } },
};

const RISE = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

const SLIDE = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE } },
};

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
   MOBILE ACTION RAIL

   Phones get flat icon-over-label buttons spread across the
   width instead of a huddle of unlabelled circles. At thumb
   distance the label is what makes the affordance legible —
   a bare outline eye reads as neither "watched" nor "hide".
═══════════════════════════════════════════════════════════ */

function RailAction({ label, active, activeColor, onClick, children }) {
  return (
    <Box
      component={motion.button}
      data-noexpand
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      sx={{
        width: '100%', minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
        background: 'none', border: 'none', p: 0, cursor: 'pointer',
        color: active ? activeColor : alpha('#fff', 0.62),
        transition: 'color .18s',
      }}
    >
      {children}
      <Typography component="span" sx={{
        fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.2,
        color: 'inherit', whiteSpace: 'nowrap',
      }}>
        {label}
      </Typography>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACCENT

   A per-poster dominant colour used to be extracted here, but it
   resolved a beat late (the Watch button visibly changed colour)
   and its corner glow read poorly. A stable brand accent is
   cleaner and matches TMDB/Netflix's neutral treatment.

   The ambient wash below gets its per-title colour from a blurred
   copy of the artwork instead — same atmosphere, but it rides the
   image that is already loading, so nothing resolves late and no
   control ever changes colour under the user.
═══════════════════════════════════════════════════════════ */

const DEFAULT_ACCENT = '#0d9488';

/* Noise plate over the artwork. TMDB stills are heavily compressed and band
   badly across the scrim gradients; a few percent of grain hides it. */
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")";

/* Long enough to read the title and see the artwork first — cutting to video
   immediately reads as an ad rather than an intro. */
const TRAILER_DELAY_MS = 2600;

/**
 * Pick artwork with no title text burned into it.
 *
 * TMDB tags a plate that carries text with the language of that text; textless
 * plates come back with a null `iso6391`. The hero renders the title itself (or
 * the logo image), so a plate with baked-in text shows the name twice — which
 * is exactly what a poster does by design. Falls back to the record's default
 * path when the title has no textless variant.
 */
function pickTextless(images, type, fallback) {
  const candidates = (images ?? []).filter(
    (i) => i.imageType === type && !i.iso6391 && i.filePath,
  );
  if (!candidates.length) return fallback;
  // Highest-voted plate, so we don't land on someone's blurry upload.
  return candidates.reduce((a, b) => ((b.voteAverage ?? 0) > (a.voteAverage ?? 0) ? b : a)).filePath;
}

/**
 * Whether a background trailer is appropriate at all. Motion sensitivity and
 * metered connections both mean "show the still".
 */
function autoplayAllowed() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false;
  const conn = navigator.connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return false;
  return true;
}

/* ═══════════════════════════════════════════════════════════
   HERO COMPONENT
═══════════════════════════════════════════════════════════ */

export default function Hero({
  record, interaction, onToggle,
  onPlayTrailer, onWatchClick, onBack, inModal = false, preview = null,
  loading = false, files = [], progress = null, trailerKey = null,
}) {
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const theme = useTheme();

  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));
  const isTv = useMediaQuery('(min-width:1920px)');

  // Mobile leads with the portrait poster rather than a cropped landscape still —
  // a 16:9 backdrop squeezed into a phone loses most of its subject, and the poster
  // is the artwork actually designed to be read at that size.
  // Textless preference applies to the BACKDROP only.
  //
  // It deliberately does NOT apply to the poster: `tmdb.images` is absent from
  // the preview, so a textless pick resolves only after the full record lands —
  // which swapped the poster for different artwork than the card the user just
  // clicked. That identity change is the "flip". Posters are designed around
  // their title anyway, so there's nothing to gain here.
  const backdropFile = pickTextless(tmdb.images, 'Backdrop', tmdb.backdropPath);

  const posterUrl = tmdbImg(tmdb.posterPath, isXs ? 'w500' : 'w342');

  // Only ever show the FULL record's backdrop — never the rail/preview one. On
  // desktop the record is hover-prefetched so it's already loaded on open; mobile has
  // no hover, so without this the hero paints the preview backdrop and then visibly
  // swaps to the API image once it loads. While the full record is loading we show a
  // skeleton instead (the flash-free desktop behaviour, applied everywhere).
  const backdropUrl = loading
    ? null
    : tmdbImg(backdropFile, isXs ? 'w780' : isTv ? 'original' : 'w1280');

  // The image that fills the hero: poster on phones, backdrop everywhere else.
  // Falls back to the other one so a record missing either art still renders.
  const stageUrl = loading
    ? null
    : (isXs ? (posterUrl ?? backdropUrl) : (backdropUrl ?? posterUrl));

  const logoUrl = tmdbImg(tmdb.logoPath, isTv ? 'w780' : 'w500');
  // Instant poster base from the clicked card, so the real one crossfades in.
  const previewPosterUrl = tmdbImg(preview?.posterPathClean ?? preview?.posterPath ?? preview?.backdropPath, 'w342');

  const accentColor = DEFAULT_ACCENT;

  // Flash-free poster, same rule as the stage below: only ever SHOW a URL that
  // has already finished decoding.
  //
  // The previous version reset a `posterLoaded` flag on every posterUrl change,
  // which drove the visible image back to opacity 0 and y:18 — so any change of
  // URL (even preview w342 → full w342 of the same file) made the poster blank
  // out and slide in again. Holding the last good frame until the next one is
  // ready means it can crossfade instead of flickering.
  const [shownPoster, setShownPoster] = useState(null);
  useEffect(() => {
    if (!posterUrl) return undefined;
    let cancelled = false;
    const img = new Image();
    img.src = posterUrl;
    const done = () => { if (!cancelled) setShownPoster(posterUrl); };
    if (img.complete) done(); else { img.onload = done; img.onerror = done; }
    return () => { cancelled = true; };
  }, [posterUrl]);

  // Flash-free stage image: only ever SHOW a source that has already finished
  // loading. So when the preview backdrop is replaced by the full (or higher-res)
  // one, it crossfades cached-frame → cached-frame instead of blanking to black
  // and reloading (which was the "backdrop still flashing" on open).
  const [shownStage, setShownStage] = useState(null);
  useEffect(() => {
    if (!stageUrl) return undefined;
    let cancelled = false;
    const img = new Image();
    img.src = stageUrl;
    const done = () => { if (!cancelled) setShownStage(stageUrl); };
    if (img.complete) done(); else img.onload = done;
    return () => { cancelled = true; };
  }, [stageUrl]);

  // Background trailer — only once the artwork has actually painted, so the
  // transition is still → video rather than black → video.
  const [trailerPlaying, setTrailerPlaying] = useState(false);
  const [trailerDismissed, setTrailerDismissed] = useState(false);

  useEffect(() => {
    setTrailerPlaying(false);
    setTrailerDismissed(false);
  }, [trailerKey]);

  useEffect(() => {
    if (!trailerKey || trailerDismissed || !shownStage || !autoplayAllowed()) return undefined;
    const timer = setTimeout(() => setTrailerPlaying(true), TRAILER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [trailerKey, trailerDismissed, shownStage]);

  const stopTrailer = () => {
    setTrailerPlaying(false);
    setTrailerDismissed(true);
  };

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

  const resumable = progress?.percent > 0 && progress?.percent < 97;

  // Rating, year, runtime, status and genres share ONE wrapping row.
  //
  // They used to be two rows, merged only when the record was sparse — but that
  // merge depended on post-load fields, so the shape changed as data arrived.
  // Keeping them in a single wrapping row means the browser decides the line
  // count from the space actually available: a rich title wraps to two lines, a
  // thin one occupies a single line, and neither restructures on load.
  const genreChips = genres.map((g) => (
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
  ));

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
        // Phones get a tall, poster-shaped stage; wider viewports keep the
        // cinematic letterbox the landscape backdrop is cut for.
        minHeight: { xs: '68vh', sm: 420, md: 500, lg: 560, xl: 620 },
        ...(isXs && { maxHeight: 640 }),
        ...(isTv && { minHeight: '75vh' }),
        overflow: 'hidden',
        bgcolor: '#050505',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      {/* Ambient wash — the same artwork, blown up and blurred past recognition.
          Gives every title its own colour temperature without a palette
          extraction step that could resolve late (see ACCENT note above). */}
      <AnimatePresence initial={false}>
        {shownStage && (
          <Box
            component={motion.img}
            key={`ambient-${shownStage}`}
            src={shownStage}
            alt=""
            aria-hidden
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            sx={{
              position: 'absolute', inset: '-18%',
              width: '136%', height: '136%',
              objectFit: 'cover',
              filter: 'blur(64px) saturate(150%)',
              transform: 'scale(1.15)',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Stage image — crossfades between already-loaded frames, so it never blanks
          to black when the preview image is upgraded to the full one. */}
      <AnimatePresence initial={false}>
        {shownStage && (
          <Box
            component={motion.img}
            key={shownStage}
            src={shownStage}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: isXs ? 0.94 : 0.6, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.6, ease: 'easeOut' }, scale: { duration: 1.4, ease: 'easeOut' } }}
            sx={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              // Portrait art is framed for the top; landscape stills read best
              // slightly above centre.
              objectPosition: { xs: 'center top', sm: 'center 25%' },
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Background trailer, above the still and below every scrim so the title
          copy keeps the same contrast either way. */}
      <AnimatePresence>
        {trailerPlaying && (
          <HeroTrailer
            key={trailerKey}
            videoKey={trailerKey}
            title={tmdb.title ?? record?.name}
            onStop={stopTrailer}
          />
        )}
      </AnimatePresence>

      {/* Skeleton while the real artwork is still loading — shown instead of the
          rail/preview image, so there's no visible image swap when the record loads. */}
      {!shownStage && (loading || stageUrl) && (
        <Skeleton
          variant="rectangular"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', bgcolor: alpha('#fff', 0.05) }}
        />
      )}

      {/* Grain */}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: 0.055, backgroundImage: GRAIN,
      }} />

      {/* Scrims */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 25%)',
      }} />

      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        // Phones need a much longer fade: the text sits over the poster's lower
        // third, so the wash has to start high enough to keep it legible.
        //
        // Many stops, eased rather than linear. A three-stop ramp puts most of
        // its change in one narrow band, which reads as a visible horizontal
        // seam across the artwork instead of a fade.
        background: {
          xs: `linear-gradient(to top,
                #141414 0%,
                rgba(20,20,20,0.98) 12%,
                rgba(20,20,20,0.92) 22%,
                rgba(20,20,20,0.78) 32%,
                rgba(20,20,20,0.58) 42%,
                rgba(20,20,20,0.38) 53%,
                rgba(20,20,20,0.22) 64%,
                rgba(20,20,20,0.10) 75%,
                rgba(20,20,20,0.03) 86%,
                transparent 96%)`,
          sm: `linear-gradient(to top,
                #141414 0%,
                rgba(20,20,20,0.9) 14%,
                rgba(20,20,20,0.72) 27%,
                rgba(20,20,20,0.48) 41%,
                rgba(20,20,20,0.28) 55%,
                rgba(20,20,20,0.13) 69%,
                rgba(20,20,20,0.04) 84%,
                transparent 95%)`,
        },
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
            // Same line and size as the trailer's mute/replay on the right.
            position: 'absolute',
            top: HERO_CONTROL_TOP,
            left: { xs: 12, md: 24, xl: 40 },
            zIndex: 3,
            bgcolor: alpha('#000', 0.5), color: '#fff',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha('#fff', 0.14)}`,
            width: HERO_CONTROL_SIZE, height: HERO_CONTROL_SIZE,
            '&:hover': { bgcolor: alpha('#000', 0.72) },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
      )}

      {/* Foreground content */}
      <Box
        component={motion.div}
        variants={COLUMN}
        initial="hidden"
        animate="show"
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
          // On xs this is a COLUMN, so align-items works on the horizontal axis:
          // flex-start shrink-wrapped the info column to its widest child, which
          // is why the action rail bunched to the left instead of spreading.
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          width: '100%',
          maxWidth: { xs: '100%', lg: 1200, xl: 1400 },
          mx: 'auto',
        }}>

          {/* Poster column. Hidden on mobile, where the poster IS the hero stage.

              This used to be suppressed whenever a logo existed. The preview
              record carries no logoPath, so the column rendered during loading
              and then VANISHED the moment the full record arrived with one —
              reflowing the whole hero sideways in a single frame. That swap is
              what read as the layout "changing and overriding" on fresh load.
              The column now stays put and only the title slot swaps text→logo. */}
          {(posterUrl || loading) && (
            <Box sx={{
              position: 'relative',
              width: { xs: 0, sm: 120, md: 160, lg: 180, xl: 220 },
              display: { xs: 'none', sm: 'block' },
              flexShrink: 0,
              alignSelf: 'flex-end',
            }}>
              {/* Base layer: the poster from the clicked card, painted instantly
                  and never animated. Whatever happens above it, the slot is
                  never empty, so there is nothing to flicker back to. */}
              {(previewPosterUrl || shownPoster) ? (
                <Box
                  component="img"
                  src={previewPosterUrl ?? shownPoster}
                  alt=""
                  aria-hidden
                  draggable={false}
                  sx={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    borderRadius: { sm: 2, md: 2.5 },
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <Skeleton
                  variant="rounded"
                  sx={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    borderRadius: { sm: 2, md: 2.5 },
                    bgcolor: alpha('#fff', 0.06),
                  }}
                />
              )}

              {/* Crossfades between already-decoded frames only — so upgrading
                  the preview poster to the full-size one is a dissolve between
                  two painted images, never a blank. */}
              <AnimatePresence initial={false}>
                {shownPoster && (
                  <Box
                    component={motion.img}
                    key={shownPoster}
                    src={shownPoster}
                    alt={tmdb.title ?? record?.name}
                    draggable={false}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    sx={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%',
                      borderRadius: { sm: 2, md: 2.5 },
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Spacer that gives the column its 2:3 height; the layers above
                  are absolutely positioned over it. */}
              <Box sx={{
                width: '100%', aspectRatio: '2/3',
                borderRadius: { sm: 2, md: 2.5 },
                boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px ${alpha(accentColor, 0.12)}`,
                pointerEvents: 'none',
              }} />
            </Box>
          )}

          {/* Info column — logo/title first, then the type chip + the rest */}
          <Box sx={{ flex: 1, minWidth: 0, pb: { xs: 0, md: 1, xl: 2 } }}>

            {/* Title slot. The logo only arrives with the full record, so this
                reserves a stable height — otherwise swapping two lines of text
                for a logo image resizes the block and shunts everything below. */}
            <Box component={motion.div} variants={RISE} sx={{
              display: 'flex', alignItems: 'flex-end',
              minHeight: { xs: 74, sm: 76, md: 104, lg: 118, xl: 136 },
              '@media (min-width:1920px)': { minHeight: 168 },
            }}>
              {logoUrl ? (
                <Box
                  component={motion.img}
                  key="logo"
                  src={logoUrl}
                  alt={tmdb.title ?? record?.name}
                  draggable={false}
                  // The logo only exists on the full record, so this replaces the
                  // text title mid-flight. Height is already reserved by the slot;
                  // the crossfade stops the swap itself reading as a glitch.
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  sx={{
                    // Capped so a wide logo doesn't dominate small screens.
                    maxWidth: { xs: 240, sm: 280, md: 340, lg: 380, xl: 440 },
                    maxHeight: { xs: 96, sm: 92, md: 124, lg: 144, xl: 168 },
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
                    fontSize: { xs: '2rem', sm: '1.8rem', md: '2.5rem', lg: '2.8rem', xl: '3.2rem' },
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
            </Box>

            {/* ── Metadata cluster ──────────────────────────────────────────
                Tagline, tech badges, meta row and genres all arrive only with
                the FULL record, and any of them can be absent entirely.

                Reserving each one individually didn't work: a skeleton that is
                replaced by NOTHING (record has no tagline, no certification, no
                genres) collapses just as visibly as one that appears. And the
                merge-genres decision depends on post-load fields, so the inner
                arrangement changes shape too.

                So the whole cluster gets ONE reserved height instead. Whatever
                happens inside — skeletons to content, content to nothing, one
                row to two — is contained, and nothing outside the box can move.

                The floor only covers the meta/genre line, NOT the optional
                tagline and badges above it. Reserving for those too left a
                visible void on records that have neither. Anything taller than
                the floor grows UPWARD into the artwork, because the hero is
                bottom-aligned — so the Watch button still never moves. */}
            <Box sx={{
              minHeight: { xs: 30, sm: 30, md: 34, xl: 40 },
              '@media (min-width:1920px)': { minHeight: 48 },
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
            {tmdb.tagline ? (
              <Typography component={motion.p} variants={RISE} sx={{
                color: alpha('#fff', 0.6),
                fontSize: { xs: '0.8rem', md: '0.92rem', xl: '1.05rem' },
                ...(isTv && { fontSize: '1.2rem' }),
                fontWeight: 500, fontStyle: 'italic',
                letterSpacing: 0.3, mt: 0.5,
                textShadow: '0 1px 8px rgba(0,0,0,0.6)',
              }}>
                {tmdb.tagline}
              </Typography>
            ) : loading ? (
              <Skeleton
                width="42%"
                sx={{
                  mt: 0.5, bgcolor: alpha('#fff', 0.08), borderRadius: 0.5,
                  height: { xs: 19, md: 22, xl: 25 },
                }}
              />
            ) : null}

            {/* What you actually get if you press play — resolution, HDR, codec,
                age rating. Previously this only existed inside the Watch tab. */}
            <Box component={motion.div} variants={SLIDE}>
              {loading && !files.length ? (
                <Box sx={{ display: 'flex', gap: 0.75, mt: 1 }}>
                  {[44, 58, 40].map((w, i) => (
                    <Skeleton key={i} variant="rounded" width={w}
                      sx={{ height: { xs: 20, xl: 24 }, bgcolor: alpha('#fff', 0.08), borderRadius: 0.75 }} />
                  ))}
                </Box>
              ) : (
                <TechBadgeRow files={files} certification={tmdb.certification} sx={{ mt: 1 }} />
              )}
            </Box>

            <Box component={motion.div} variants={SLIDE} sx={{
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

              {tmdb.status ? (
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
              ) : loading ? (
                <Skeleton variant="rounded" width={62}
                  sx={{ height: { xs: 18, xl: 22 }, bgcolor: alpha('#fff', 0.08), borderRadius: 1 }} />
              ) : null}

              {/* Genres live on the same wrapping row. On a phone this fills the
                  line the rating and status leave half-empty; on a wide screen
                  it all sits on one line with room to spare. */}
              {genres.length > 0 ? genreChips : loading ? (
                [62, 80, 54].map((w, i) => (
                  <Skeleton key={i} variant="rounded" width={w} height={isXs ? 22 : 26}
                    sx={{ bgcolor: alpha('#fff', 0.08), borderRadius: 1 }} />
                ))
              ) : null}
            </Box>
            </Box>

            {/* Same containment as the cluster above: a two-line slot that holds
                its height whether the synopsis is present, still loading, or
                missing altogether. */}
            <Box sx={{
              display: { xs: 'none', sm: 'block' },
              minHeight: { sm: 52, md: 54, lg: 56, xl: 64 },
              '@media (min-width:1920px)': { minHeight: 116 },
            }}>
            {heroOverview && !isXs ? (
              <Typography component={motion.p} variants={SLIDE} sx={{
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
            </Box>

            {/* Continue-watching bar. Only rendered mid-title, so a finished or
                never-started record keeps the plain Watch Now affordance. */}
            {resumable && (
              <Box component={motion.div} variants={RISE} sx={{ mb: 1.5, maxWidth: { xs: '100%', sm: 340 } }}>
                <Box sx={{
                  height: 3, borderRadius: 999, overflow: 'hidden',
                  bgcolor: alpha('#fff', 0.18),
                }}>
                  <Box sx={{
                    height: '100%', width: `${progress.percent}%`,
                    bgcolor: accentColor, borderRadius: 999,
                  }} />
                </Box>
                {progress.remainingLabel && (
                  <Typography sx={{
                    mt: 0.6, fontSize: { xs: '0.7rem', xl: '0.8rem' },
                    fontWeight: 600, color: alpha('#fff', 0.62),
                  }}>
                    {progress.remainingLabel} left
                  </Typography>
                )}
              </Box>
            )}

            <Box component={motion.div} variants={RISE} sx={{
              display: 'flex',
              gap: { xs: 1, md: 1, xl: 1.25 },
              alignItems: 'center',
            }}>
              {onWatchClick && (
                <Button
                  component={motion.button}
                  whileTap={{ scale: 0.97 }}
                  variant="contained"
                  startIcon={resumable
                    ? <PlayArrowIcon sx={{ fontSize: { xl: '1.3rem !important' } }} />
                    : <OndemandVideoIcon sx={{ fontSize: { xl: '1.3rem !important' } }} />}
                  onClick={onWatchClick}
                  sx={{
                    // Phones give the primary action the full width it deserves;
                    // from tablet up it sizes to its label so the row stays tight.
                    flex: { xs: 1, sm: '0 0 auto' },
                    bgcolor: accentColor, color: '#fff', fontWeight: 800,
                    textTransform: 'none',
                    px: { xs: 2, sm: 2.5, xl: 3.5 },
                    py: { xs: 1.05, xl: 1.2 },
                    borderRadius: 999,
                    fontSize: { xs: '0.9rem', sm: '0.88rem', xl: '1.05rem' },
                    ...(isTv && { fontSize: '1.2rem', px: 4.5, py: 1.5 }),
                    boxShadow: `0 8px 24px ${alpha(accentColor, 0.4)}`,
                    '&:hover': { bgcolor: accentColor, filter: 'brightness(0.85)' },
                  }}
                >
                  {resumable ? 'Resume' : 'Watch Now'}
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
                    flexShrink: 0,
                    color: '#fff', fontWeight: 700, textTransform: 'none',
                    px: { xs: 2, sm: 2, xl: 3 },
                    py: { xs: 1.05, xl: 1.2 },
                    borderRadius: 999,
                    fontSize: { xs: '0.9rem', sm: '0.88rem', xl: '1.05rem' },
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

              {/* Tablet and up: compact circles sit inline with the CTAs. */}
              <Box sx={{
                display: { xs: 'none', sm: 'flex' },
                gap: { sm: 0.75, xl: 1 },
                ml: 0.5,
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

            {/* Phones: a labelled rail below the CTAs.

                Grid rather than flex:1 children — the four controls have very
                different intrinsic widths (an IconButton vs a bare icon), and
                equal grid tracks spread them evenly regardless. */}
            <Box component={motion.div} variants={RISE} sx={{
              display: { xs: 'grid', sm: 'none' },
              gridTemplateColumns: 'repeat(4, 1fr)',
              alignItems: 'start',
              justifyItems: 'center',
              gap: 1, mt: 2, width: '100%',
            }}>
              <RailAction
                label={WATCHLIST.label}
                active={interaction?.watchlisted ?? false}
                activeColor={WATCHLIST.activeColor}
                onClick={() => onToggle(WATCHLIST.key, interaction?.watchlisted ?? false)}
              >
                {interaction?.watchlisted
                  ? <BookmarkIcon sx={{ fontSize: 22 }} />
                  : <BookmarkBorderIcon sx={{ fontSize: 22 }} />}
              </RailAction>

              {/* Reaction keeps its own popover, so it renders its real control
                  with the rail's label underneath rather than being reimplemented. */}
              <Box sx={{
                width: '100%', minWidth: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
              }}>
                <ReactionButton
                  flat
                  liked={interaction?.liked ?? false}
                  loved={interaction?.loved ?? false}
                  onToggle={onToggle}
                  btnSize={26}
                  iconSize={22}
                />
                <Typography component="span" sx={{
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.2,
                  color: (interaction?.liked || interaction?.loved) ? '#3b82f6' : alpha('#fff', 0.62),
                }}>
                  Rate
                </Typography>
              </Box>

              <RailAction
                label={WATCHED.label}
                active={interaction?.watched ?? false}
                activeColor={WATCHED.activeColor}
                onClick={() => onToggle(WATCHED.key, interaction?.watched ?? false)}
              >
                {interaction?.watched
                  ? <VisibilityIcon sx={{ fontSize: 22 }} />
                  : <VisibilityOffIcon sx={{ fontSize: 22 }} />}
              </RailAction>

              <Box sx={{
                width: '100%', minWidth: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
              }}>
                <Box component="span" data-noexpand sx={{ display: 'inline-flex', color: alpha('#fff', 0.62) }}>
                  <ShareButton flat record={record} size={26} />
                </Box>
                <Typography component="span" sx={{
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.2,
                  color: alpha('#fff', 0.62),
                }}>
                  Share
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
