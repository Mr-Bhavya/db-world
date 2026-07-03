import React, { useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayArrow,
  InfoOutlined,
  Add,
  Check,
  Star,
} from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';
import {
  FADE_SECS,
  year,
  ratingColor,
  clampLines,
} from './heroUtils';

const safeText = (value, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const getOverview = (record) =>
  safeText(
    record?.overview ||
    record?.description ||
    record?.summary ||
    record?.plot ||
    record?.tagline,
    ''
  );

const getCardImage = (record, isXs) => {
  const backdropSrc = tmdbImg(
    record?.backdropPath ?? record?.backdropPathText,
    'original'
  );
  const posterSrc = tmdbImg(
    record?.posterPathClean ?? record?.posterPath,
    'original'
  );

  return {
    backdropSrc,
    posterSrc,
    // Phones: portrait poster fills the card. Tablets: landscape backdrop.
    imageSrc: isXs ? (posterSrc || backdropSrc) : (backdropSrc || posterSrc),
  };
};

const EASE = [0.22, 1, 0.36, 1];

const BORDER = 'rgba(255,255,255,0.10)';

// Stacked icon-over-label action (My List / Info). px-based label so a large
// system font can't blow the row apart.
const HeroAction = ({ icon, label, onClick }) => (
  <Box
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
    }}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.35,
      minWidth: 52,
      cursor: 'pointer',
      color: '#fff',
      '& svg': { fontSize: 25, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' },
    }}
  >
    {icon}
    <Box
      component="span"
      sx={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.92)',
        textShadow: '0 1px 5px rgba(0,0,0,0.7)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  </Box>
);

