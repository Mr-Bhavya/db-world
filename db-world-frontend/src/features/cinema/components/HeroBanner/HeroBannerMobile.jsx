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

  const posterSrc = tmdbImg(record.posterPathClean, 'original');
  const backdropSrc = tmdbImg(record.backdropPath ?? record.backdropPathText, 'original');
  const displayYear = year(record.releaseDate);

  const metrics = useMemo(
    () => ({
      posterWidth: isXs
        ? 'clamp(240px, 76vw, 340px)'
        : isTablet
          ? 'clamp(280px, 54vw, 400px)'
          : 'clamp(260px, 58vw, 380px)',
      actionWidth: isXs
        ? 'clamp(240px, 76vw, 340px)'
        : isTablet
          ? 'clamp(280px, 54vw, 400px)'
          : 'clamp(260px, 58vw, 380px)',
      titleSize: isXs
        ? 'clamp(1.05rem, 4.2vw, 1.22rem)'
        : 'clamp(1.15rem, 2.4vw, 1.38rem)',
      metaSize: isXs ? '0.76rem' : '0.82rem',
      genreSize: isXs ? '0.72rem' : '0.78rem',
      buttonFont: isXs
        ? 'clamp(0.95rem, 3.2vw, 1rem)'
        : 'clamp(0.98rem, 2vw, 1.05rem)',
      buttonHeight: isXs ? 50 : 54,
    }),
    [isXs, isTablet]
  );

  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartRef.current == null) return;

    const delta = e.changedTouches[0].clientX - touchStartRef.current;
    touchStartRef.current = null;

    if (Math.abs(delta) > 42) {
      go(delta < 0 ? 1 : -1);
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: 'calc(100svh - var(--mobile-header-height, 0px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pt: 'max(16px, env(safe-area-inset-top))',
        pb: 'max(24px, env(safe-area-inset-bottom))',
        px: 'max(16px, env(safe-area-inset-left))',
        overflow: 'hidden',

        /**
         * Important:
         * Same color source as mobile header/nav.
         * This removes the visible difference between nav and hero.
         */
        background: `
          linear-gradient(
            to bottom,
            rgba(${heroColor}, 1) 0%,
            rgba(${heroColor}, .96) 22%,
            rgba(${heroColor}, .78) 48%,
            var(--cinema-bg, #141414) 100%
          )
        `,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 18%, rgba(255,255,255,.08), transparent 36%)',
          pointerEvents: 'none',
        }}
      />

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={record.id}
          custom={dir}
          variants={
            reducedMotion
              ? {
                  enter: { opacity: 0 },
                  center: { opacity: 1 },
                  exit: { opacity: 0 },
                }
              : {
                  enter: (d) => ({ opacity: 0, x: d > 0 ? 48 : -48 }),
                  center: { opacity: 1, x: 0 },
                  exit: (d) => ({ opacity: 0, x: d > 0 ? -48 : 48 }),
                }
          }
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reducedMotion ? 0.2 : 0.36 }}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <Box
            onClick={goToDetail}
            sx={{
              position: 'relative',
              width: metrics.posterWidth,
              maxWidth: '100%',
              aspectRatio: '2 / 3',
              borderRadius: 3,
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1.5px solid rgba(255,255,255,.16)',
              boxShadow: `
                0 28px 72px rgba(0,0,0,.82),
                0 0 46px rgba(${heroColor}, .48)
              `,
              flexShrink: 0,
            }}
          >
            <Box
              component="img"
              src={posterSrc || backdropSrc}
              alt={record.title}
              loading="eager"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              onError={(e) => {
                if (backdropSrc && e.currentTarget.src !== backdropSrc) {
                  e.currentTarget.src = backdropSrc;
                }
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to top, rgba(0,0,0,.93) 0%, rgba(0,0,0,.62) 43%, transparent 100%)',
              }}
            />

            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                px: { xs: 1.6, sm: 2 },
                pt: 7,
                pb: 1.8,
              }}
            >
              <Typography
                sx={{
                  color: '#fff',
                  fontWeight: 850,
                  fontSize: metrics.titleSize,
                  lineHeight: 1.15,
                  textShadow: '0 1px 8px rgba(0,0,0,.88)',
                  mb: 0.8,
                  wordBreak: 'break-word',
                  ...clampLines(2),
                }}
              >
                {record.title}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  gap: 0.8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  minWidth: 0,
                }}
              >
                <Chip
                  label={record.type === 'MOVIE' ? 'Movie' : 'TV'}
                  size="small"
                  sx={{
                    bgcolor: record.type === 'MOVIE' ? '#e50914' : '#0080ff',
                    color: '#fff',
                    fontWeight: 750,
                    fontSize: '0.7rem',
                    height: 20,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />

                {displayYear && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255,255,255,.78)',
                      fontSize: metrics.metaSize,
                      lineHeight: 1.2,
                    }}
                  >
                    {displayYear}
                  </Typography>
                )}

                {record.voteAverage > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                    <Star
                      sx={{
                        fontSize: isXs ? 12 : 13,
                        color: ratingColor(record.voteAverage),
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: ratingColor(record.voteAverage),
                        fontWeight: 750,
                        fontSize: metrics.metaSize,
                        lineHeight: 1.2,
                      }}
                    >
                      {Number(record.voteAverage).toFixed(1)}
                    </Typography>
                  </Box>
                )}
              </Box>

              {record.genres?.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,.62)',
                    fontSize: metrics.genreSize,
                    mt: 0.55,
                    display: 'block',
                    lineHeight: 1.3,
                    ...clampLines(2),
                  }}
                >
                  {record.genres.slice(0, isXs ? 2 : 3).join(' · ')}
                </Typography>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              width: metrics.actionWidth,
              maxWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.1,
              mt: 2.25,
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
                borderRadius: 2,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                '& .MuiButton-startIcon svg': {
                  fontSize: '1.22em',
                },
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,.88)',
                },
              }}
            >
              Play
            </Button>

            <Button
              variant="outlined"
              startIcon={ix.watchlisted ? <Check /> : <Add />}
              onClick={(e) => {
                e.stopPropagation();
                onWatchlist?.(record);
              }}
              sx={{
                minHeight: metrics.buttonHeight,
                borderColor: 'rgba(255,255,255,.58)',
                color: '#fff',
                fontWeight: 700,
                fontSize: metrics.buttonFont,
                borderRadius: 2,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                '& .MuiButton-startIcon svg': {
                  fontSize: '1.15em',
                },
                '&:hover': {
                  borderColor: '#fff',
                  bgcolor: 'rgba(255,255,255,.09)',
                },
              }}
            >
              My List
            </Button>

            <Button
              variant="outlined"
              startIcon={<Info />}
              onClick={goToDetail}
              sx={{
                minHeight: metrics.buttonHeight,
                borderColor: 'rgba(255,255,255,.4)',
                color: 'rgba(255,255,255,.9)',
                fontWeight: 700,
                fontSize: metrics.buttonFont,
                borderRadius: 2,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                '& .MuiButton-startIcon svg': {
                  fontSize: '1.15em',
                },
                '&:hover': {
                  borderColor: '#fff',
                  bgcolor: 'rgba(255,255,255,.09)',
                },
              }}
            >
              More Info
            </Button>
          </Box>
        </motion.div>
      </AnimatePresence>

      {featured.length > 1 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.8,
            mt: 2.5,
            zIndex: 2,
          }}
        >
          {featured.map((_, i) => (
            <motion.div
              key={i}
              layout
              onClick={() => goToIndex(i)}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                width: i === idx ? 24 : 8,
                height: 8,
                borderRadius: 999,
                background: i === idx ? '#0d9488' : 'rgba(255,255,255,.36)',
                cursor: 'pointer',
                opacity: i === idx ? 1 : 0.55,
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default HeroBannerMobile;