// Mobile / tablet hero — JioHotstar-style full-bleed masthead.
//
// Layout contract (this is what keeps it safe on small, tall and large-font
// devices, so don't turn any of it back into fixed pixels):
//
//   • The frame has a MIN-height, never a height. The artwork is absolutely
//     positioned at inset:0 and the content sits in NORMAL FLOW, pushed down by
//     `margin-top:auto`. At a 2x OS font scale the frame grows and the art grows
//     with it, instead of clipping the buttons off the bottom edge.
//   • The title is an <img> (logoPath), so the largest element on screen is
//     immune to font scaling entirely. Only the text fallback scales.
//   • Text sizes are rem-based clamps so they honour the user's font setting;
//     tap targets are `em` with a 44px floor so they grow with their label.
//   • The meta line and the action row both wrap, so at large scales the round
//     buttons drop under the CTA rather than crushing it.
//   • No overview paragraph — Hotstar's masthead has none, and it is by far the
//     biggest overflow risk once the font scale climbs.

import React, { useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { PlayArrow, InfoOutlined, Add, Check, Star } from '@mui/icons-material';
import { tmdbImg } from '../../api/cinemaApi';
import {
  FADE_SECS, ratingColor, clampLines,
  useLogoTone, useAnimatedRgbVar, heroArtCandidates, buildMobileMeta,
} from './heroUtils';
import { Top10Badge } from '../Billboard/billboardParts';
import DB_APP_LOGO from '@assets/images/db-circle-icon.webp';

const EASE = [0.22, 1, 0.36, 1];
const SWIPE_PX = 42;

// Each staggered row spans the column and centres its own content, so wrapping
// a child in a reveal never changes where it sits.
const REVEAL_ROW = { width: '100%', display: 'flex', justifyContent: 'center' };

/**
 * Resolves the artwork to paint. Order comes from `heroArtCandidates` so the
 * colour extraction in HeroBanner keys off the exact same image — see the note
 * there. Phones want the portrait poster; tablets are wide enough that a
 * poster would letterbox, so they lead with the landscape backdrop.
 */
const getCardImage = (record, isXs, hasLogo) => {
  const urls = heroArtCandidates(record, { portrait: isXs, hasLogo })
    .filter(Boolean)
    .map((p) => tmdbImg(p, 'original'))
    .filter(Boolean);

  return { imageSrc: urls[0] ?? null, fallbackSrc: urls[1] ?? null };
};

/** Netflix's side action: icon stacked over a small label. */
const HeroAction = ({ icon, label, onClick }) => (
  <Box
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
    }}
    aria-label={label}
    sx={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 0.4,
      flex: '0 0 auto',
      minWidth: 60, minHeight: 48,
      cursor: 'pointer', color: '#fff',
      borderRadius: 1.5,
      transition: 'opacity 150ms ease',
      '&:active': { opacity: 0.6 },
      '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2 },
      '& svg': { fontSize: 'clamp(24px, 6.4vw, 28px)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' },
    }}
  >
    {icon}
    <Box component="span" sx={{
      fontSize: 'clamp(0.688rem, 2.9vw, 0.8rem)',
      fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap',
      color: 'rgba(255,255,255,0.92)',
      textShadow: '0 1px 5px rgba(0,0,0,0.75)',
    }}>
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
  variant = 'spotlight',
  heading = null,
  breadcrumb = null,
  breadcrumbHref = null,
  ranked = false,
}) => {
  const touchStartRef = useRef(null);

  // The artwork currently painted underneath. Held one slide behind so the
  // incoming image has something opaque to dissolve over.
  const [baseSrc, setBaseSrc] = useState(null);

  const items = useMemo(() => {
    if (Array.isArray(featured) && featured.length > 0) return featured;
    return record ? [record] : [];
  }, [featured, record]);

  const safeIdx = useMemo(() => {
    if (!items.length) return 0;
    return Math.min(Math.max(idx, 0), items.length - 1);
  }, [idx, items]);

  const activeRecord = items[safeIdx] ?? items[0] ?? null;

  // The hero dissolves into whatever the page is actually painting beneath it:
  // the per-title colour wash on Home, flat #141414 everywhere else. Note that
  // the default heroColor triple (20,20,20) IS #141414, so there is no flash
  // before the dominant colour has been extracted.
  const washRgb = variant === 'spotlight' ? heroColor : '20,20,20';

  const imageMotionSecs = reducedMotion ? 0.2 : Math.max(0.58, FADE_SECS + 0.12);

  // The scrim's gradients read `--hero-wash`, and this tweens the variable on
  // rAF. A CSS transition on a gradient background is a no-op, which is why
  // the colour used to snap.
  const scrimRef = useAnimatedRgbVar(washRgb, {
    duration: reducedMotion ? 0 : 820,
    varName: '--hero-wash',
    immediate: reducedMotion,
  });

  // Staggered reveal: the block used to appear all at once the instant the
  // slide changed, which read as a jump-cut next to the slow image dissolve.
  const contentStagger = useMemo(() => ({
    hidden: {},
    show: {
      transition: {
        delayChildren: reducedMotion ? 0 : 0.1,
        staggerChildren: reducedMotion ? 0 : 0.055,
      },
    },
  }), [reducedMotion]);

  const revealItem = useMemo(() => ({
    hidden: { opacity: 0, y: reducedMotion ? 0 : 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reducedMotion ? 0.15 : 0.5, ease: EASE },
    },
  }), [reducedMotion]);

  // Computed before the early return — hooks can't run conditionally.
  const logo = tmdbImg(activeRecord?.logoPath, 'w500');
  // Probe a DIFFERENT size than the one rendered: the analyser fetches with
  // `crossOrigin=anonymous` and the <img> without it, and pointing both at one
  // URL risks the canvas reading a cached non-CORS response and tainting.
  // A w300 logo is a few KB, and tone doesn't change with scale.
  const logoIsBlack = useLogoTone(tmdbImg(activeRecord?.logoPath, 'w300')) === 'dark';

  const handleTouchStart = (e) => { touchStartRef.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartRef.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(delta) > SWIPE_PX) go?.(delta < 0 ? 1 : -1);
  };

  if (!activeRecord || items.length === 0) return null;

  const { imageSrc, fallbackSrc } = getCardImage(activeRecord, isXs, Boolean(logo));
  const typeLabel = activeRecord?.type === 'MOVIE' ? 'Film' : 'Series';
  const metaItems = buildMobileMeta(activeRecord);
  const rating = Number(activeRecord?.voteAverage) || 0;

  // One height for all three controls so the CTA row sits on a single baseline.
  const controlH = 'max(48px, 2.9em)';
  const ctaFont = 'clamp(0.88rem, 3.9vw, 1.06rem)';
  // 12px floor — 11px meta was below the readable minimum on a phone.
  const metaFont = 'clamp(0.75rem, 3.1vw, 0.9rem)';

  return (
    <Box
      ref={scrimRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        // MIN-height, never height — see the file header.
        // Netflix/Prime give the masthead most of the fold. `vh` first as the
        // base so older Android WebViews (Capacitor uses the system WebView,
        // which can predate `svh`) still get a sane height.
        minHeight: isXs ? 'clamp(480px, 74vh, 780px)' : 'clamp(540px, 68vh, 900px)',
        '@supports (height: 1svh)': {
          minHeight: isXs ? 'clamp(480px, 74svh, 780px)' : 'clamp(540px, 68svh, 900px)',
        },
        // Reserve the floating nav's band so a 2x-scaled stack can never slide
        // up underneath it.
        pt: 'calc(56px + env(safe-area-inset-top, 0px))',
        overflow: 'hidden',
        isolation: 'isolate',
        userSelect: 'none',
      }}
    >
      {/* ── Artwork ─────────────────────────────────────────────────────────
          Two explicit layers rather than an AnimatePresence crossfade. When
          both images animate at once — old 1→0 while new 0→1 — they are each
          ~50% opaque midway, so only ~75% of the frame is covered and the page
          background shows through as a dark flash. Holding the outgoing image
          fully opaque underneath and dissolving the new one on top of it keeps
          coverage at 100% the whole way across. */}
      {imageSrc ? (
        <>
          {baseSrc && baseSrc !== imageSrc && (
            <Box
              component="img"
              src={baseSrc}
              alt=""
              aria-hidden
              draggable={false}
              sx={{
                position: 'absolute', inset: 0, zIndex: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center 22%',
                display: 'block', WebkitUserDrag: 'none',
              }}
            />
          )}

          <motion.img
            key={imageSrc}
            src={imageSrc}
            alt={activeRecord?.title || 'hero'}
            draggable={false}
            initial={{ opacity: baseSrc ? 0 : 1, scale: reducedMotion ? 1 : 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              opacity: { duration: imageMotionSecs, ease: EASE },
              // A slow settle that outlasts the fade reads as a gentle push-in
              // rather than a snap.
              scale: { duration: reducedMotion ? 0 : 1.9, ease: EASE },
            }}
            onAnimationComplete={() => setBaseSrc(imageSrc)}
            onError={(e) => {
              if (fallbackSrc && e.currentTarget.src !== fallbackSrc) e.currentTarget.src = fallbackSrc;
            }}
            style={{
              position: 'absolute', inset: 0, zIndex: 1,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center 22%',
              display: 'block', willChange: 'opacity, transform',
            }}
          />
        </>
      ) : (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'linear-gradient(150deg, rgba(var(--hero-wash, 20,20,20),0.55) 0%, #141414 100%)',
        }} />
      )}

      {/* ── Scrim ───────────────────────────────────────────────────────────
          Two stacked layers plus a short top wash. Keep it to two: alpha
          COMPOUNDS, so the previous build's wash + black ramp + radial pool
          multiplied out to ~0.96 opacity a fifth of the way up the frame and
          greyed out the whole picture. Dark, moody artwork hid that; a bright
          daylit poster showed it as a flat grey veil.

          Combined opacity now runs roughly 1.0 at the bottom edge → 0.75 at
          22% → 0.55 at 32% (the title band) → 0.17 at 52% → clear by ~65%,
          so the upper two-thirds of the artwork is untouched.
            1. the page-colour fade — full opacity at the bottom edge so the
               hero and the page below meet with no seam,
            2. a gentle black ramp for text legibility only,
            3. a short top wash so the floating nav stays readable.        */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          // Reads `--hero-wash`, which `useAnimatedRgbVar` tweens on rAF. The
          // gradient text itself never changes, so there is nothing for React
          // to re-render and nothing for CSS to (fail to) transition.
          background: `
            linear-gradient(to top,
              rgba(var(--hero-wash, 20,20,20),1) 0%,
              rgba(var(--hero-wash, 20,20,20),0.92) 12%,
              rgba(var(--hero-wash, 20,20,20),0.66) 24%,
              rgba(var(--hero-wash, 20,20,20),0.36) 38%,
              rgba(var(--hero-wash, 20,20,20),0.14) 52%,
              rgba(var(--hero-wash, 20,20,20),0) 66%),
            linear-gradient(to top,
              rgba(0,0,0,0.5) 0%,
              rgba(0,0,0,0.36) 16%,
              rgba(0,0,0,0.22) 30%,
              rgba(0,0,0,0.1) 44%,
              transparent 58%),
            linear-gradient(to bottom,
              rgba(0,0,0,0.45) 0%,
              rgba(0,0,0,0.12) 12%,
              transparent 24%)
          `,
        }}
      />

      {/* ── Breadcrumb (genre landing pages) ─────────────────────────────── */}
      {breadcrumb && (
        <Box sx={{ position: 'relative', zIndex: 3, px: { xs: 2.5, sm: 5 }, pb: 1 }}>
          <Typography component="div" sx={{
            display: 'flex', alignItems: 'center',
            fontSize: metaFont, fontWeight: 700,
            color: 'rgba(255,255,255,0.66)',
            textShadow: '0 2px 8px rgba(0,0,0,0.7)',
          }}>
            {/* The section half is the way back out of the genre. 44px tall so
                it is a real target, with negative margin so it doesn't push
                the row taller. */}
            {breadcrumbHref ? (
              <Box
                component={RouterLink}
                to={breadcrumbHref}
                sx={{
                  display: 'inline-flex', alignItems: 'center',
                  minHeight: 44, my: '-11px',
                  color: 'inherit', textDecoration: 'none',
                  '&:hover': { color: '#fff' },
                }}
              >
                {breadcrumb}
              </Box>
            ) : breadcrumb}
            <Box component="span" aria-hidden sx={{ opacity: 0.45, px: 0.5 }}>›</Box>
            <Box component="span" sx={{ color: '#fff' }}>{heading}</Box>
          </Typography>
        </Box>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────
          `mt:auto` bottom-anchors this without absolute positioning, which is
          what lets the frame grow instead of clipping. A single `gap` owns the
          vertical rhythm so every element stays on the same spacing scale. */}
      <Box sx={{ position: 'relative', zIndex: 3, mt: 'auto', px: { xs: 2.5, sm: 5 } }}>
        {/* Deliberately NOT wrapped in AnimatePresence: an exit animation would
            empty this box between slides, and once the font scale pushes the
            stack past the frame's min-height that collapse would jump the whole
            hero on every auto-advance. Re-keying replays the enter animation
            with the outgoing content still occupying its space. */}
        <motion.div
          key={`hero-content-${activeRecord?.id}`}
          variants={contentStagger}
          initial="hidden"
          animate="show"
        >
            <Box sx={{
              width: '100%', maxWidth: { xs: 560, sm: 680 }, mx: 'auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', gap: 1.15,
            }}>
              {ranked && (
                <motion.div variants={revealItem} style={REVEAL_ROW}>
                  <Top10Badge idx={safeIdx} record={activeRecord} isTv={false} />
                </motion.div>
              )}

              {/* App-logo ribbon — the DB mark where Hotstar puts the content brand */}
              <motion.div variants={revealItem} style={REVEAL_ROW}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    component="img" src={DB_APP_LOGO} alt="" draggable={false}
                    sx={{ height: 'clamp(18px, 5vw, 24px)', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }}
                  />
                  <Typography component="span" sx={{
                    fontSize: 'clamp(0.58rem, 2.7vw, 0.75rem)',
                    fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.82)',
                    textShadow: '0 2px 8px rgba(0,0,0,0.75)',
                    // Letter-spacing pads the right edge; pull it back so the
                    // wordmark reads as optically centred against the logo.
                    ml: '0.15em', mr: '-0.3em',
                  }}>
                    {typeLabel}
                  </Typography>
                </Box>
              </motion.div>

              {/* Title — image first (font-scale-proof), text only as a fallback.
                  Brand colour is preserved: `useLogoTone` measures the artwork
                  and only near-black logos get repainted white, because those
                  are the one case no scrim can rescue. Gold, red and white art
                  is left exactly as the studio drew it. */}
              <motion.div variants={revealItem} style={REVEAL_ROW}>
                {logo ? (
                  <Box
                    component="img" src={logo} alt={activeRecord?.title} draggable={false}
                    sx={{
                      maxWidth: '80%',
                      maxHeight: isXs ? 'clamp(58px, 17vh, 124px)' : 'clamp(84px, 18vh, 152px)',
                      objectFit: 'contain', objectPosition: 'center bottom', display: 'block',
                      filter: logoIsBlack
                        ? 'brightness(0) invert(1) drop-shadow(0 2px 14px rgba(0,0,0,0.7))'
                        : 'drop-shadow(0 3px 16px rgba(0,0,0,0.85))',
                    }}
                  />
                ) : (
                  <Typography sx={{
                    fontSize: 'clamp(1.3rem, 7.4vw, 2.3rem)',
                    fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.02em',
                    color: '#fff', textShadow: '0 4px 18px rgba(0,0,0,0.9)',
                    maxWidth: '94%', overflowWrap: 'anywhere',
                    ...clampLines(2),
                  }}>
                    {activeRecord?.title}
                  </Typography>
                )}
              </motion.div>

              {/* Meta — Hotstar keeps the certification inline rather than boxed */}
              <motion.div variants={revealItem} style={REVEAL_ROW}>
              <Box sx={{
                display: 'flex', flexWrap: 'wrap',
                alignItems: 'center', justifyContent: 'center',
                columnGap: 0.7, rowGap: 0.25,
                fontSize: metaFont, fontWeight: 600,
                color: 'rgba(255,255,255,0.82)',
                textShadow: '0 2px 8px rgba(0,0,0,0.7)',
                maxWidth: '100%',
              }}>
                {activeRecord?.certification && (
                  <>
                    <Box component="span" aria-label={`Rated ${activeRecord.certification}`}
                      sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.02em' }}>
                      {activeRecord.certification}
                    </Box>
                    <Box component="span" aria-hidden sx={{ opacity: 0.38 }}>•</Box>
                  </>
                )}

                {metaItems.map((it, i) => (
                  <React.Fragment key={`${it}-${i}`}>
                    {i > 0 && <Box component="span" aria-hidden sx={{ opacity: 0.38 }}>•</Box>}
                    <Box component="span">{it}</Box>
                  </React.Fragment>
                ))}

                {rating > 0 && (
                  <>
                    {metaItems.length > 0 && <Box component="span" aria-hidden sx={{ opacity: 0.38 }}>•</Box>}
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                      <Star sx={{ fontSize: '1.05em', color: ratingColor(rating) }} />
                      <Box component="span" sx={{ color: ratingColor(rating), fontWeight: 800 }}>
                        {rating.toFixed(1)}
                      </Box>
                    </Box>
                  </>
                )}
              </Box>
              </motion.div>

              {/* Actions — Netflix's three-across: two narrow icon-over-label
                  stacks flanking a single white Play pill. This is what fixes
                  the wrapping: the side items are only ~60px, and Play is the
                  flexible one, so the squeeze lands on the pill instead of
                  bumping a third control onto its own line. */}
              <motion.div variants={revealItem} style={REVEAL_ROW}>
              <Box sx={{
                display: 'flex', flexWrap: 'wrap',
                alignItems: 'center', justifyContent: 'center',
                columnGap: { xs: 1.75, sm: 3 }, rowGap: 1.25,
                width: '100%', mt: 0.6,
              }}>
                <HeroAction
                  icon={ix?.watchlisted ? <Check /> : <Add />}
                  label={ix?.watchlisted ? 'Added' : 'My List'}
                  onClick={() => onWatchlist?.(activeRecord)}
                />

                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={(e) => { e.stopPropagation(); goToPlay?.(activeRecord); }}
                  sx={{
                    flex: '1 1 auto',
                    minWidth: 124,
                    maxWidth: { xs: 200, sm: 260 },
                    minHeight: controlH,
                    px: 2.5,
                    bgcolor: '#fff', color: '#000',
                    fontWeight: 800, fontSize: ctaFont,
                    lineHeight: 1.2, whiteSpace: 'nowrap',
                    borderRadius: 1.2, textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 14px rgba(0,0,0,0.28)' },
                    '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 3 },
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
            </Box>
        </motion.div>
      </Box>

      {/* ── Dots ────────────────────────────────────────────────────────────
          Quiet 6px dots with the active one stretched into a pill. The filling
          progress bar drew the eye away from the title, which is the opposite
          of what a masthead wants. Each dot carries a 44px invisible hit area. */}
      {items.length > 1 && (
        <Box sx={{
          position: 'relative', zIndex: 3,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          px: { xs: 2.5, sm: 5 },
          pt: 0.25, pb: 'calc(4px + env(safe-area-inset-bottom, 0px))',
        }}>
          {items.map((item, i) => {
            const isActive = i === safeIdx;
            return (
              <Box
                key={item.id ?? i}
                role="button"
                tabIndex={0}
                aria-label={`Go to ${item.title ?? `slide ${i + 1}`}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => goToIndex?.(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToIndex?.(i); }
                }}
                sx={{
                  width: 30, height: 44,
                  display: 'grid', placeItems: 'center',
                  cursor: 'pointer',
                  '&:focus-visible': { outline: '2px solid #0d9488', outlineOffset: -6, borderRadius: 1 },
                }}
              >
                <Box sx={{
                  width: isActive ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: isActive ? '#14b8a6' : 'rgba(255,255,255,0.34)',
                  boxShadow: isActive ? '0 1px 6px rgba(20,184,166,0.5)' : 'none',
                  transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1), background-color 280ms ease',
                }} />
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default HeroBannerMobile;
