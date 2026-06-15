import React, { useMemo, useRef } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayArrow, Info, Add, Check, Star } from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';
import { year, ratingColor, clampLines } from './heroUtils';

const HeroBannerMobile = ({
  record,
  featured,
  idx,
  dir,
  ix,
  heroColor,
  reducedMotion,
  onWatchlist,
  go,
  goToIndex,
  goToPlay,
  goToDetail,
  isXs,
  isTablet,
}) => {
  const touchStartRef = useRef(null);

  // Prefer backdrop; fall back to poster
  const backdropSrc = tmdbImg(record.backdropPath ?? record.backdropPathText, 'original');
  const posterSrc   = tmdbImg(record.posterPathClean, 'w500');
  const imageSrc    = backdropSrc || posterSrc;

  const displayYear = year(record.releaseDate);

  const metrics = useMemo(() => ({
    heroHeight: '65svh',
    titleSize: isXs ? 'clamp(1.15rem, 5vw, 1.45rem)' : 'clamp(1.25rem, 3vw, 1.6rem)',
    metaSize:  isXs ? '0.78rem' : '0.84rem',
    btnFont:   isXs ? 'clamp(0.9rem, 3.5vw, 1rem)' : 'clamp(0.95rem, 2vw, 1.05rem)',
    btnHeight: isXs ? 46 : 50,
  }), [isXs, isTablet]);

  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartRef.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(delta) > 42) go(delta < 0 ? 1 : -1);
  };

  return (
    // Outer wrapper: heroColor bleeds into the side margins and transitions to cinema-bg below,
    // making the hero feel like part of one continuous page rather than a separate section.
    <Box sx={{
      background: `linear-gradient(to bottom, rgba(${heroColor}, 0.9) 0%, rgba(${heroColor}, 0.6) 55%, var(--cinema-bg, #141414) 100%)`,
      pb: 1.5,
    }}>
      {/* ── Hero: backdrop + gradient + content overlay ── */}
      <Box
        sx={{
          position: 'relative',
          mx: { xs: 1.5, sm: 2 },
          borderRadius: { xs: 2, sm: 3 },
          height: metrics.heroHeight,
          overflow: 'hidden',
          bgcolor: '#0a0a0a',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Backdrop image layer */}
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={record.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.15 : 0.4 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {imageSrc && (
              <Box
                component="img"
                src={imageSrc}
                alt={record.title}
                loading="eager"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  display: 'block',
                }}
                onError={(e) => {
                  if (posterSrc && e.currentTarget.src !== posterSrc)
                    e.currentTarget.src = posterSrc;
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Gradient overlays — bottom fade to cinema-bg */}
        <Box
          sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `
              linear-gradient(
                to bottom,
                rgba(0,0,0,0.18) 0%,
                rgba(0,0,0,0.12) 35%,
                rgba(0,0,0,0.55) 65%,
                var(--cinema-bg, #141414) 100%
              )
            `,
          }}
        />
        {/* Herocolor tint on sides */}
        <Box
          sx={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(ellipse at 50% 100%, rgba(${heroColor}, 0.28), transparent 70%)`,
          }}
        />

        {/* Content overlay — slides in per record */}
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={`content-${record.id}`}
            custom={dir}
            variants={reducedMotion
              ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
              : { enter: (d) => ({ opacity: 0, x: d > 0 ? 32 : -32 }), center: { opacity: 1, x: 0 }, exit: (d) => ({ opacity: 0, x: d > 0 ? -32 : 32 }) }
            }
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reducedMotion ? 0.15 : 0.28 }}
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              padding: isXs ? '0 16px 20px' : '0 24px 24px',
              zIndex: 2,
            }}
          >
            {/* Genre chips */}
            <Box sx={{ display: 'flex', gap: 0.7, mb: 0.8, flexWrap: 'wrap' }}>
              <Chip
                label={record.type === 'MOVIE' ? 'Movie' : 'TV'}
                size="small"
                sx={{
                  bgcolor: record.type === 'MOVIE' ? '#e50914' : '#0080ff',
                  color: '#fff', fontWeight: 750, fontSize: '0.68rem',
                  height: 20, '& .MuiChip-label': { px: 0.8 },
                }}
              />
              {record.genres?.slice(0, 2).map((g) => (
                <Chip
                  key={g} label={g} size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
                    fontWeight: 500, fontSize: '0.68rem',
                    height: 20, backdropFilter: 'blur(4px)',
                    '& .MuiChip-label': { px: 0.8 },
                  }}
                />
              ))}
            </Box>

            {/* Title */}
            <Typography
              sx={{
                color: '#fff', fontWeight: 870,
                fontSize: metrics.titleSize, lineHeight: 1.15,
                textShadow: '0 2px 12px rgba(0,0,0,0.85)',
                mb: 0.6, wordBreak: 'break-word',
                ...clampLines(2),
              }}
            >
              {record.title}
            </Typography>

            {/* Meta row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.4, flexWrap: 'wrap' }}>
              {displayYear && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)', fontSize: metrics.metaSize }}>
                  {displayYear}
                </Typography>
              )}
              {record.voteAverage > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  <Star sx={{ fontSize: 12, color: ratingColor(record.voteAverage) }} />
                  <Typography variant="caption" sx={{ color: ratingColor(record.voteAverage), fontWeight: 750, fontSize: metrics.metaSize }}>
                    {Number(record.voteAverage).toFixed(1)}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Buttons */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={goToPlay}
                sx={{
                  flex: 1,
                  minHeight: metrics.btnHeight,
                  bgcolor: '#fff', color: '#000', fontWeight: 750,
                  fontSize: metrics.btnFont, borderRadius: 2, textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.88)' },
                }}
              >
                Play
              </Button>

              {!ix.watched && (
                <Button
                  variant="outlined"
                  startIcon={ix.watchlisted ? <Check /> : <Add />}
                  onClick={(e) => { e.stopPropagation(); onWatchlist?.(record); }}
                  sx={{
                    minWidth: 110, minHeight: metrics.btnHeight,
                    borderColor: 'rgba(255,255,255,0.5)', color: '#fff',
                    fontWeight: 700, fontSize: metrics.btnFont,
                    borderRadius: 2, textTransform: 'none',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.09)' },
                  }}
                >
                  {ix.watchlisted ? 'Saved' : 'My List'}
                </Button>
              )}

              <Button
                variant="outlined"
                startIcon={<Info />}
                onClick={goToDetail}
                sx={{
                  minWidth: ix.watched ? undefined : 110,
                  flex: ix.watched ? 1 : undefined,
                  minHeight: metrics.btnHeight,
                  borderColor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.85)',
                  fontWeight: 700, fontSize: metrics.btnFont,
                  borderRadius: 2, textTransform: 'none',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.09)' },
                }}
              >
                Info
              </Button>
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* ── Cycle dots ── */}
      {featured.length > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.8, pt: 1.5, pb: 0.5 }}>
          {featured.map((_, i) => (
            <motion.div
              key={i}
              layout
              onClick={() => goToIndex(i)}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                width: i === idx ? 20 : 7, height: 7, borderRadius: 999,
                background: i === idx ? '#0d9488' : 'rgba(255,255,255,0.32)',
                cursor: 'pointer', opacity: i === idx ? 1 : 0.55,
              }}
            />
          ))}
        </Box>
      )}
    </Box> {/* end outer heroColor wrapper */}
  );
};

export default HeroBannerMobile;
