// Phone / tablet hero — an AMBIENT SPOTLIGHT, on a real carousel track.
//
// WHY A TRACK AND NOT A CROSS-FADING PAIR
//
// The previous cut kept ONE card on screen and swapped it through AnimatePresence. That
// shape cannot answer a drag honestly: the neighbours did not exist, so pulling the card
// sideways revealed nothing behind it — you moved the poster and no next image followed.
// It also split one apparent motion across three owners (the dragged stage, the exiting
// card, the entering card), and every desync we chased came out of that split.
//
// So: three slides are always mounted — previous, active, next — laid out side by side
// on a track that the finger drags 1:1. The next card is simply THERE, and dragging it
// in is the same motion as watching it settle. Nothing cross-fades, nothing mounts
// mid-gesture, and the peek is not a decoration — it is the neighbour.
//
// HOW A TURN WORKS (the one subtle part)
//
// The parent owns the index. When it changes, the card that was at slot +1 is suddenly
// at slot 0, which would teleport it a full slot to the left. So on the same commit we
// push the track back by exactly one slot — cancelling the jump to the pixel — and then
// spring that offset to zero. Because the push happens in a LAYOUT effect it lands
// before paint, so there is no frame where the old and new positions disagree. A drag
// folds into this for free: its leftover offset is simply added to the push.
//
// LAYOUT CONTRACT (don't quietly undo these):
//
//   • A slide draws its own title ONLY when its artwork is textless. `heroArtCandidates`
//     can legitimately return titled art for a landscape frame, so ask `isTitledArt`
//     rather than assuming — otherwise the name prints twice.
//   • The action row lives BELOW the card, at the CARD's width. It spanned the full
//     content width once and overhung the card by 28px, which is precisely why it read
//     as page furniture instead of as this card's controls.
//   • The ambient glow is a GRADIENT keyed to `--cinema-wash`, never a blurred copy of
//     the image. A blur filter on a full-width element is re-rasterised on every scroll
//     frame; the gradient is free and rides the rAF colour tween CinemaPage already runs.
//   • NO backdrop-filter anywhere in this subtree. It re-samples the page behind it every
//     frame the hero moves, and it is the single most expensive thing you can put on a
//     scrolling mobile page.
//   • Only transform and opacity animate, so a turn never triggers layout.
//   • Every control is >=44px with >=8px between neighbours.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { animate, motion, useMotionValue } from 'framer-motion';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';

import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../api/cinemaApi';
import {
  CYCLE_MS, clampLines, heroArtCandidates, heroBadge, isTitledArt, useLogoTone,
} from './heroUtils';
import { buildMetaItems } from '../Billboard/billboardParts';
import CertBadge from '../CertBadge';
import { HERO_TOP_INSET } from '../../navbar/navMetrics';

/** Widest the spotlight card gets before it simply centres itself on a big tablet. */
export const MAX_SPOTLIGHT_W = 720;

/**
 * How much narrower than the content box the card is.
 *
 * Everything under the card matches this width, so the card, the marks and the buttons
 * share one left and one right edge. It also opens the channel the next card peeks
 * through — with the page gutter beyond it, a neighbour shows roughly 40px before the
 * outer `overflow-x: clip` cuts it at the screen edge.
 */
export const CARD_INSET = 28;

/** Visible channel between one card and the next. */
const CARD_GAP = 10;

/** Card aspect per tier. Phones get a taller crop so the hero still has presence. */
const RATIO_XS = 3 / 2;
const RATIO_SM = 16 / 9;

/** easeOutCubic, kept for the things that are still tweens (content entry, fades). */
const EASE = [0.33, 1, 0.68, 1];

/**
 * The turn is a SPRING now, not a fixed tween.
 *
 * A tween gave a flick and a lazy drag-past-threshold the identical animation, which is
 * most of what made the old carousel feel mechanical. A spring takes the gesture's own
 * velocity as its initial condition, so a hard flick arrives fast and a gentle push
 * glides — the same physics the finger was just using. Damping is set a shade above
 * critical for this stiffness, so it is quick and never wobbles.
 */
const TURN_SPRING = { type: 'spring', stiffness: 380, damping: 40, restDelta: 0.5, restSpeed: 12 };

/** Commit past roughly a quarter of a card, or on a decisive flick. */
const COMMIT_RATIO = 0.26;
const COMMIT_VELOCITY = 420;

