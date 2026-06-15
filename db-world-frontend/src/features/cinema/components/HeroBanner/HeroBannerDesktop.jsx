import React, { useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayArrow,
  Info,
  Add,
  Check,
  Star,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';

import {
  CYCLE_MS,
  FADE_SECS,
  year,
  ratingColor,
  clampLines,
} from './heroUtils';

const HeroBannerDesktop = ({
  record,
  featured,
  idx,
  ix,
  heroColor,
  progressKey,
  reducedMotion,
  onWatchlist,
  go,
  goToIndex,
  goToPlay,
  goToDetail,
  isMonitor,
  isTv,
}) => {
  const backdrop = tmdbImg(
    record.backdropPath ?? record.backdropPathText,
    'original'
  );

  const displayYear = year(record.releaseDate);
  const tagLabel = record.type === 'MOVIE' ? 'Movie' : 'TV Series';

  const metrics = useMemo(
    () => ({
      heroHeight: isTv
        ? 'clamp(760px, 86vh, 1100px)'
        : isMonitor
          ? 'clamp(680px, 82vh, 980px)'
          : 'clamp(560px, 78vh, 860px)',

      contentLeft: isTv ? 48 : isMonitor ? 72 : 52,
      contentBottom: isTv ? 122 : isMonitor ? 106 : 92,

      contentWidth: isTv
        ? 'min(35vw, 780px)'
        : isMonitor
          ? 'min(38vw, 680px)'
          : 'min(44vw, 560px)',

      titleSize: isTv
        ? 'clamp(3rem, 5.5vw, 7rem)'
        : isMonitor
          ? 'clamp(3rem, 4.2vw, 4.8rem)'
          : 'clamp(2.2rem, 3.4vw, 3.9rem)',

      bodySize: isTv ? '1.1rem' : isMonitor ? '1rem' : '0.95rem',
      chipSize: isTv ? '0.9rem' : '0.74rem',
      chipHeight: isTv ? 30 : 24,

      buttonHeight: isTv ? 64 : 48,
      buttonFont: isTv ? '1.08rem' : '0.96rem',
      roundBtnSize: isTv ? 56 : 44,

      arrowBtnSize: isTv ? 64 : isMonitor ? 54 : 46,
      arrowIconSize: isTv ? 36 : 28,
      sidePadding: isTv ? 48 : 20,

      indicatorBottom: isTv ? 34 : 24,
      fadeHeight: isTv ? 100 : 82,
    }),
    [isMonitor, isTv]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (featured.length <= 1) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [featured.length, go]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: metrics.heroHeight,
        overflow: 'hidden',
        bgcolor: '#0a0a0a',
        userSelect: 'none',
      }}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={record.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reducedMotion ? 0.2 : FADE_SECS,
            ease: 'easeInOut',
          }}
          style={{ position: 'absolute', inset: 0 }}
        >
          {backdrop && (
            <motion.div
              key={`kb-${record.id}`}
              initial={{ scale: 1 }}
              animate={{ scale: reducedMotion ? 1 : 1.05 }}
              transition={{
                duration: reducedMotion ? 0.2 : CYCLE_MS / 1000,
                ease: 'linear',
              }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <Box
                component="img"
                src={backdrop}
                alt={record.title}
                loading="eager"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: isTv ? 'center center' : 'center top',
                  display: 'block',
                }}
              />
            </motion.div>
          )}

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: isTv
                ? 'linear-gradient(to right, rgba(0,0,0,.9) 0%, rgba(0,0,0,.64) 42%, transparent 76%)'
                : 'linear-gradient(to right, rgba(0,0,0,.86) 0%, rgba(0,0,0,.58) 45%, transparent 76%)',
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(
                to top,
                var(--cinema-bg, #141414) 0%,
                rgba(0,0,0,.75) 12%,
                rgba(0,0,0,.4) 34%,
                transparent 64%
              )`,
            }}
          />

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at 20% 70%, rgba(${heroColor}, .18), transparent 42%)`,
              pointerEvents: 'none',
            }}
          />
        </motion.div>
      </AnimatePresence>

      <Box
        sx={{
          position: 'absolute',
          bottom: metrics.contentBottom,
          left: metrics.contentLeft,
          width: metrics.contentWidth,
          maxWidth: 'calc(100vw - 180px)',
          zIndex: 2,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={record.id}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -10 }}
            transition={{ duration: reducedMotion ? 0.2 : 0.45 }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                mb: isTv ? 2 : 1.5,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <Chip
                label={tagLabel}
                size="small"
                sx={{
                  bgcolor: record.type === 'MOVIE' ? '#e50914' : '#0080ff',
                  color: '#fff',
                  fontWeight: 750,
                  fontSize: metrics.chipSize,
                  height: metrics.chipHeight,
                }}
              />

              {displayYear && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,.76)',
                    fontWeight: 500,
                    fontSize: isTv ? '0.95rem' : '0.8rem',
                  }}
                >
                  {displayYear}
                </Typography>
              )}

              {record.voteAverage > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45 }}>
                  <Star
                    sx={{
                      fontSize: isTv ? 18 : 14,
                      color: ratingColor(record.voteAverage),
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: ratingColor(record.voteAverage),
                      fontWeight: 750,
                      fontSize: isTv ? '0.95rem' : '0.8rem',
                    }}
                  >
                    {Number(record.voteAverage).toFixed(1)}
                  </Typography>
                </Box>
              )}
            </Box>

            <Typography
              sx={{
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1.03,
                mb: isTv ? 2 : 1.5,
                textShadow: '0 2px 9px rgba(0,0,0,.7)',
                letterSpacing: '-0.03em',
                fontSize: metrics.titleSize,
                wordBreak: 'break-word',
                ...clampLines(isTv ? 3 : 2),
              }}
            >
              {record.title}
            </Typography>

            {record.genres?.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.8,
                  mb: isTv ? 2 : 1.5,
                  flexWrap: 'wrap',
                }}
              >
                {record.genres.slice(0, isTv ? 5 : 4).map((g, i) => (
                  <React.Fragment key={g}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,.68)',
                        fontSize: isTv ? '0.96rem' : '0.8rem',
                      }}
                    >
                      {g}
                    </Typography>

                    {i < Math.min(record.genres.length, isTv ? 5 : 4) - 1 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'rgba(255,255,255,.34)',
                          fontSize: isTv ? '0.96rem' : '0.8rem',
                        }}
                      >
                        ·
                      </Typography>
                    )}
                  </React.Fragment>
                ))}
              </Box>
            )}

            {record.overview && (
              <Typography
                sx={{
                  color: 'rgba(255,255,255,.82)',
                  mb: isTv ? 3 : 2.5,
                  lineHeight: 1.55,
                  maxWidth: isTv ? 720 : 520,
                  fontSize: metrics.bodySize,
                  ...clampLines(isTv ? 4 : 3),
                }}
              >
                {record.overview}
              </Typography>
            )}

            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={goToPlay}
                sx={{
                  minHeight: metrics.buttonHeight,
                  bgcolor: '#fff',
                  color: '#000',
                  fontWeight: 750,
                  fontSize: metrics.buttonFont,
                  px: isTv ? 4.2 : 3,
                  borderRadius: 2,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,.88)',
                  },
                  '&:focus-visible': {
                    outline: '3px solid #0d9488',
                    outlineOffset: 3,
                  },
                }}
              >
                Play
              </Button>

              <Button
                variant="contained"
                startIcon={<Info />}
                onClick={goToDetail}
                sx={{
                  minHeight: metrics.buttonHeight,
                  bgcolor: 'rgba(109,109,110,.72)',
                  backdropFilter: 'blur(4px)',
                  color: '#fff',
                  fontWeight: 750,
                  fontSize: metrics.buttonFont,
                  px: isTv ? 4.2 : 3,
                  borderRadius: 2,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    bgcolor: 'rgba(109,109,110,.92)',
                  },
                  '&:focus-visible': {
                    outline: '3px solid #0d9488',
                    outlineOffset: 3,
                  },
                }}
              >
                More Info
              </Button>

              <IconButton
                onClick={() => onWatchlist?.(record)}
                sx={{
                  border: '2px solid rgba(255,255,255,.58)',
                  color: '#fff',
                  width: metrics.roundBtnSize,
                  height: metrics.roundBtnSize,
                  '&:hover': {
                    borderColor: '#fff',
                    bgcolor: 'rgba(255,255,255,.1)',
                  },
                  '&:focus-visible': {
                    outline: '3px solid #0d9488',
                    outlineOffset: 3,
                  },
                }}
                title={ix.watchlisted ? 'Remove from My List' : 'Add to My List'}
              >
                {ix.watchlisted ? (
                  <Check sx={{ fontSize: isTv ? 24 : 20 }} />
                ) : (
                  <Add sx={{ fontSize: isTv ? 24 : 20 }} />
                )}
              </IconButton>
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      {featured.length > 1 && (
        <>
          <IconButton
            onClick={() => go(-1)}
            sx={{
              position: 'absolute',
              left: metrics.sidePadding,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0,0,0,.45)',
              color: '#fff',
              zIndex: 3,
              width: metrics.arrowBtnSize,
              height: metrics.arrowBtnSize,
              '&:hover': {
                bgcolor: 'rgba(0,0,0,.68)',
              },
              '&:focus-visible': {
                outline: '3px solid #0d9488',
                outlineOffset: 3,
              },
            }}
          >
            <ChevronLeft sx={{ fontSize: metrics.arrowIconSize }} />
          </IconButton>

          <IconButton
            onClick={() => go(1)}
            sx={{
              position: 'absolute',
              right: metrics.sidePadding,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0,0,0,.45)',
              color: '#fff',
              zIndex: 3,
              width: metrics.arrowBtnSize,
              height: metrics.arrowBtnSize,
              '&:hover': {
                bgcolor: 'rgba(0,0,0,.68)',
              },
              '&:focus-visible': {
                outline: '3px solid #0d9488',
                outlineOffset: 3,
              },
            }}
          >
            <ChevronRight sx={{ fontSize: metrics.arrowIconSize }} />
          </IconButton>
        </>
      )}

      {featured.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: metrics.indicatorBottom,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 0.8,
            zIndex: 3,
          }}
        >
          {featured.map((_, i) => (
            <motion.div
              key={i}
              layout
              onClick={() => goToIndex(i)}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                width: i === idx ? (isTv ? 30 : 24) : isTv ? 10 : 8,
                height: isTv ? 10 : 8,
                borderRadius: 999,
                background: i === idx ? '#0d9488' : 'rgba(255,255,255,.36)',
                cursor: 'pointer',
                opacity: i === idx ? 1 : 0.55,
              }}
            />
          ))}
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: isTv ? 4 : 3,
          zIndex: 4,
          overflow: 'hidden',
        }}
      >
        <motion.div
          key={progressKey}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            duration: CYCLE_MS / 1000,
            ease: 'linear',
          }}
          style={{
            height: '100%',
            background: '#0d9488',
            boxShadow: '0 0 8px rgba(13,148,136,.7)',
            transformOrigin: 'left',
          }}
        />
      </Box>

      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: metrics.fadeHeight,
          background:
            'linear-gradient(to bottom, transparent, var(--cinema-bg, #141414))',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </Box>
  );
};

export default HeroBannerDesktop;