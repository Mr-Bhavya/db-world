import React, {
  useMemo,
  useRef,
  useEffect,
} from 'react';
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

const getSeasonOrRuntime = (record) => {
  if (record?.type === 'TV' || record?.type === 'TV_SHOW') {
    const seasons = record?.numberOfSeasons ?? record?.seasons;
    if (seasons) return `${seasons} Season${seasons > 1 ? 's' : ''}`;
  }

  const runtime = record?.runtimeMinutes ?? record?.runtime;
  if (runtime) return `${runtime} min`;

  return '';
};

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
    imageSrc: isXs ? (posterSrc || backdropSrc) : (backdropSrc || posterSrc),
  };
};

const EASE = [0.22, 1, 0.36, 1];

const PAGE_BG = 'var(--cinema-bg, #141414)';
const SURFACE_PANEL = 'rgba(20,20,20,0.78)';
const SURFACE_CHIP = 'rgba(20,20,20,0.72)';
const SURFACE_BUTTON = 'rgba(20,20,20,0.68)';
const SURFACE_BUTTON_HOVER = 'rgba(28,28,28,0.84)';
const BORDER = 'rgba(255,255,255,0.10)';
const BORDER_SOFT = 'rgba(255,255,255,0.08)';

const HeroBannerMobile = ({
  record,
  featured = [],
  idx = 0,
  dir = 1,
  ix = {},
  heroColor = '20,20,20',
  reducedMotion = false,
  onWatchlist,
  go,
  goToIndex,
  goToPlay,
  goToDetail,
  isXs = false,
  isTablet = false,
}) => {
  const touchStartRef = useRef(null);
  const thumbRefs = useRef([]);

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
  const infoAsIconOnly = isXs;

  // Slower than before for smoother image changes
  const imageMotionSecs = reducedMotion ? 0.2 : Math.max(0.58, FADE_SECS + 0.12);
  const contentMotionSecs = reducedMotion ? 0.18 : 0.4;

  const metrics = useMemo(
    () => ({
      heroHeight: isXs ? '68svh' : isTablet ? '62svh' : '65svh',
      titleSize: isXs
        ? 'clamp(1.18rem, 5.2vw, 1.5rem)'
        : 'clamp(1.36rem, 2.6vw, 1.92rem)',
      metaSize: isXs ? '0.78rem' : '0.88rem',
      descSize: isXs ? '0.84rem' : '0.95rem',
      btnFont: isXs ? 'clamp(0.88rem, 3.4vw, 1rem)' : '0.98rem',
      btnHeight: isXs ? 46 : 50,
      panelRadius: isXs ? 18 : 22,
      panelPaddingX: isXs ? 1.25 : 1.7,
      panelPaddingY: isXs ? 1.1 : 1.3,
      cardRadius: isXs ? 20 : 26,
      stripCardWidth: isXs ? 116 : 138,
      stripCardHeight: isXs ? 68 : 80,
    }),
    [isXs, isTablet]
  );

  useEffect(() => {
    const activeEl = thumbRefs.current[safeIdx];
    if (activeEl?.scrollIntoView) {
      activeEl.scrollIntoView({
        block: 'nearest',
        inline: 'center',
        behavior: 'smooth',
      });
    }
  }, [safeIdx]);

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
  const extraMeta = getSeasonOrRuntime(activeRecord);
  const { imageSrc, posterSrc, backdropSrc } = getCardImage(activeRecord, isXs);

  return (
    <Box
      sx={{
        position: 'relative',
        pb: 2.1,
        background: 'transparent',
      }}
    >
      <Box
        sx={{ px: { xs: 1.5, sm: 2 } }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Main Hero Card ───────────────────────────────────────── */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: metrics.heroHeight,
            borderRadius: `${metrics.cardRadius}px`,
            overflow: 'hidden',
            bgcolor: PAGE_BG,
            boxShadow: '0 20px 46px rgba(0,0,0,0.20)',
          }}
        >
          <AnimatePresence mode="sync" initial={false}>
            {/* Visual layer */}
            <motion.div
              key={`hero-visual-${activeRecord?.id}`}
              initial={{ opacity: 0.48, scale: reducedMotion ? 1 : 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.62, scale: reducedMotion ? 1 : 1.005 }}
              transition={{
                duration: imageMotionSecs,
                ease: EASE,
              }}
              style={{
                position: 'absolute',
                inset: 0,
                willChange: 'opacity, transform',
              }}
            >
              {/* Fade the WHOLE visual layer into the page beneath */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  WebkitMaskImage:
                    'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 56%, rgba(0,0,0,0.94) 70%, rgba(0,0,0,0.50) 86%, rgba(0,0,0,0.10) 94%, rgba(0,0,0,0) 100%)',
                  maskImage:
                    'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 56%, rgba(0,0,0,0.94) 70%, rgba(0,0,0,0.50) 86%, rgba(0,0,0,0.10) 94%, rgba(0,0,0,0) 100%)',
                }}
              >
                {/* Image */}
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
                      display: 'block',
                      objectFit: 'cover',
                      objectPosition: isXs ? 'center top' : 'center center',
                      filter: 'brightness(1) saturate(1.02)',
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
                      background: `linear-gradient(
                        135deg,
                        rgba(${heroColor},0.24) 0%,
                        rgba(20,20,20,1) 100%
                      )`,
                    }}
                  />
                )}

                {/* Unified shading */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                      linear-gradient(
                        to bottom,
                        rgba(0,0,0,0.10) 0%,
                        rgba(0,0,0,0.04) 18%,
                        rgba(0,0,0,0.08) 42%,
                        rgba(0,0,0,0.24) 72%,
                        rgba(0,0,0,0.46) 100%
                      )
                    `,
                  }}
                />

                {/* Subtle cinematic glow */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                      radial-gradient(
                        ellipse at 50% 100%,
                        rgba(${heroColor}, 0.06) 0%,
                        rgba(${heroColor}, 0.02) 26%,
                        transparent 70%
                      )
                    `,
                    mixBlendMode: 'screen',
                  }}
                />

                {/* Reading assist on tablet */}
                {!isXs && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: `
                        linear-gradient(
                          to right,
                          rgba(0,0,0,0.18) 0%,
                          rgba(0,0,0,0.06) 28%,
                          rgba(0,0,0,0.01) 56%,
                          transparent 82%
                        )
                      `,
                    }}
                  />
                )}
              </Box>
            </motion.div>

            {/* Content layer */}
            <motion.div
              key={`hero-content-${activeRecord?.id}`}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
              transition={{
                duration: contentMotionSecs,
                ease: EASE,
              }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 3,
                padding: isXs ? '0 14px 14px' : '0 18px 18px',
                pointerEvents: 'none',
              }}
            >
              <Box
                sx={{
                  borderRadius: `${metrics.panelRadius}px`,
                  px: metrics.panelPaddingX,
                  py: metrics.panelPaddingY,
                  pointerEvents: 'auto',
                  overflow: 'hidden',
                  position: 'relative',
                  border: `1px solid ${BORDER}`,
                  boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
                  background: SURFACE_PANEL, // no blur now
                }}
              >
                {/* Badges */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.7,
                    mb: 0.9,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <Chip
                    label={activeRecord?.type === 'MOVIE' ? 'Movie' : 'TV'}
                    size="small"
                    sx={{
                      bgcolor: activeRecord?.type === 'MOVIE' ? '#ff1f1f' : '#0b84ff',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.68rem',
                      height: 22,
                      '& .MuiChip-label': { px: 0.95 },
                    }}
                  />

                  {activeRecord?.genres?.slice(0, isXs ? 2 : 3).map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      size="small"
                      sx={{
                        bgcolor: SURFACE_CHIP,
                        color: 'rgba(255,255,255,0.88)',
                        fontWeight: 600,
                        fontSize: '0.68rem',
                        height: 22,
                        '& .MuiChip-label': { px: 0.95 },
                      }}
                    />
                  ))}
                </Box>

                {/* Title */}
                <Typography
                  sx={{
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: metrics.titleSize,
                    lineHeight: 1.08,
                    letterSpacing: '-0.02em',
                    textShadow: '0 4px 16px rgba(0,0,0,0.90)',
                    mb: 0.65,
                    wordBreak: 'break-word',
                    position: 'relative',
                    zIndex: 1,
                    ...clampLines(2),
                  }}
                >
                  {activeRecord?.title}
                </Typography>

                {/* Meta */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: overview ? 0.9 : 1.2,
                    flexWrap: 'wrap',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {displayYear && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.76)',
                        fontSize: metrics.metaSize,
                        fontWeight: 600,
                      }}
                    >
                      {displayYear}
                    </Typography>
                  )}

                  {activeRecord?.voteAverage > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                      <Star
                        sx={{
                          fontSize: 13,
                          color: ratingColor(activeRecord.voteAverage),
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color: ratingColor(activeRecord.voteAverage),
                          fontWeight: 800,
                          fontSize: metrics.metaSize,
                        }}
                      >
                        {Number(activeRecord.voteAverage).toFixed(1)}
                      </Typography>
                    </Box>
                  )}

                  {extraMeta && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.74)',
                        fontSize: metrics.metaSize,
                        fontWeight: 600,
                      }}
                    >
                      {extraMeta}
                    </Typography>
                  )}
                </Box>

                {/* Overview */}
                {overview && (
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,0.84)',
                      fontSize: metrics.descSize,
                      lineHeight: 1.42,
                      mb: 1.35,
                      textShadow: '0 2px 8px rgba(0,0,0,0.58)',
                      position: 'relative',
                      zIndex: 1,
                      ...clampLines(isXs ? 2 : 3),
                    }}
                  >
                    {overview}
                  </Typography>
                )}

                {/* Actions */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'stretch',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPlay?.(activeRecord);
                    }}
                    sx={{
                      flex: 1.2,
                      minWidth: 0,
                      minHeight: metrics.btnHeight,
                      bgcolor: '#fff',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: metrics.btnFont,
                      borderRadius: 2.4,
                      textTransform: 'none',
                      boxShadow: 'none',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.92)',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    Play
                  </Button>

                  {!ix?.watched && (
                    <Button
                      variant="outlined"
                      startIcon={ix?.watchlisted ? <Check /> : <Add />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatchlist?.(activeRecord);
                      }}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: metrics.btnHeight,
                        borderColor: BORDER,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: metrics.btnFont,
                        borderRadius: 2.4,
                        textTransform: 'none',
                        bgcolor: SURFACE_BUTTON,
                        '&:hover': {
                          borderColor: '#fff',
                          bgcolor: SURFACE_BUTTON_HOVER,
                        },
                      }}
                    >
                      {ix?.watchlisted ? 'Saved' : 'My List'}
                    </Button>
                  )}

                  {infoAsIconOnly ? (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        goToDetail?.(activeRecord);
                      }}
                      sx={{
                        minWidth: metrics.btnHeight,
                        width: metrics.btnHeight,
                        height: metrics.btnHeight,
                        borderRadius: 2.4,
                        color: '#fff',
                        border: `1px solid ${BORDER}`,
                        bgcolor: SURFACE_BUTTON,
                        flexShrink: 0,
                        '&:hover': {
                          borderColor: '#fff',
                          bgcolor: SURFACE_BUTTON_HOVER,
                        },
                      }}
                    >
                      <InfoOutlined />
                    </IconButton>
                  ) : (
                    <Button
                      variant="outlined"
                      startIcon={<InfoOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        goToDetail?.(activeRecord);
                      }}
                      sx={{
                        flex: 0.9,
                        minWidth: 0,
                        minHeight: metrics.btnHeight,
                        borderColor: BORDER,
                        color: 'rgba(255,255,255,0.92)',
                        fontWeight: 700,
                        fontSize: metrics.btnFont,
                        borderRadius: 2.4,
                        textTransform: 'none',
                        bgcolor: SURFACE_BUTTON,
                        '&:hover': {
                          borderColor: '#fff',
                          bgcolor: SURFACE_BUTTON_HOVER,
                        },
                      }}
                    >
                      Info
                    </Button>
                  )}
                </Box>
              </Box>
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* ── Preview strip below hero ─────────────────────────────── */}
        {items.length > 1 && (
          <Box sx={{ pt: 1.2 }}>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                overflowX: 'auto',
                px: 0.2,
                pb: 0.35,
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {items.map((item, i) => {
                const active = i === safeIdx;
                const thumbSrc =
                  tmdbImg(item?.backdropPath ?? item?.backdropPathText, 'w300') ||
                  tmdbImg(item?.posterPathClean ?? item?.posterPath, 'w300');

                return (
                  <Box
                    key={item?.id ?? i}
                    ref={(el) => { thumbRefs.current[i] = el; }}
                    onClick={() => goToIndex?.(i)}
                    sx={{
                      flex: '0 0 auto',
                      width: metrics.stripCardWidth,
                      minWidth: metrics.stripCardWidth,
                      height: metrics.stripCardHeight,
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      border: active
                        ? '2px solid rgba(13,148,136,0.95)'
                        : `1px solid ${BORDER_SOFT}`,
                      // boxShadow: active
                      //   ? '0 8px 18px rgba(13,148,136,0.20)'
                      //   : '0 8px 16px rgba(0,0,0,0.14)',
                      transform: active ? 'scale(1)' : 'scale(0.985)',
                      transition:
                        'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                      bgcolor: PAGE_BG,
                    }}
                  >
                    {thumbSrc ? (
                      <Box
                        component="img"
                        src={thumbSrc}
                        alt={item?.title || 'preview'}
                        loading="lazy"
                        draggable={false}
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'block',
                          objectFit: 'cover',
                          objectPosition: 'center center',
                          filter: 'brightness(0.98) saturate(1.0)',
                          userSelect: 'none',
                          WebkitUserDrag: 'none',
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: '100%',
                          background: `linear-gradient(
                            135deg,
                            rgba(${heroColor},0.22) 0%,
                            rgba(20,20,20,1) 100%
                          )`,
                        }}
                      />
                    )}

                    {/* Same overlay for all previews -> less color difference */}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.36) 0%, rgba(0,0,0,0.08) 58%, transparent 100%)',
                      }}
                    />

                    <Box
                      sx={{
                        position: 'absolute',
                        left: 8,
                        right: 8,
                        bottom: 6,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#fff',
                          fontWeight: 700,
                          display: 'block',
                          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                          ...clampLines(1),
                        }}
                      >
                        {item?.title}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Indicators */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 0.75,
                pt: 1.05,
                pb: 0.1,
                px: 1.5,
              }}
            >
              {items.map((_, i) => {
                const active = i === safeIdx;

                return (
                  <motion.div
                    key={i}
                    layout
                    onClick={() => goToIndex?.(i)}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    style={{
                      width: active ? 24 : 7,
                      height: 7,
                      borderRadius: 999,
                      background: active
                        ? 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)'
                        : 'rgba(255,255,255,0.32)',
                      cursor: 'pointer',
                      opacity: active ? 1 : 0.58,
                      boxShadow: active ? '0 4px 12px rgba(13,148,136,0.35)' : 'none',
                    }}
                    aria-label={`Go to slide ${i + 1}`}
                    role="button"
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default HeroBannerMobile;