/** A click still fires after a drag; taps inside this shadow are ignored. */
const TAP_GUARD_MS = 220;

/**
 * Reveal handlers for artwork.
 *
 * The card paints long before its title logo does, which is how a hero ends up on screen
 * with a backdrop, a rating and no name — the exact frame a screenshot catches. Both
 * images start transparent and fade, EXCEPT when the browser already has them: `complete`
 * is true on mount for anything cached, and neighbours are mounted a turn early here, so
 * a swipe shows its art instantly and only a genuinely cold image ever fades.
 */
const revealIfCached = (el) => { if (el?.complete) el.style.opacity = '1'; };
const revealOnLoad = (e) => { e.currentTarget.style.opacity = '1'; };
const FADE_IN = { opacity: 0, transition: 'opacity 240ms ease' };

/* ── the contextual badge ───────────────────────────────────────────────── */

function BadgeChip({ badge }) {
  if (!badge) return null;

  const isTop10 = badge.kind === 'top10';
  const Icon = badge.kind === 'soon' ? ScheduleRoundedIcon
    : badge.kind === 'rank' ? TrendingUpRoundedIcon
      : AutoAwesomeRoundedIcon;

  return (
    <Box sx={{
      position: 'absolute', top: 12, left: 12, zIndex: 3,
      display: 'inline-flex', alignItems: 'center', gap: 0.6,
      pl: isTop10 ? 0.5 : 0.9, pr: 1.1, py: 0.5,
      borderRadius: 999,
      // Flat plate, deliberately not a blur — see the no-backdrop-filter note up top.
      bgcolor: alpha('#000', 0.7),
      border: `1px solid ${alpha('#fff', 0.18)}`,
      maxWidth: 'calc(100% - 24px)',
    }}>
      {isTop10 ? (
        <Box sx={{
          display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 0.6,
          bgcolor: '#e50914', color: '#fff', fontWeight: 900, fontSize: '0.44rem',
          lineHeight: 1, textAlign: 'center', flexShrink: 0,
        }}>
          TOP<br />10
        </Box>
      ) : (
        <Icon sx={{ fontSize: 14, color: '#5eead4', flexShrink: 0 }} />
      )}
      <Typography component="span" sx={{
        color: '#fff', fontWeight: 800, letterSpacing: 0.2,
        fontSize: 'clamp(0.68rem, 2.9vw, 0.78rem)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {badge.label}
      </Typography>
    </Box>
  );
}

/* ── the auto-advance indicator ─────────────────────────────────────────── */

/**
 * One mark per slide; the active one fills across a cycle.
 *
 * The fill is a scaleX transform on an inner bar rather than an animated width, so it
 * runs on the compositor and costs nothing per frame. Re-keyed on `idx` so it restarts
 * from empty on every advance, and on `paused` because the parent restarts a whole cycle
 * when it resumes — a bar that carried on from halfway would be promising a turn at the
 * wrong moment.
 */
function ProgressSegments({ count, idx, paused, animated, onSelect, userPaused, onTogglePause }) {
  if (count < 2) return null;

  return (
    <Box sx={{
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // 28, not 24: the pause target is 44px and centred here, so at 24 it would reach
      // two pixels into the action row below and steal taps from More Info.
      height: 28, mt: 1,
    }}>
      <Box
        // Plain buttons in a group, NOT a tablist. `role="tab"` with no `tabpanel`
        // anywhere is invalid ARIA — a screen reader announces a tab and then finds
        // nothing it controls. The card carries `aria-roledescription="slide"` instead.
        role="group"
        aria-label="Choose a featured title"
        sx={{ display: 'flex', gap: '6px', alignItems: 'center', height: '100%' }}
      >
        {Array.from({ length: count }, (_, i) => {
          const active = i === idx;
          return (
            <Box
              key={i}
              component="button"
              type="button"
              aria-label={`Go to featured title ${i + 1} of ${count}`}
              aria-current={active ? 'true' : undefined}
              onClick={(e) => { e.stopPropagation(); onSelect?.(i); }}
              sx={{
                // A 22px mark inside a 32px box: small on screen, still a real target.
                width: 32, height: '100%', flexShrink: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                p: 0, border: 0, background: 'none',
                touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2, borderRadius: 1 },
              }}
            >
              <Box sx={{
                position: 'relative', width: 22, height: 3,
                borderRadius: 999, overflow: 'hidden',
                bgcolor: alpha('#fff', 0.24),
              }}>
                <Box
                  key={`${idx}-${paused}`}
                  sx={{
                    position: 'absolute', inset: 0,
                    bgcolor: '#fff', borderRadius: 999,
                    transformOrigin: 'left center',
                    transform: active && animated ? 'scaleX(0)' : active || i < idx ? 'scaleX(1)' : 'scaleX(0)',
                    ...(active && animated && {
                      animation: `heroSegmentFill ${CYCLE_MS}ms linear forwards`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }),
                    '@keyframes heroSegmentFill': {
                      from: { transform: 'scaleX(0)' },
                      to: { transform: 'scaleX(1)' },
                    },
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* WCAG 2.2.2. Content that advances on its own for longer than five seconds needs
          a way to stop it, and a drag that only pauses while a finger is down is not one.
          Absolutely positioned so a 44px target does not widen the row or shift the
          marks off centre. */}
      {animated && (
        <IconButton
          onClick={onTogglePause}
          aria-label={userPaused ? 'Resume auto-advance' : 'Pause auto-advance'}
          sx={{
            position: 'absolute', right: -11, top: '50%', transform: 'translateY(-50%)',
            width: 44, height: 44, color: alpha('#fff', 0.55),
            '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.08) },
            '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: -2 },
          }}
        >
          {userPaused
            ? <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />
            : <PauseRoundedIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      )}
    </Box>
  );
}

/* ── one card on the track ──────────────────────────────────────────────── */

/**
 * A single slide. Three of these are mounted at all times.
 *
 * Neighbours are drawn in full, not as placeholder slivers: a drag brings one most of
 * the way in, so whatever is cheap-looking about it would be on screen for the length of
 * the gesture. They are dimmed instead, which also keeps the active card the only thing
 * competing for attention when the track is at rest.
 */
function HeroSlide({
  item, offset, itemIndex, isXs, padX, T, artSize,
  ranked, top10, rankLabel, kenBurns, holdMotion, reducedMotion, onActivate,
}) {
  const active = offset === 0;

  const artPath = useMemo(
    () => heroArtCandidates(item, {
      portrait: false, hasLogo: Boolean(item?.logoPath), titled: false,
    }).find(Boolean),
    [item],
  );
  const art = artPath ? tmdbImg(artPath, artSize) : null;

  // The fallback can hand back titled artwork when a record has no clean backdrop. Draw
  // our own title over that and the name appears twice.
  const logo = item?.logoPath && !isTitledArt(item, artPath)
    ? tmdbImg(item.logoPath, 'w500')
    : null;
  const logoTone = useLogoTone(logo);

  const badge = useMemo(
    () => heroBadge(item, { ranked, top10, rankLabel, idx: itemIndex }),
    [item, ranked, top10, rankLabel, itemIndex],
  );
  const meta = useMemo(() => buildMetaItems(item), [item]);

  if (!item) return null;

  return (
    <Box
      sx={{
        position: 'absolute', top: 0, bottom: 0, width: '100%',
        left: offset === 0 ? 0
          : offset > 0 ? `calc(100% + ${CARD_GAP}px)`
            : `calc(-100% - ${CARD_GAP}px)`,
        borderRadius: 4,
        overflow: 'hidden',
        bgcolor: T.bg === '#000000' ? '#141414' : alpha(T.text, 0.06),
        border: `1px solid ${alpha('#fff', active ? 0.1 : 0.06)}`,
        boxShadow: active ? '0 18px 40px rgba(0,0,0,0.55)' : 'none',
        // Eased rather than switched, so the incoming card brightens as it settles
        // instead of popping the instant the index changes.
        opacity: active ? 1 : 0.5,
        transition: 'opacity 320ms ease, border-color 320ms ease',
      }}
    >
      {art ? (
        <Box
          component="img"
          // Keyed on the record, so a slide that takes new content gets a fresh element:
          // the Ken Burns below restarts, and `complete` re-runs against the cache.
          key={item.id}
          src={art}
          alt={item.title ?? ''}
          draggable={false}
          loading="eager"
          fetchPriority={active ? 'high' : 'low'}
          decoding="async"
          ref={revealIfCached}
          onLoad={revealOnLoad}
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            WebkitUserDrag: 'none', pointerEvents: 'none',
            ...FADE_IN,
            // A cycle is eight seconds of an otherwise dead frame. 6% across the whole
            // of it is slow enough that you never catch it moving and the card still
            // feels alive; it is a compositor transform on an already-clipped element,
            // so it costs nothing. Active slide only, and held when the carousel is.
            ...(active && kenBurns && {
              animation: `heroKenBurns ${CYCLE_MS}ms ease-out forwards`,
              animationPlayState: holdMotion ? 'paused' : 'running',
              '@keyframes heroKenBurns': {
                from: { transform: 'scale(1)' },
                to: { transform: 'scale(1.06)' },
              },
            }),
          }}
        />
      ) : (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: alpha(T.text, 0.3), fontWeight: 800, px: 2, textAlign: 'center',
        }}>
          {item.title}
        </Box>
      )}

      {/* TWO scrims, not one ramp. A single `to top` gradient that cleared at 56% and
          then darkened again to 0.30 at the very top is not monotonic: the artwork ended
          up with a bright band across its middle and haze above it. The badge needs a
          short plate at the top, the title a deep one at the bottom, and the middle
          should be the picture. */}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: `
          linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 16%, transparent 30%),
          linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.62) 24%, rgba(0,0,0,0.18) 46%, transparent 66%)
        `,
      }} />

      <BadgeChip badge={badge} />

      {/* Tapping the active card opens it; tapping a neighbour brings it to the middle,
          which is what a half-visible card beside the one you are reading implies. */}
      <Box
        role="button"
        tabIndex={active ? 0 : -1}
        aria-label={active ? `Open ${item.title ?? 'title'}` : `Show ${item.title ?? 'next title'}`}
        onClick={() => onActivate(offset)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(offset); }
        }}
        sx={{
          position: 'absolute', inset: 0, zIndex: 2, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          p: `${padX}px`,
          '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: -3 },
        }}
      >
        {/* The title block arrives just behind the artwork rather than welded to it.
            Keyed on the record so it replays when a slide takes new content. Transform
            and opacity only, and skipped outright under reduced motion. */}
        <Box
          component={motion.div}
          key={item.id}
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reducedMotion ? 0 : 0.14, duration: reducedMotion ? 0.2 : 0.34, ease: EASE }}
          sx={{ minWidth: 0 }}
        >
          {logo ? (
            <Box
              component="img"
              src={logo}
              alt={item.title ?? ''}
              draggable={false}
              ref={revealIfCached}
              onLoad={revealOnLoad}
              sx={{
                ...FADE_IN,
                maxWidth: '76%', maxHeight: isXs ? 62 : 84,
                objectFit: 'contain', objectPosition: 'left bottom',
                display: 'block', mb: 1,
                filter: logoTone === 'dark'
                  ? 'brightness(0) invert(1) drop-shadow(0 4px 16px rgba(0,0,0,0.8))'
                  : 'drop-shadow(0 4px 16px rgba(0,0,0,0.8))',
                WebkitUserDrag: 'none', pointerEvents: 'none',
              }}
            />
          ) : (
            <Typography sx={{
              color: '#fff', fontWeight: 900, letterSpacing: '-0.02em', mb: 0.75,
              fontSize: 'clamp(1.35rem, 6vw, 2rem)', lineHeight: 1.1,
              textShadow: '0 2px 14px rgba(0,0,0,0.85)',
              ...clampLines(2),
            }}>
              {item.title}
            </Typography>
          )}

          {/* A single quiet line, not a row of bordered pills. Over busy artwork chips
              read as clutter competing with the title; dot-separated text is the same
              information with none of the furniture, and matches the desktop billboard. */}
          <Box sx={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap',
            rowGap: 0.5, minWidth: 0,
            textShadow: '0 2px 8px rgba(0,0,0,0.75)',
          }}>
            {item.certification && (
              <CertBadge value={item.certification} sx={{ flexShrink: 0, mr: 1 }} />
            )}
            {/* The separator travels WITH the word after it, inside one flex item. As
                loose siblings the row could wrap between a dot and its word, which left
                a bullet stranded at the end of the first line. */}
            {meta.map((bit, i) => (
              <Box
                key={`${bit}-${i}`}
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
              >
                {i > 0 && (
                  <Box component="span" aria-hidden sx={{
                    color: alpha('#fff', 0.38), px: 0.75,
                    fontSize: 'clamp(0.72rem, 3vw, 0.84rem)',
                  }}>
                    •
                  </Box>
                )}
                <Typography component="span" sx={{
                  color: alpha('#fff', 0.88), fontWeight: 600,
                  fontSize: 'clamp(0.72rem, 3vw, 0.84rem)',
                }}>
                  {bit}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/* ── the hero ───────────────────────────────────────────────────────────── */

const SpotlightMobileHero = ({
  record,
  featured = [],
  idx = 0,
  dir = 1,
  ix = {},
  reducedMotion = false,
  go,
  goToIndex,
  goToDetail,
  goToPlay,
  onWatchlist,
  isXs = false,
  variant = 'spotlight',
  heading = null,
  breadcrumb = null,
  breadcrumbHref = null,
  ranked = false,
  top10 = false,
  rankLabel = null,
  onInteract,
  onInteractEnd,
}) => {
  const T = useT();
  const [dragging, setDragging] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const items = useMemo(() => {
    if (Array.isArray(featured) && featured.length > 0) return featured;
    return record ? [record] : [];
  }, [featured, record]);

  const count = items.length;
  const safeIdx = count ? ((idx % count) + count) % count : 0;
  const active = items[safeIdx] ?? record ?? null;

  /** previous, active, next — always mounted, so a drag has something to pull in. */
  const windowItems = useMemo(() => {
    if (count === 0) return [];
    if (count === 1) return [{ offset: 0, itemIndex: 0, item: items[0] }];
    return [-1, 0, 1].map((offset) => {
      const itemIndex = (((safeIdx + offset) % count) + count) % count;
      return { offset, itemIndex, item: items[itemIndex] };
    });
  }, [items, count, safeIdx]);

  const trackX = useMotionValue(0);
  const trackRef = useRef(null);

  /**
   * One slot is a card plus the channel beside it — the exact distance a turn travels.
   * Measured rather than derived: the card is a percentage of a container that is itself
   * responsive, and the drag constraints and the turn have to agree with it to the pixel.
   */
  const [slot, setSlot] = useState(0);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const measure = () => setSlot(el.offsetWidth + CARD_GAP);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A click still fires after a drag, so taps landing in its shadow are ignored. A
  // timestamp rather than the `dragging` flag: that flag is already false by the time
  // the synthetic click arrives.
  const dragEndedAt = useRef(0);
  // Captured at drag end, consumed by the turn effect below.
  const released = useRef(null);
  const prevIdx = useRef(safeIdx);

  /**
   * THE TURN.
   *
   * By the time this runs the parent has already moved the index, so the card that was
   * at slot +1 is now at slot 0 and would have teleported a full slot left. Pushing the
   * track back by one slot cancels that exactly; springing the push to zero is the
   * animation. A layout effect because it has to land before paint — a frame where the
   * push has not happened yet is a frame where the card is in the wrong place.
   *
   * A drag folds in for free: whatever offset the finger left is simply added to the
   * push, so the card carries on from where it was let go rather than restarting.
   */
  useLayoutEffect(() => {
    if (prevIdx.current === safeIdx) return;
    const travelled = dir >= 0 ? 1 : -1;
    prevIdx.current = safeIdx;
    if (!slot) return;

    const r = released.current;
    released.current = null;
    trackX.set((r ? r.from : 0) + slot * travelled);

    if (reducedMotion) { trackX.set(0); return; }
    animate(trackX, 0, { ...TURN_SPRING, velocity: r ? r.velocity : 0 });
  }, [safeIdx, dir, slot, trackX, reducedMotion]);

  const handleDragStart = useCallback(() => {
    setDragging(true);
    onInteract?.();
  }, [onInteract]);

  const handleDragEnd = useCallback((_e, info) => {
    setDragging(false);
    dragEndedAt.current = Date.now();
    // Resuming here would restart a carousel the user explicitly stopped.
    if (!userPaused) onInteractEnd?.();
    if (count < 2 || !slot) return;

    const { offset: o, velocity: v } = info;
    const far = Math.abs(o.x) > slot * COMMIT_RATIO;
    const fast = Math.abs(v.x) > COMMIT_VELOCITY;
    if (!far && !fast) {
      // Not decisive: settle back to centre on the same spring, carrying the same
      // velocity, so an abandoned swipe feels like the same object as a committed one.
      if (!reducedMotion) animate(trackX, 0, { ...TURN_SPRING, velocity: v.x });
      else trackX.set(0);
      return;
    }

    const forward = (far ? o.x < 0 : v.x < 0);
    // Hand the gesture's own state to the turn effect. It cannot animate from here:
    // `go` only asks the parent to move, and the slides do not shift until that commits.
    released.current = { from: trackX.get(), velocity: v.x };
    go?.(forward ? 1 : -1);
  }, [count, slot, go, onInteractEnd, reducedMotion, trackX, userPaused]);

  const togglePause = useCallback(() => {
    const next = !userPaused;
    setUserPaused(next);
    if (next) onInteract?.(); else onInteractEnd?.();
  }, [userPaused, onInteract, onInteractEnd]);

  /**
   * Both `go` and `goToIndex` call the parent's startCycle, so a swipe or a mark tap
   * while paused would quietly restart the clock. Re-clear it after any slide change
   * that happens in the paused state.
   */
  useEffect(() => {
    if (userPaused) onInteract?.();
  }, [userPaused, safeIdx, onInteract]);

  const handleActivate = useCallback((offset) => {
    if (Date.now() - dragEndedAt.current < TAP_GUARD_MS) return;
    if (offset === 0) goToDetail?.();
    else go?.(offset > 0 ? 1 : -1);
  }, [goToDetail, go]);

  const handlePlay = useCallback(() => goToPlay?.(active), [goToPlay, active]);
  const handleWatchlist = useCallback(() => onWatchlist?.(active), [onWatchlist, active]);
  const handleInfo = useCallback(() => goToDetail?.(), [goToDetail]);

  if (!active) return null;

  const ratio = isXs ? RATIO_XS : RATIO_SM;
  const gutter = isXs ? 16 : 24;
  // One number for the card's inner padding, shared by every slide.
  const padX = isXs ? 14 : 20;
  const artSize = isXs ? 'w780' : 'w1280';
  const animated = count > 1 && !reducedMotion;
  const kenBurns = !reducedMotion;
  const holdMotion = dragging || userPaused;

  // Flat plates, not blurs. The desktop billboard's secondary buttons use
  // backdrop-filter; this subtree cannot — see the layout contract.
  const secondaryAction = {
    width: 48, height: 48, flexShrink: 0,
    borderRadius: 2,
    color: '#fff',
    bgcolor: alpha('#fff', 0.12),
    border: `1px solid ${alpha('#fff', 0.2)}`,
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    '&:hover': { bgcolor: alpha('#fff', 0.2), borderColor: alpha('#fff', 0.34) },
    '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2 },
  };

  return (
    <Box
      sx={{
        position: 'relative',
        // `clip`, not `hidden`: this is what cuts the peeking neighbours at the screen
        // edge, and it lets the card's shadow fade down into the first rail instead of
        // being sliced off flat at the frame edge.
        overflowX: 'clip',
        pt: HERO_TOP_INSET,
        pb: 2.5,
        px: `${gutter}px`,
        userSelect: 'none',
      }}
    >
      {(breadcrumb || (variant !== 'spotlight' && heading)) && (
        <Box sx={{ position: 'relative', zIndex: 1, pb: 1.5 }}>
          <Typography component="div" sx={{
            display: 'flex', alignItems: 'center',
            fontSize: 'clamp(0.78rem, 3.2vw, 0.92rem)', fontWeight: 700,
            color: alpha(T.text, 0.62),
          }}>
            {breadcrumb ? (
              <>
                {breadcrumbHref ? (
                  <Box
                    component={RouterLink}
                    to={breadcrumbHref}
                    sx={{
                      display: 'inline-flex', alignItems: 'center',
                      minHeight: 44, my: '-11px',
                      color: 'inherit', textDecoration: 'none',
                      '&:hover': { color: T.text },
                    }}
                  >
                    {breadcrumb}
                  </Box>
                ) : breadcrumb}
                <Box component="span" aria-hidden sx={{ opacity: 0.45, px: 0.5 }}>›</Box>
              </>
            ) : null}
            <Box component="span" sx={{ color: T.text }}>{heading}</Box>
          </Typography>
        </Box>
      )}

      <Box sx={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: MAX_SPOTLIGHT_W, mx: 'auto',
      }}>
        {/* The ambient bleed. Sits BEHIND the card and reaches past it on every side, so
            the artwork reads as the light source for the top of the page. Keyed to
            `--cinema-wash`, which CinemaPage already tweens frame by frame, so this
            glides between titles without this component re-rendering at all. */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: '-12%', right: '-12%', top: '-6%', bottom: '-18%',
            zIndex: 0, pointerEvents: 'none',
            background: `radial-gradient(
              ellipse 78% 66% at 50% 42%,
              rgba(var(--cinema-wash, 20,20,20), 0.62) 0%,
              rgba(var(--cinema-wash, 20,20,20), 0.26) 46%,
              transparent 72%
            )`,
          }}
        />

        {/* CARD-ALIGNED COLUMN. The indicator and the action row used to span the full
            content width while the card was narrower, so the buttons overhung the card's
            right edge by 28px — measured, that is why the row read as page furniture
            rather than as this card's controls. One column at the card's own width puts
            Play's left edge on the card's left edge and the last button's right edge on
            the card's right edge. */}
        <Box sx={{ position: 'relative', width: `calc(100% - ${CARD_INSET}px)` }}>
          {/* THE TRACK. Exactly one card wide; the neighbours hang off either side and
              are cut at the screen edge by the outer clip. Drag is 1:1 — there is a real
              card under the finger on both sides, so resistance would only be a lie. */}
          <Box
            component={motion.div}
            ref={trackRef}
            drag={count > 1 ? 'x' : false}
            dragDirectionLock
            dragConstraints={{ left: -slot, right: slot }}
            dragElastic={0.08}
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            style={{ x: trackX, touchAction: 'pan-y' }}
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: `${ratio}`,
              cursor: count > 1 ? 'grab' : 'pointer',
              '&:active': { cursor: count > 1 ? 'grabbing' : 'pointer' },
            }}
          >
            {windowItems.map(({ offset, item, itemIndex }) => (
              <HeroSlide
                // Keyed by SLOT, not by record: the three positions are fixed and their
                // contents rotate through them, so keying by slot lets React swap the
                // content in place instead of tearing down and rebuilding a card that is
                // about to be on screen. The pieces that must restart per record — the
                // artwork element and the title block — carry their own record key.
                key={offset}
                item={item}
                offset={offset}
                itemIndex={itemIndex}
                isXs={isXs}
                padX={padX}
                T={T}
                artSize={artSize}
                ranked={ranked}
                top10={top10}
                rankLabel={rankLabel}
                kenBurns={kenBurns}
                holdMotion={holdMotion}
                reducedMotion={reducedMotion}
                onActivate={handleActivate}
              />
            ))}
          </Box>

          <ProgressSegments
            count={count}
            idx={safeIdx}
            paused={dragging || userPaused}
            animated={animated}
            onSelect={goToIndex}
            userPaused={userPaused}
            onTogglePause={togglePause}
          />

          {/* The action row this whole shape exists for. Outside the track, so a tap
              here can never be mistaken for the tail of a swipe. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Button
              onClick={handlePlay}
              startIcon={<PlayArrowRoundedIcon sx={{ fontSize: '1.6rem' }} />}
              sx={{
                flex: 1, minWidth: 0, minHeight: 48,
                bgcolor: '#fff', color: '#000',
                fontWeight: 800, fontSize: '0.95rem', textTransform: 'none',
                borderRadius: 999, boxShadow: 'none',
                '&:hover': { bgcolor: alpha('#fff', 0.88), boxShadow: 'none' },
                '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 3 },
              }}
            >
              Play
            </Button>

            <IconButton
              onClick={handleWatchlist}
              aria-label={ix?.watchlisted ? 'Remove from My List' : 'Add to My List'}
              sx={secondaryAction}
            >
              {ix?.watchlisted
                ? <CheckRoundedIcon sx={{ fontSize: 22 }} />
                : <AddRoundedIcon sx={{ fontSize: 22 }} />}
            </IconButton>

            <IconButton
              onClick={handleInfo}
              aria-label={`More info about ${active.title ?? 'this title'}`}
              sx={secondaryAction}
            >
              <InfoOutlinedIcon sx={{ fontSize: 21 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Memoised for the same reason the deck was: HeroBanner runs a CYCLE_MS interval and
 * CinemaPage re-renders around it as rails resolve, and none of that should re-render
 * the artwork.
 */
export default React.memo(SpotlightMobileHero);
