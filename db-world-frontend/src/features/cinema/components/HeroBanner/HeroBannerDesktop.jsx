import React, { useEffect, useMemo, useCallback, useRef } from 'react';
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

const SURFACE_BUTTON = 'rgba(20,20,20,0.66)';
const SURFACE_BUTTON_HOVER = 'rgba(28,28,28,0.86)';
const BORDER = 'rgba(255,255,255,0.10)';
const EASE = [0.22, 1, 0.36, 1];

const HeroBannerDesktop = ({
  record,
  featured,
  idx,
  ix,
  heroColor = '20,20,20',
  reducedMotion,
  onWatchlist,
  go,
  goToIndex,
  goToPlay,
  goToDetail,
  isMonitor,
  isTv,
}) => {
  const stripRef = useRef(null);
  const thumbRefs = useRef([]);

  const backdrop = useMemo(
    () =>
      tmdbImg(
        record?.backdropPath ?? record?.backdropPathText,
        'original'
      ),
    [record?.backdropPath, record?.backdropPathText]
  );

  const displayYear = year(record?.releaseDate);
  const tagLabel = record?.type === 'MOVIE' ? 'Movie' : 'TV Series';
  const logo = tmdbImg(record?.logoPath, isTv ? 'w780' : 'w500');

  const metrics = useMemo(
    () => ({
      heroHeight: isTv
        ? 'clamp(760px, 86vh, 1100px)'
        : isMonitor
          ? 'clamp(680px, 82vh, 980px)'
          : 'clamp(560px, 78vh, 860px)',

      contentLeft: isTv ? 56 : isMonitor ? 72 : 56,
      contentBottom: isTv ? 160 : isMonitor ? 140 : 120,

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

      logoMaxH: isTv ? 200 : isMonitor ? 168 : 132,

      bodySize: isTv ? '1.1rem' : isMonitor ? '1rem' : '0.95rem',
      chipSize: isTv ? '0.9rem' : '0.74rem',
      chipHeight: isTv ? 30 : 24,

      buttonHeight: isTv ? 60 : 46,
      buttonFont: isTv ? '1.06rem' : '0.95rem',
      roundBtnSize: isTv ? 54 : 42,

      navBtnSize: isTv ? 44 : 36,
      navIconSize: isTv ? 26 : 20,
      thumbW: isTv ? 132 : isMonitor ? 116 : 104,
      thumbH: isTv ? 74 : isMonitor ? 66 : 58,
    }),
    [isMonitor, isTv]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!featured || featured.length <= 1) return;

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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [featured, go]);

  const handlePrev = useCallback(() => go(-1), [go]);
  const handleNext = useCallback(() => go(1), [go]);

  // Keep the active thumbnail centred — but scroll ONLY the strip, never via
  // scrollIntoView. scrollIntoView({inline:'center'}) also scrolls the page/ancestors
  // to centre the bottom-right strip, which yanks the whole hero sideways on load.
  useEffect(() => {
    const strip = stripRef.current;
    const el = thumbRefs.current[idx];
    if (!strip || !el) return;
    const target = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [idx]);

  if (!record) return null;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: metrics.heroHeight,
        overflow: 'hidden',
        userSelect: 'none',
        bgcolor: 'transparent',
      }}
    >
      {/* ── HERO VISUAL LAYER (image + overlays) ───────────────────── */}
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={record.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reducedMotion ? 0.2 : FADE_SECS,
            ease: EASE,
          }}
          style={{
            position: 'absolute',
            inset: 0,
          }}
        >
          {/* IMPORTANT:
              Apply the bottom fade to the WHOLE visual layer, not only the image.
              This removes the seam on the left side too. */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              WebkitMaskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0.92) 70%, rgba(0,0,0,0.45) 86%, rgba(0,0,0,0.08) 94%, rgba(0,0,0,0) 100%)',
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0.92) 70%, rgba(0,0,0,0.45) 86%, rgba(0,0,0,0.08) 94%, rgba(0,0,0,0) 100%)',
            }}
          >
            {/* Backdrop */}
            {backdrop && (
              <motion.div
                key={`kb-${record.id}`}
                initial={{ scale: 1 }}
                animate={{ scale: reducedMotion ? 1 : 1.05 }}
                transition={{
                  duration: reducedMotion ? 0.2 : CYCLE_MS / 1000,
                  ease: 'linear',
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                }}
              >
                <Box
                  component="img"
                  src={backdrop}
                  alt={record.title || 'hero'}
                  loading="eager"
                  draggable={false}
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    objectFit: 'cover',
                    objectPosition: isTv ? 'center center' : 'center top',
                    filter: 'brightness(1) saturate(1.02)',
                    userSelect: 'none',
                    WebkitUserDrag: 'none',
                  }}
                />
              </motion.div>
            )}

            {/* Left readability shadow */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: isTv
                  ? `linear-gradient(
                      to right,
                      rgba(0,0,0,0.58) 0%,
                      rgba(0,0,0,0.24) 36%,
                      rgba(0,0,0,0.06) 56%,
                      transparent 78%
                    )`
                  : `linear-gradient(
                      to right,
                      rgba(0,0,0,0.54) 0%,
                      rgba(0,0,0,0.22) 38%,
                      rgba(0,0,0,0.05) 58%,
                      transparent 80%
                    )`,
              }}
            />

            {/* Image-color mood wash */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: isTv
                  ? `linear-gradient(
                      to right,
                      rgba(${heroColor}, 0.42) 0%,
                      rgba(${heroColor}, 0.22) 34%,
                      rgba(${heroColor}, 0.08) 56%,
                      transparent 80%
                    )`
                  : `linear-gradient(
                      to right,
                      rgba(${heroColor}, 0.38) 0%,
                      rgba(${heroColor}, 0.18) 38%,
                      rgba(${heroColor}, 0.06) 58%,
                      transparent 82%
                    )`,
                mixBlendMode: 'multiply',
              }}
            />

            {/* Soft glow */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: `
                  radial-gradient(
                    ellipse at 22% 76%,
                    rgba(${heroColor}, 0.24) 0%,
                    rgba(${heroColor}, 0.10) 28%,
                    transparent 60%
                  )
                `,
                mixBlendMode: 'screen',
              }}
            />
          </Box>
        </motion.div>
      </AnimatePresence>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
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
            transition={{ duration: reducedMotion ? 0.2 : 0.45, ease: EASE }}
          >
            {/* Title logo first (falls back to the text title), then the meta line */}
            {logo ? (
              <Box
                component="img"
                src={logo}
                alt={record.title}
                draggable={false}
                sx={{
                  maxWidth: '100%',
                  maxHeight: metrics.logoMaxH,
                  objectFit: 'contain',
                  objectPosition: 'left bottom',
                  display: 'block',
                  mb: isTv ? 2 : 1.5,
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.7))',
                }}
              />
            ) : (
              <Typography
                sx={{
                  fontWeight: 900,
                  color: '#fff',
                  lineHeight: 1.03,
                  mb: isTv ? 2 : 1.5,
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  letterSpacing: '-0.03em',
                  fontSize: metrics.titleSize,
                  wordBreak: 'break-word',
                  ...clampLines(isTv ? 3 : 2),
                }}
              >
                {record.title}
              </Typography>
            )}

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
                  bgcolor: record.type === 'MOVIE' ? '#ff1f1f' : '#0b84ff',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: metrics.chipSize,
                  height: metrics.chipHeight,
                }}
              />

              {displayYear && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.78)',
                    fontWeight: 600,
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
                      fontWeight: 800,
                      fontSize: isTv ? '0.95rem' : '0.8rem',
                    }}
                  >
                    {Number(record.voteAverage).toFixed(1)}
                  </Typography>
                </Box>
              )}
            </Box>

            {record.genres?.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.8,
                  mb: isTv ? 2 : 1.5,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {record.genres.slice(0, isTv ? 5 : 4).map((g, i, arr) => (
                  <React.Fragment key={g}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.74)',
                        fontSize: isTv ? '0.96rem' : '0.8rem',
                      }}
                    >
                      {g}
                    </Typography>

                    {i < arr.length - 1 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'rgba(255,255,255,0.34)',
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
                  color: 'rgba(255,255,255,0.84)',
                  mb: isTv ? 3 : 2.5,
                  lineHeight: 1.55,
                  maxWidth: isTv ? 720 : 520,
                  fontSize: metrics.bodySize,
                  textShadow: '0 2px 8px rgba(0,0,0,0.55)',
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
                  fontWeight: 800,
                  fontSize: metrics.buttonFont,
                  px: isTv ? 4.2 : 3,
                  borderRadius: 999,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)',
                    boxShadow: 'none',
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
                  bgcolor: SURFACE_BUTTON,
                  backdropFilter: 'blur(6px) saturate(1.05)',
                  WebkitBackdropFilter: 'blur(6px) saturate(1.05)',
                  border: `1px solid ${BORDER}`,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: metrics.buttonFont,
                  px: isTv ? 4.2 : 3,
                  borderRadius: 999,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: SURFACE_BUTTON_HOVER,
                    borderColor: 'rgba(255,255,255,0.20)',
                    boxShadow: 'none',
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
                title={ix?.watchlisted ? 'Remove from My List' : 'Add to My List'}
                sx={{
                  width: metrics.roundBtnSize,
                  height: metrics.roundBtnSize,
                  color: '#fff',
                  border: `2px solid ${BORDER}`,
                  bgcolor: SURFACE_BUTTON,
                  backdropFilter: 'blur(6px) saturate(1.05)',
                  WebkitBackdropFilter: 'blur(6px) saturate(1.05)',
                  transition: 'background 200ms ease, border-color 200ms ease',
                  '&:hover': {
                    borderColor: '#fff',
                    bgcolor: SURFACE_BUTTON_HOVER,
                  },
                  '&:focus-visible': {
                    outline: '3px solid #0d9488',
                    outlineOffset: 3,
                  },
                }}
              >
                {ix?.watchlisted ? (
                  <Check sx={{ fontSize: isTv ? 24 : 20 }} />
                ) : (
                  <Add sx={{ fontSize: isTv ? 24 : 20 }} />
                )}
              </IconButton>
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Slide navigator — thumbnail strip on the right (replaces the bottom
          dots + side arrows, so it doesn't take its own vertical band). */}
      {featured.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: metrics.contentBottom,
            right: metrics.contentLeft,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            maxWidth: { md: '40vw', xl: '34vw' },
          }}
        >
          <IconButton
            onClick={handlePrev}
            aria-label="Previous"
            sx={{
              flexShrink: 0,
              width: metrics.navBtnSize,
              height: metrics.navBtnSize,
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.5)',
              border: `1px solid ${BORDER}`,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.78)' },
              '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2 },
            }}
          >
            <ChevronLeft sx={{ fontSize: metrics.navIconSize }} />
          </IconButton>

          <Box
            ref={stripRef}
            sx={{
              display: 'flex',
              gap: 1,
              minWidth: 0,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              py: 0.5,
            }}
          >
            {featured.map((item, i) => {
              const active = i === idx;
              const thumb = tmdbImg(
                item.backdropPath ?? item.backdropPathText ?? item.posterPath,
                'w300'
              );
              return (
                <Box
                  key={item.id ?? i}
                  ref={(el) => { thumbRefs.current[i] = el; }}
                  onClick={() => goToIndex(i)}
                  role="button"
                  aria-label={`Go to ${item.title ?? `slide ${i + 1}`}`}
                  sx={{
                    flex: '0 0 auto',
                    width: metrics.thumbW,
                    height: metrics.thumbH,
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: `2px solid ${active ? '#fff' : 'transparent'}`,
                    opacity: active ? 1 : 0.55,
                    transition: 'opacity 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
                    '&:hover': { opacity: 1, transform: 'translateY(-2px)' },
                  }}
                >
                  {thumb && (
                    <Box
                      component="img"
                      src={thumb}
                      alt={item.title || ''}
                      loading="lazy"
                      draggable={false}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>

          <IconButton
            onClick={handleNext}
            aria-label="Next"
            sx={{
              flexShrink: 0,
              width: metrics.navBtnSize,
              height: metrics.navBtnSize,
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.5)',
              border: `1px solid ${BORDER}`,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.78)' },
              '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2 },
            }}
          >
            <ChevronRight sx={{ fontSize: metrics.navIconSize }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default HeroBannerDesktop;
