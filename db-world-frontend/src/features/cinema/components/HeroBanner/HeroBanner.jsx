import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Typography, Button, Chip, IconButton,
  Skeleton, useMediaQuery, useTheme,
} from '@mui/material';
import {
  PlayArrow, Info, Add, Check, Star,
  ChevronLeft, ChevronRight,
} from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';
import Constants from '@shared/constants';

const CYCLE_MS  = 80000000;
const FADE_SECS = 0.6;

// ─── helpers ─────────────────────────────────────────────────────────────────

const year = (d) => (d ? String(d).slice(0, 4) : null);

const ratingColor = (v) => {
  if (v >= 7.5) return '#4caf50';
  if (v >= 6)   return '#ff9800';
  return '#f44336';
};

/** Extract dominant colour from an image URL using Canvas. Returns [r,g,b] or null. */
async function extractDominantColor(imgUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      try {
        const SIZE = 60;
        const canvas = document.createElement('canvas');
        const scale  = SIZE / Math.max(img.width, img.height);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const bri = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (bri < 15 || bri > 240) continue; // skip near-black / near-white
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        resolve(n > 0 ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
}

/** Darken an [r,g,b] triple to a suitable background shade. */
function darken([r, g, b], factor = 0.45) {
  return `${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)}`;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

const HeroBannerSkeleton = ({ isMobile }) => (
  isMobile ? (
    // Mobile skeleton: large poster card + buttons below
    <Box sx={{ minHeight: '82svh', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: '10px', pb: 1, px: 4 }}>
      {/* Poster card skeleton */}
      <Box sx={{ position: 'relative', width: '74vw', maxWidth: 300, aspectRatio: '2/3', borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(255,255,255,.07)', width: '74vw' }}>
        <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: 'rgba(255,255,255,.07)' }} />
        {/* Bottom overlay skeleton */}
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
          <Skeleton variant="text" width="80%" height={26} sx={{ bgcolor: 'rgba(255,255,255,.12)' }} />
          <Skeleton variant="text" width="60%" height={18} sx={{ bgcolor: 'rgba(255,255,255,.08)', mt: 0.5 }} />
        </Box>
      </Box>
      {/* Button skeletons */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5 }}>
        <Skeleton variant="rounded" width={110} height={44} sx={{ bgcolor: 'rgba(255,255,255,.07)', borderRadius: 2 }} />
        <Skeleton variant="rounded" width={120} height={44} sx={{ bgcolor: 'rgba(255,255,255,.07)', borderRadius: 2 }} />
      </Box>
    </Box>
  ) : (
    <Box sx={{ position: 'relative', width: '100%', height: '85vh', bgcolor: '#0a0a0a' }}>
      <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: 'rgba(255,255,255,.05)' }} />
      <Box sx={{ position: 'absolute', bottom: 120, left: 80, width: '40%' }}>
        <Skeleton variant="text" width="40%" height={28}  sx={{ bgcolor: 'rgba(255,255,255,.1)', mb: 1 }} />
        <Skeleton variant="text" width="80%" height={72}  sx={{ bgcolor: 'rgba(255,255,255,.1)', mb: 1 }} />
        <Skeleton variant="text" width="60%" height={20}  sx={{ bgcolor: 'rgba(255,255,255,.1)', mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Skeleton variant="rounded" width={120} height={44} sx={{ bgcolor: 'rgba(255,255,255,.1)', borderRadius: 2 }} />
          <Skeleton variant="rounded" width={120} height={44} sx={{ bgcolor: 'rgba(255,255,255,.1)', borderRadius: 2 }} />
        </Box>
      </Box>
    </Box>
  )
);

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Props:
 *   records          RailRecordDto[]
 *   interactions     { [id]: dto }
 *   onWatchlist      (record) => void
 *   loading          boolean
 *   onColorExtracted (colorString) => void   — called with 'r,g,b' or null
 */
const HeroBanner = ({ records = [], interactions = {}, onWatchlist, loading, onColorExtracted }) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [idx,        setIdx]        = useState(0);
  const [dir,        setDir]        = useState(1);
  const [posterColor, setPosterColor] = useState('20,20,20'); // 'r,g,b'
  const timerRef      = useRef(null);
  const touchStartRef = useRef(null);

  const featured = records.slice(0, 8);
  const record   = featured[idx] ?? null;
  const ix       = interactions[record?.id] ?? {};

  // Auto-cycle
  const startCycle = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDir(1);
      setIdx(i => (i + 1) % Math.max(featured.length, 1));
    }, CYCLE_MS);
  }, [featured.length]);

  useEffect(() => {
    if (featured.length > 1) startCycle();
    return () => clearInterval(timerRef.current);
  }, [featured.length, startCycle]);

  const go = (d) => {
    clearInterval(timerRef.current);
    setDir(d);
    setIdx(i => (i + d + featured.length) % featured.length);
    startCycle();
  };

  // ── Extract poster dominant colour (mobile only) ──────────────────────────
  useEffect(() => {
    if (!record || !isMobile) return;
    const posterUrl = tmdbImg(record.posterPathClean ?? record.backdropPath, 'w342');
    if (!posterUrl) return;

    let cancelled = false;
    extractDominantColor(posterUrl).then(color => {
      if (cancelled) return;
      if (color) {
        const darkColor = darken(color);
        setPosterColor(darkColor);
        onColorExtracted?.(darkColor);
        // Update mobile status-bar theme-color
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'theme-color';
          document.head.appendChild(meta);
        }
        meta.content = `rgb(${darkColor})`;
      }
    });
    return () => { cancelled = true; };
  }, [record?.id, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToDetail = () => {
    if (!record) return;
    const isMovie = record.type === 'MOVIE';
    const route   = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    navigate(route.replace(':title', `${record.id}-${(record.title ?? '').replace(/\s+/g, '-').toLowerCase()}`));
  };

  const goToPlay = () => {
    if (!record) return;
    const isMovie = record.type === 'MOVIE';
    const route = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
    navigate(
      route.replace(':title', `${record.id}-${(record.title ?? '').replace(/\s+/g, '-').toLowerCase()}`),
      { state: { defaultTab: 'Watch' } }
    );
  };

  if (loading && !record) return <HeroBannerSkeleton isMobile={isMobile} />;
  if (!record)            return null;

  // ── Mobile layout: large poster with info overlaid on image ─────────────────
  if (isMobile) {
    const posterSrc   = tmdbImg(record.posterPathClean, 'original');
    const backdropSrc = tmdbImg(record.backdropPath, 'original');
    const displayYear = year(record.releaseDate);

    const handleTouchStart = (e) => {
      touchStartRef.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e) => {
      if (touchStartRef.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartRef.current;
      touchStartRef.current = null;
      if (Math.abs(delta) > 50) go(delta < 0 ? 1 : -1);
    };

    return (
      <Box
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          pt: '10px',
          pb: 4,
          position: 'relative',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={record.id}
            custom={dir}
            variants={{
              enter:  (d) => ({ opacity: 0, x: d > 0 ? 50 : -50 }),
              center: { opacity: 1, x: 0 },
              exit:   (d) => ({ opacity: 0, x: d > 0 ? -50 : 50 }),
            }}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.38 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', zIndex: 1 }}
          >
            {/* ── Poster card with overlay ── */}
            <Box
              onClick={goToDetail}
              sx={{
                position: 'relative',
                width: '74vw',
                maxWidth: 300,
                aspectRatio: '2/3',
                borderRadius: 3,
                overflow: 'hidden',
                border: '1.5px solid rgba(255,255,255,0.15)',
                boxShadow: `0 28px 72px rgba(0,0,0,0.85), 0 0 50px rgba(${posterColor},0.3)`,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {/* Poster image */}
              <Box
                component="img"
                src={posterSrc ?? backdropSrc}
                alt={record.title}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { if (backdropSrc && e.target.src !== backdropSrc) e.target.src = backdropSrc; }}
              />

              {/* Bottom gradient overlay */}
              <Box sx={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 50%, transparent 100%)',
                pt: 6, pb: 1.8, px: 1.8,
              }}>
                {/* Title */}
                <Typography sx={{
                  color: '#fff', fontWeight: 800, fontSize: '1.15rem',
                  lineHeight: 1.2, textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                  mb: 0.7,
                }}>
                  {record.title}
                </Typography>

                {/* Meta row */}
                <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip
                    label={record.type === 'MOVIE' ? 'Movie' : 'TV'}
                    size="small"
                    sx={{ bgcolor: record.type === 'MOVIE' ? '#e50914' : '#0080ff', color: '#fff', fontWeight: 700, fontSize: '0.65rem', height: 18, '& .MuiChip-label': { px: 1 } }}
                  />
                  {displayYear && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.75)', fontSize: '0.72rem' }}>
                      {displayYear}
                    </Typography>
                  )}
                  {record.voteAverage > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      <Star sx={{ fontSize: 11, color: ratingColor(record.voteAverage) }} />
                      <Typography variant="caption" sx={{ color: ratingColor(record.voteAverage), fontWeight: 700, fontSize: '0.72rem' }}>
                        {Number(record.voteAverage).toFixed(1)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Genres */}
                {record.genres?.length > 0 && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.55)', fontSize: '0.68rem', mt: 0.4, display: 'block' }}>
                    {record.genres.slice(0, 3).join(' · ')}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* ── Action buttons below poster ── */}
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2.2, alignItems: 'center' }}>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={goToPlay}
                sx={{
                  bgcolor: '#fff', color: '#000', fontWeight: 700, fontSize: '0.88rem',
                  px: 3, py: 1, borderRadius: 2, textTransform: 'none', minWidth: 105,
                  '&:hover': { bgcolor: 'rgba(255,255,255,.85)' },
                }}
              >
                Play
              </Button>
              <Button
                variant="outlined"
                startIcon={ix.watchlisted ? <Check /> : <Add />}
                onClick={(e) => { e.stopPropagation(); onWatchlist?.(record); }}
                sx={{
                  borderColor: 'rgba(255,255,255,.6)', color: '#fff',
                  fontWeight: 600, fontSize: '0.88rem',
                  px: 2.2, py: 1, borderRadius: 2, textTransform: 'none', minWidth: 110,
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.1)' },
                }}
              >
                My List
              </Button>
            </Box>
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators */}
        {featured.length > 1 && (
          <Box sx={{ display: 'flex', gap: 0.8, mt: 2.5, zIndex: 2 }}>
            {featured.map((_, i) => (
              <Box
                key={i}
                onClick={() => { clearInterval(timerRef.current); setDir(i > idx ? 1 : -1); setIdx(i); startCycle(); }}
                sx={{
                  width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                  bgcolor: i === idx ? '#fff' : 'rgba(255,255,255,.35)',
                  cursor: 'pointer', transition: 'all .3s',
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // ── Desktop layout (unchanged) ────────────────────────────────────────────
  const backdrop   = tmdbImg(record.backdropPath ?? record.backdropPathText, 'original');
  const tagLabel   = record.type === 'MOVIE' ? 'Movie' : 'TV Series';
  const displayYear = year(record.releaseDate);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: { sm: '75vh', md: '85vh' },
        overflow: 'hidden',
        bgcolor: '#0a0a0a',
        userSelect: 'none',
      }}
    >
      {/* Backdrop image */}
      <AnimatePresence mode="sync" initial={false} custom={dir}>
        <motion.div
          key={record.id}
          custom={dir}
          variants={{
            enter:  (d) => ({ opacity: 0, x: d > 0 ? 60 : -60 }),
            center: { opacity: 1, x: 0 },
            exit:   (d) => ({ opacity: 0, x: d > 0 ? -60 : 60 }),
          }}
          initial="enter" animate="center" exit="exit"
          transition={{ duration: FADE_SECS, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {backdrop && (
            <Box
              component="img"
              src={backdrop}
              alt={record.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
            />
          )}
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,.85) 0%, rgba(0,0,0,.55) 45%, transparent 75%)' }} />
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.4) 30%, transparent 60%)' }} />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 100, left: 80,
          width: '42%',
          zIndex: 2,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={record.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45 }}
          >
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip label={tagLabel} size="small" sx={{ bgcolor: 'primary.main', color: '#fff', fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
              {displayYear && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.7)', fontWeight: 500 }}>
                  {displayYear}
                </Typography>
              )}
              {record.voteAverage > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <Star sx={{ fontSize: 14, color: ratingColor(record.voteAverage) }} />
                  <Typography variant="caption" sx={{ color: ratingColor(record.voteAverage), fontWeight: 700 }}>
                    {Number(record.voteAverage).toFixed(1)}
                  </Typography>
                </Box>
              )}
            </Box>

            <Typography variant="h2" sx={{ fontWeight: 900, color: '#fff', lineHeight: 1.1, mb: 1.5, textShadow: '0 2px 8px rgba(0,0,0,.6)', letterSpacing: -0.5 }}>
              {record.title}
            </Typography>

            {record.genres?.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.8, mb: 1.5, flexWrap: 'wrap' }}>
                {record.genres.slice(0, 4).map((g, i) => (
                  <React.Fragment key={g}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.65)', fontSize: '0.78rem' }}>{g}</Typography>
                    {i < Math.min(record.genres.length, 4) - 1 && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.3)' }}>·</Typography>
                    )}
                  </React.Fragment>
                ))}
              </Box>
            )}

            {record.overview && (
              <Typography variant="body2" sx={{
                color: 'rgba(255,255,255,.78)', mb: 2.5, lineHeight: 1.6,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                maxWidth: 480, fontSize: '0.875rem',
              }}>
                {record.overview}
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="contained" startIcon={<PlayArrow />} onClick={goToPlay}
                sx={{ bgcolor: '#fff', color: '#000', fontWeight: 700, fontSize: '0.95rem', px: 3, py: 1.1, borderRadius: 2, textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }}>
                Play
              </Button>
              <Button variant="contained" startIcon={<Info />} onClick={goToDetail}
                sx={{ bgcolor: 'rgba(109,109,110,.7)', backdropFilter: 'blur(4px)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', px: 3, py: 1.1, borderRadius: 2, textTransform: 'none', '&:hover': { bgcolor: 'rgba(109,109,110,.9)' } }}>
                More Info
              </Button>
              <IconButton onClick={() => onWatchlist?.(record)}
                sx={{ border: '2px solid rgba(255,255,255,.55)', color: '#fff', width: 44, height: 44, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.1)' } }}
                title={ix.watchlisted ? 'Remove from My List' : 'Add to My List'}>
                {ix.watchlisted ? <Check sx={{ fontSize: 20 }} /> : <Add sx={{ fontSize: 20 }} />}
              </IconButton>
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Prev / Next arrows */}
      {featured.length > 1 && (
        <>
          <IconButton onClick={() => go(-1)}
            sx={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,.45)', color: '#fff', zIndex: 3, '&:hover': { bgcolor: 'rgba(0,0,0,.65)' } }}>
            <ChevronLeft />
          </IconButton>
          <IconButton onClick={() => go(1)}
            sx={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,.45)', color: '#fff', zIndex: 3, '&:hover': { bgcolor: 'rgba(0,0,0,.65)' } }}>
            <ChevronRight />
          </IconButton>
        </>
      )}

      {/* Dot indicators */}
      {featured.length > 1 && (
        <Box sx={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0.8, zIndex: 3 }}>
          {featured.map((_, i) => (
            <Box
              key={i}
              onClick={() => { clearInterval(timerRef.current); setDir(i > idx ? 1 : -1); setIdx(i); startCycle(); }}
              sx={{ width: i === idx ? 24 : 8, height: 8, borderRadius: 4, bgcolor: i === idx ? 'primary.main' : 'rgba(255,255,255,.35)', cursor: 'pointer', transition: 'all .3s' }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, transparent, var(--cinema-bg, #141414))', pointerEvents: 'none', zIndex: 2 }} />
    </Box>
  );
};

export default HeroBanner;