const HeroBannerMobile = ({
  record,
  featured = [],
  idx = 0,
  ix = {},
  heroColor = '20,20,20',
  reducedMotion = false,
  onWatchlist,
  go,
  goToIndex,
  goToPlay,
  goToDetail,
  isXs = false,
}) => {
  const touchStartRef = useRef(null);

  const items = useMemo(() => {
    if (Array.isArray(featured) && featured.length > 0) return featured;
    return record ? [record] : [];
  }, [featured, record]);

  const safeIdx = useMemo(() => {
    if (!items.length) return 0;
    if (idx < 0) return 0;
    if (idx >= items.length) return items.length - 1;
    return idx;
  }, [idx, items]);

  const activeRecord = items[safeIdx] ?? items[0] ?? null;

  const imageMotionSecs = reducedMotion ? 0.2 : Math.max(0.58, FADE_SECS + 0.12);
  const contentMotionSecs = reducedMotion ? 0.18 : 0.4;

  const metrics = useMemo(
    () => ({
      // Fixed card height so the hero doesn't resize when swiping between titles
      // (different images/logos no longer change the card size). Portrait-ish so
      // the poster never looks square.
      cardHeight: isXs ? '76svh' : '68svh',
      cardRadius: isXs ? 18 : 22,
      titleSize: isXs
        ? 'clamp(1.35rem, 6.2vw, 1.85rem)'
        : 'clamp(1.7rem, 4vw, 2.4rem)',
      btnHeight: isXs ? 44 : 48,
      btnFont: isXs ? '0.95rem' : '1rem',
    }),
    [isXs]
  );

  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartRef.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(delta) > 42) {
      go?.(delta < 0 ? 1 : -1);
    }
  };

  if (!activeRecord || items.length === 0) return null;

  const displayYear = year(activeRecord?.releaseDate);
  const overview = getOverview(activeRecord);
  const { imageSrc, posterSrc, backdropSrc } = getCardImage(activeRecord, isXs);
  const genreLine = (activeRecord?.genres ?? []).slice(0, 3).join('  •  ');
  const logo = tmdbImg(activeRecord?.logoPath, 'w500');

  return (
    <Box
      sx={{ px: { xs: 1.5, sm: 2 }, pt: { xs: 1, sm: 1.5 }, pb: { xs: 1.5, sm: 2 } }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Contained hero card (fixed height — no resize on swipe) ─── */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: metrics.cardHeight,
          borderRadius: `${metrics.cardRadius}px`,
          overflow: 'hidden',
          border: `1px solid ${BORDER}`,
          boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
          bgcolor: `rgba(${heroColor}, 1)`,
        }}
      >
        {/* Image (absolute background, crossfades on change) */}
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={`hero-visual-${activeRecord?.id}`}
            initial={{ opacity: 0.5, scale: reducedMotion ? 1 : 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.5, scale: reducedMotion ? 1 : 1.01 }}
            transition={{ duration: imageMotionSecs, ease: EASE }}
            style={{ position: 'absolute', inset: 0, willChange: 'opacity, transform' }}
          >
            {imageSrc ? (
              <Box
                component="img"
                src={imageSrc}
                alt={activeRecord?.title || 'hero'}
                loading="eager"
                draggable={false}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                }}
                onError={(e) => {
                  const fallback = posterSrc || backdropSrc;
                  if (fallback && e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
              />
            ) : (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(135deg, rgba(${heroColor},0.35) 0%, rgba(20,20,20,1) 100%)`,
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Readability scrim — strong at the bottom, clear over the showcase.
            Gradient is % of card height, so it tracks the card as it grows. */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 1,
            background:
              'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.62) 20%, rgba(0,0,0,0.2) 46%, transparent 70%)',
          }}
        />

        {/* Content — overlaid at the bottom of the fixed-height card */}
        <Box
          sx={{
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            zIndex: 2,
            px: { xs: 2, sm: 2.5 },
            pb: { xs: 1.75, sm: 2 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <motion.div
            key={`hero-content-${activeRecord?.id}`}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: contentMotionSecs, ease: EASE }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {/* Title logo (falls back to text title) */}
            {logo ? (
              <Box
                component="img"
                src={logo}
                alt={activeRecord?.title}
                draggable={false}
                sx={{
                  maxWidth: '82%',
                  maxHeight: isXs ? 100 : 124,
                  objectFit: 'contain',
                  objectPosition: 'center bottom',
                  mb: 0.85,
                  filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.85))',
                }}
              />
            ) : (
              <Typography
                sx={{
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: metrics.titleSize,
                  lineHeight: 1.08,
                  letterSpacing: '-0.02em',
                  textShadow: '0 4px 18px rgba(0,0,0,0.92)',
                  mb: 0.85,
                  maxWidth: 560,
                  ...clampLines(2),
                }}
              >
                {activeRecord?.title}
              </Typography>
            )}

            {/* Meta — wraps if the font is large */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 0.9,
                rowGap: 0.5,
                mb: overview ? 1.1 : 1.4,
              }}
            >
              <Box
                component="span"
                sx={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  color: '#fff',
                  bgcolor: activeRecord?.type === 'MOVIE' ? '#ff1f1f' : '#0b84ff',
                  borderRadius: 0.6,
                  px: 0.7, py: 0.25,
                  textTransform: 'uppercase',
                  lineHeight: 1.4,
                }}
              >
                {activeRecord?.type === 'MOVIE' ? 'Movie' : 'TV'}
              </Box>

              {activeRecord?.voteAverage > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  <Star sx={{ fontSize: 14, color: ratingColor(activeRecord.voteAverage) }} />
                  <Box
                    component="span"
                    sx={{
                      color: ratingColor(activeRecord.voteAverage),
                      fontWeight: 800,
                      fontSize: '12px',
                      textShadow: '0 1px 5px rgba(0,0,0,0.7)',
                    }}
                  >
                    {Number(activeRecord.voteAverage).toFixed(1)}
                  </Box>
                </Box>
              )}

              {displayYear && (
                <Box
                  component="span"
                  sx={{
                    color: 'rgba(255,255,255,0.82)',
                    fontWeight: 600,
                    fontSize: '12px',
                    textShadow: '0 1px 5px rgba(0,0,0,0.7)',
                  }}
                >
                  {displayYear}
                </Box>
              )}

              {genreLine && (
                <Box
                  component="span"
                  sx={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    textShadow: '0 1px 5px rgba(0,0,0,0.7)',
                    maxWidth: '100%',
                    ...clampLines(1),
                  }}
                >
                  {genreLine}
                </Box>
              )}
            </Box>

            {/* Actions — My List | Play | Info (wraps under large fonts) */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 2.25,
                rowGap: 1.25,
                width: '100%',
              }}
            >
              {!ix?.watched && (
                <HeroAction
                  icon={ix?.watchlisted ? <Check /> : <Add />}
                  label="My List"
                  onClick={() => onWatchlist?.(activeRecord)}
                />
              )}

              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={(e) => { e.stopPropagation(); goToPlay?.(activeRecord); }}
                sx={{
                  flex: '0 1 auto',
                  minWidth: 120,
                  maxWidth: 220,
                  minHeight: metrics.btnHeight,
                  px: 3,
                  bgcolor: '#fff',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: metrics.btnFont,
                  borderRadius: 1,
                  textTransform: 'none',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.92)', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' },
                }}
              >
                Play
              </Button>

              <HeroAction
                icon={<InfoOutlined />}
                label="Info"
                onClick={() => goToDetail?.(activeRecord)}
              />
            </Box>
          </motion.div>

          {/* Dots */}
          {items.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 0.7, mt: 1.6 }}>
              {items.map((_, i) => {
                const active = i === safeIdx;
                return (
                  <motion.div
                    key={i}
                    layout
                    onClick={() => goToIndex?.(i)}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    style={{
                      width: active ? 22 : 7,
                      height: 7,
                      borderRadius: 999,
                      background: active
                        ? 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)'
                        : 'rgba(255,255,255,0.42)',
                      cursor: 'pointer',
                      boxShadow: active ? '0 2px 10px rgba(13,148,136,0.45)' : 'none',
                    }}
                    role="button"
                    aria-label={`Go to slide ${i + 1}`}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default HeroBannerMobile;
