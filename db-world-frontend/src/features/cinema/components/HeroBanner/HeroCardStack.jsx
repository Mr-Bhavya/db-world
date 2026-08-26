// Phone / tablet hero — a card DECK, JioHotstar's current shape.
//
// WHY A DECK AND NOT A RAIL
//
// The first cut of this was a horizontal track: all five cards side by side, translated
// left as the index advanced. That has two problems this shape doesn't:
//
//   1. It can never loop. From the last card a forward swipe has to slide the whole track
//      back across four cards to reach the first, which reads as a glitch rather than a
//      turn. A deck only ever renders the top few cards, indexed modulo the list, so
//      last → first is the same single step as any other.
//   2. A track is wider than the screen BY DESIGN, so any gap in the clipping — a long
//      title, an unclipped ancestor — hands the whole page a horizontal scrollbar. A deck
//      is never wider than its own card.
//
// It also reads the way it should: the next card sits BEHIND the current one and a swipe
// takes the top card away, like turning a page.
//
// LAYOUT CONTRACT (don't quietly undo these):
//
//   • NO TITLE IS DRAWN over a poster that already has one. A TMDB poster carries its own
//     title art, so a title overlay prints the name twice (the record-detail hero learned
//     this the hard way). The card draws a title ONLY when the artwork we ended up with is
//     the textless poster or a backdrop, where there is nothing to duplicate.
//   • The meta line sits on the artwork over a SHORT scrim (the lower third, mostly
//     transparent). A full-height gradient would veil the poster's own title art, which
//     is the one thing the card exists to show.
//   • The card's width and height are EXPLICIT pixels from one measurement. Percentage
//     widths plus `aspect-ratio` ought to give identical cards and in practice did not;
//     sizes came out visibly uneven. One computed number for all of them makes that
//     impossible, whatever flex or the image's intrinsic size wants.
//   • Only LAYERS cards are mounted — the rest would be stacked transforms and image
//     downloads nobody can see.
//   • Every control is >=44px with >=8px between neighbours.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AddRoundedIcon from '@mui/icons-material/Add';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';

import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../api/cinemaApi';
import { buildMobileMeta, heroArtCandidates, heroBadge } from './heroUtils';
import CertBadge from '../CertBadge';

/** Cards mounted at once: the one you're looking at, plus the two behind it. */
const LAYERS = 3;

/** How far each card behind the top one is offset to the right, in px. */
const OFFSET_XS = 22;
const OFFSET_SM = 26;

/** Room kept to the right of the top card for the deck to peek into. */
export const PEEK_ROOM = 38;

/**
 * And room on the LEFT for the card already turned past.
 *
 * Without it the top card sat flush against the frame's left edge, so the card behind
 * it had only the screen's own margin to show in — a sliver squeezed against the bezel
 * and clipped by the page. This gives it somewhere to actually be.
 */
export const LEFT_ROOM = 26;

/** Posters are 2:3. A number, because the card's height is computed rather than declared. */
const POSTER_RATIO = 3 / 2;

/** Widest the card gets before the deck simply centres itself on a big tablet. */
export const MAX_CARD_W = 420;

/** Each step back in the deck shrinks and dims the card by this much. */
const SCALE_STEP = 0.055;
const DIM_STEP = 0.22;

/* ── the badge chip ─────────────────────────────────────────────────────────
   Self-contained: its own blurred plate, because there is no scrim on the card
   for it to sit on. */

function BadgeChip({ badge }) {
  if (!badge) return null;

  const isTop10 = badge.kind === 'top10';
  const Icon = badge.kind === 'soon' ? ScheduleRoundedIcon
    : badge.kind === 'rank' ? TrendingUpRoundedIcon
      : AutoAwesomeRoundedIcon;

  return (
    <Box sx={{
      position: 'absolute', top: 12, left: 12, zIndex: 2,
      display: 'inline-flex', alignItems: 'center', gap: 0.6,
      pl: isTop10 ? 0.5 : 0.9, pr: 1.1, py: 0.5,
      borderRadius: 999,
      // Flat plate, NOT backdrop-filter. Blur here is re-rasterised every frame the deck
      // moves, and there are up to twenty of these across the mounted cards — it was the
      // bulk of the swipe jank on Android. A more opaque black reads the same over artwork.
      bgcolor: alpha('#000', 0.7),
      border: `1px solid ${alpha('#fff', 0.18)}`,
      maxWidth: 'calc(100% - 24px)',
    }}>
      {/* The red TOP 10 mark is Netflix's own thing and belongs ONLY to a real top-10
          rail. A trending or popular rail gets a plain ranked chip naming that rail,
          which is the truth about why this title is here. */}
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

/* ── the two round actions ──────────────────────────────────────────────────
   Play is a solid light disc (legible on any artwork without a scrim); My List is
   glass. Both stop propagation so they never also open the detail page, and both
   swallow pointerdown so pressing one can't start a drag. */

function RoundAction({ label, onClick, children, primary = false, size }) {
  return (
    <Box
      component={motion.button}
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      sx={{
        width: size, height: size, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        borderRadius: '50%', cursor: 'pointer',
        bgcolor: primary ? alpha('#fff', 0.94) : alpha('#000', 0.62),
        color: primary ? '#111' : '#fff',
        border: `1px solid ${primary ? alpha('#fff', 0.9) : alpha('#fff', 0.34)}`,
        boxShadow: primary ? '0 8px 22px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.4)',
        transition: 'background-color .16s',
        '&:hover': { bgcolor: primary ? '#fff' : alpha('#000', 0.66) },
        '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 2 },
      }}
    >
      {children}
    </Box>
  );
}

/* ── one card in the deck ───────────────────────────────────────────────────── */

function DeckCard({
  record, badge, front, inList, isXs, cardW, cardH,
  onOpen, onPlay, onWatchlist,
}) {
  const T = useT();

  // The poster WITH its title art — see the `titled` note in heroArtCandidates. The
  // colour extraction in HeroBanner keys off the same call, so the page wash always
  // matches the card on screen.
  //
  // Which candidate actually won matters: the card draws no title of its own BECAUSE the
  // poster carries one. When we fall back to the textless poster (or a backdrop) that
  // stops being true, and the card would otherwise be nameless.
  const art = useMemo(() => {
    const path = heroArtCandidates(record, { portrait: true, hasLogo: false, titled: true })
      .find(Boolean);
    return {
      // w780 into a ~300px-wide phone card is 2.6x oversampled: three of them to decode,
      // hold in texture memory and rescale on every frame of a swipe.
      src: path ? tmdbImg(path, isXs ? 'w500' : 'w780') : null,
      hasBakedTitle: Boolean(path) && path === record?.posterPath,
    };
  }, [record, isXs]);

  const { src, hasBakedTitle } = art;
  const meta = buildMobileMeta(record);
  // ONE size for both. Play was deliberately larger to mark it as primary, but two
  // circles at two sizes side by side just read as inconsistent — the difference in FILL
  // (solid white vs glass) carries the hierarchy on its own.
  const actionSize = isXs ? 50 : 54;

  return (
    <Box
      role="button"
      tabIndex={front ? 0 : -1}
      aria-hidden={!front}
      aria-label={record?.title ?? 'Open title'}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); }
      }}
      sx={{
        position: 'relative',
        width: cardW || '100%',
        // A computed pixel height, NOT `aspect-ratio`: every card in the deck is passed
        // the same number, so they cannot come out uneven. It still works out to the
        // poster's own 2:3, so the artwork is never cropped.
        height: cardH || undefined,
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: T.bg === '#000000' ? '#141414' : alpha(T.text, 0.06),
        border: `1px solid ${alpha('#fff', 0.08)}`,
        boxShadow: front ? '0 22px 48px rgba(0,0,0,0.55)' : '0 12px 28px rgba(0,0,0,0.45)',
        '&:focus-visible': { outline: '3px solid #0d9488', outlineOffset: 3 },
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={record?.title ?? ''}
          draggable={false}
          // The cards behind are two swipes away at most, so they are fetched now but at
          // low priority. Left lazy, the decode landed in the middle of the turn that
          // promoted them — a stall exactly when the deck is moving. `async` decoding
          // keeps that work off the main thread either way.
          loading="eager"
          fetchPriority={front ? 'high' : 'low'}
          decoding="async"
          sx={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            WebkitUserDrag: 'none', pointerEvents: 'none',
          }}
        />
      ) : (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: alpha(T.text, 0.3), fontWeight: 800, px: 2, textAlign: 'center',
        }}>
          {record?.title}
        </Box>
      )}

      <BadgeChip badge={badge} />

      {/* A SHORT scrim — the lower third, and nearly transparent until the last of it.
          The meta sits on the artwork now, which needs something behind it to be legible,
          but a poster's own title art usually runs along that lower edge and a full-height
          gradient would veil the thing the card exists to show. */}
      <Box aria-hidden sx={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', zIndex: 1,
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 34%, rgba(0,0,0,0) 100%)',
      }} />

      {/* Bottom-left, sharing the band with the buttons in the corner — as the reference
          does. It keeps out of their column (72px) and wraps to a second line rather than
          truncating, which is what "2026 · Drama · 1 Se…" was doing before the card got
          its extra width. */}
      <Box sx={{
        position: 'absolute', left: 14, right: 72, bottom: 14, zIndex: 2,
        minWidth: 0,
      }}>
        {/* Only when the artwork has no title baked in — otherwise this prints the name
            twice, which is the whole reason nothing is drawn over the poster. */}
        {!hasBakedTitle && (
          <Typography sx={{
            color: '#fff', fontWeight: 800, letterSpacing: -0.2, mb: 0.6,
            fontSize: 'clamp(1rem, 4.4vw, 1.24rem)', lineHeight: 1.2,
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {record?.title}
          </Typography>
        )}

        {/* CHIPS, not a dot-separated sentence.
            As running text ("2026 · Drama · Comedy · 1 Season") this read as a caption
            someone forgot to style, and each fact was hard to pick out at a glance. As
            small glass pills it reads as a designed row, matches the genre chips on the
            record detail hero, and wraps cleanly instead of ellipsing a fact away. */}
        {/* NO maxHeight clamp here. A 56px cap looked like it just limited the row to two
            lines, but a chip is ~24px and the cert badge ~26px, so two rows plus the gap
            came to ~57px — the cap shaved a hairline off the bottom row and took its
            border with it. There is nothing to clamp anyway: buildMobileMeta returns at
            most four items, so this is five chips at the very worst. */}
        <Box sx={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          gap: 0.6, minWidth: 0,
        }}>
          {record?.certification && (
            <CertBadge value={record.certification} sx={{ flexShrink: 0 }} />
          )}
          {meta.map((bit) => (
            <Box
              key={bit}
              component="span"
              sx={{
                px: 0.85, py: 0.3, borderRadius: 1,
                bgcolor: alpha('#000', 0.58),   // see BadgeChip: no blur on a moving card
                border: `1px solid ${alpha('#fff', 0.2)}`,
                color: '#fff', fontWeight: 700, lineHeight: 1.5,
                fontSize: 'clamp(0.66rem, 2.8vw, 0.76rem)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {bit}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Only on the card in focus. A card behind showing its own pair read as two live
          heroes competing, and on the peek they were clipped in half besides.

          Mounted rather than faded: hiding them with opacity still cost two shadowed
          discs of layout and paint on every card behind, for something never visible. */}
      {front && (
        <Box sx={{
          position: 'absolute', right: 12, bottom: 14, zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25,
        }}>
          {onWatchlist && (
            <RoundAction
              label={inList ? `Remove ${record?.title ?? ''} from My List` : `Add ${record?.title ?? ''} to My List`}
              onClick={onWatchlist}
              size={actionSize}
            >
              {inList ? <CheckRoundedIcon sx={{ fontSize: 22 }} /> : <AddRoundedIcon sx={{ fontSize: 24 }} />}
            </RoundAction>
          )}
          <RoundAction label={`Play ${record?.title ?? ''}`} onClick={onPlay} primary size={actionSize}>
            <PlayArrowRoundedIcon sx={{ fontSize: 30 }} />
          </RoundAction>
        </Box>
      )}
    </Box>
  );
}

/* ── the deck ───────────────────────────────────────────────────────────────── */

const HeroCardStack = ({
  record,
  featured = [],
  idx = 0,
  dir = 1,
  ix = {},
  interactions = {},
  reducedMotion = false,
  onWatchlist,
  go,
  goToPlay,
  goToDetail,
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
  const frameRef = useRef(null);
  const dragEndedAt = useRef(0);
  const [frameW, setFrameW] = useState(0);

  const items = useMemo(() => {
    if (Array.isArray(featured) && featured.length > 0) return featured;
    return record ? [record] : [];
  }, [featured, record]);

  const count = items.length;
  const safeIdx = count ? ((idx % count) + count) % count : 0;

  // Trimmed from 20: every px here is a px the poster and its meta line don't get.
  const gutter = isXs ? 14 : 20;
  const offset = isXs ? OFFSET_XS : OFFSET_SM;

  // useLayoutEffect, not useEffect: this runs before the browser paints, so the very
  // first frame already has real pixel sizes instead of a collapsed deck.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    setFrameW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setFrameW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ONE measurement, every size derived from it. The frame is measured at full width on
  // the first pass and then sizes itself to the card, so this reads the width it needs
  // before it constrains itself.
  const cardW = Math.max(0, Math.min(frameW - PEEK_ROOM - LEFT_ROOM, MAX_CARD_W));
  const cardH = Math.round(cardW * POSTER_RATIO);
  const measured = cardW > 0;

  // No wash of its own: CinemaPage paints the per-title colour across the top of the page
  // and this sits on it. Two layers of tint is what made the hero's frame read as a
  // different shade from the rails in an earlier round.

  // Raises the left card above the deck while it is being pulled in. Declared here
  // rather than with the rest of the lift state below because slot() names it in its
  // dependency array, and a dep array is evaluated the moment useCallback is called.
  const [pullingBack, setPullingBack] = useState(false);

  /**
   * Resting transform for the card k steps back in the deck.
   *
   * `rotate: 0` is NOT redundant. The page-turn variants below tilt the card, and framer
   * only animates the properties an `animate` target actually names — omit rotate here
   * and a card that entered with a tilt keeps it forever. That was the "images are
   * sometimes tilted" bug, and it is exactly the kind that survives a re-render.
   */
  const slot = useCallback((k) => {
    // k === -1 is the card already turned past: parked off to the left with only its
    // edge showing, mirroring the room the deck keeps on the right. It is a REAL layer,
    // not a preview — a forward turn slides the top card into it and a backward turn
    // brings it back out, so neither transition mounts or unmounts anything.
    //
    // It sits under the deck at rest, and is raised only while being pulled back in;
    // otherwise its edge would paint over the front card's corner.
    if (k === -1) {
      return {
        x: -(cardW - offset),
        rotate: 0,
        scale: 1,
        opacity: 1,
        zIndex: pullingBack ? LAYERS + 1 : 0,
      };
    }
    return {
      x: k * offset,
      rotate: 0,
      scale: 1 - k * SCALE_STEP,
      opacity: Math.max(0, 1 - k * DIM_STEP),
      zIndex: LAYERS - k,
    };
  }, [offset, cardW, pullingBack]);

  /**
   * Enter and exit, direction-aware. Forward, the top card leaves to the left like a
   * turned page and a new one appears at the back of the deck; backward, that plays in
   * reverse. `AnimatePresence custom` is what carries the direction to a card that is
   * already unmounting — its own props are a render behind by then.
   */
  const variants = useMemo(() => ({
    // Only the far ends mount and unmount now: the deck's own front-to-left transition
    // is one element moving between two slots. Backward, a card fades in at the left
    // slot; forward, one fades in at the back. Their opposites fade out the same way.
    enter: (d) => (d < 0
      ? { ...slot(-1), opacity: 0 }
      : { ...slot(LAYERS), opacity: 0 }),
    exit: (d) => (d < 0
      ? { ...slot(LAYERS), opacity: 0 }
      : { x: -cardW * 1.15, rotate: -5, opacity: 0, zIndex: LAYERS + 1 }),
  }), [cardW, slot]);

  /**
   * Deck motion. A tween, deliberately not a spring: a spring settles by oscillating
   * around its target, and even a barely-underdamped one puts a wobble on the end of
   * every turn. easeOutQuint decelerates hard into place and never passes it.
   *
   * Memoised — a fresh object per render rebuilds every callback holding it.
   */
  const springTo = useMemo(() => (reducedMotion
    ? { duration: 0.16 }
    : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }), [reducedMotion]);

  // A decisive flick or a fifth of a card of travel turns the page.
  const threshold = Math.min(96, Math.max(48, cardW * 0.22));

  /* ── pulling the left-hand card back in ───────────────────────────────────
   *
   * The card lives in the deck at slot -1; this is only the finger's contribution to
   * where it sits, applied on a wrapper INSIDE each card so it composes with the slot
   * transform rather than fighting it.
   *
   * That composition is what makes the commit seamless. On release both animate to
   * their targets on the same curve, so their sum runs smoothly from wherever the
   * finger left the card to slot 0 — no handoff between two elements, and therefore
   * nothing that can paint out of step.
   */
  const liftX = useMotionValue(0);
  // Which card the finger is carrying. Held by id, not by slot: a card that commits a
  // backward turn becomes slot 0 mid-animation and must keep its offset until it lands.
  const [liftFor, setLiftFor] = useState(null);
  const peekTravel = Math.max(threshold, cardW * 0.5);

  const settleLift = useCallback((done) => {
    animate(liftX, 0, springTo).then(() => {
      setLiftFor(null);
      setPullingBack(false);
      done?.();
    });
  }, [liftX, springTo]);

  /**
   * Warm the posters about to enter the deck, from either end.
   *
   * Only a few cards are mounted, so the one arriving at the BACK on a forward turn has
   * never been rendered and its poster has never been fetched: it mounts empty and
   * fills in a beat later, at the deck's right edge where it shows. Fetching now costs
   * nothing — it is the next thing the deck will need either way.
   */
  useEffect(() => {
    if (count < 2 || typeof Image === 'undefined') return;
    [(safeIdx + LAYERS) % count, (safeIdx - 2 + count * 2) % count].forEach((i) => {
      const path = heroArtCandidates(items[i], { portrait: true, hasLogo: false, titled: true })
        .find(Boolean);
      if (!path) return;
      const img = new Image();
      img.src = tmdbImg(path, isXs ? 'w500' : 'w780');
    });
  }, [safeIdx, count, items, isXs]);

  const handleDrag = useCallback((_e, info) => {
    if (count < 2) return;
    const dx = info.offset.x;
    if (dx >= 0) {
      // Coming in: mapped over half a card width, so it stays roughly with the finger
      // instead of racing ahead of it.
      const p = Math.min(1, dx / peekTravel);
      liftX.set((cardW - offset) * p);
    } else {
      // Going forward: drift it further out at a fraction of the finger, so the deck
      // reads as continuous that way too rather than the top card leaving over nothing.
      liftX.set(dx * 0.25);
    }
  }, [count, peekTravel, cardW, offset, liftX]);

  const handleDragEnd = useCallback((_e, info) => {
    dragEndedAt.current = Date.now();
    onInteractEnd?.();
    if (count < 2) { settleLift(); return; }
    const { offset: o, velocity: v } = info;

    // Both directions wrap, because the index is taken modulo the list.
    if (o.x < -threshold || v.x < -450) { go?.(1); settleLift(); return; }

    if (o.x > threshold || v.x > 450) {
      // Turn NOW and let the lift settle alongside it. The card is one element moving
      // from slot -1 to slot 0 while its lift returns to zero on the same curve; the
      // two compose into a single unbroken travel from under the finger into place.
      go?.(-1);
      settleLift();
      return;
    }

    // Not decisive — let it fall back to its edge.
    settleLift();
  }, [count, go, onInteractEnd, settleLift, threshold]);

  if (!count) return null;

  // The top card plus the two behind it, wrapped — which is what makes the deck endless
  // in both directions without a long slide from the last card back to the first.
  //
  // Plus, once you have turned at least one card, the one you turned PAST, parked at
  // slot -1. Nothing sits there on the first card: there is no card behind you yet, and
  // an edge showing there would claim otherwise. It needs more cards than the deck
  // mounts, or slot -1 and the last slot would resolve to the same record and collide
  // on key.
  const showLeft = count > LAYERS && safeIdx > 0;
  const deck = Array.from({ length: Math.min(LAYERS, count) }, (_, k) => ({
    k,
    item: items[(safeIdx + k) % count],
  }));
  if (showLeft) deck.unshift({ k: -1, item: items[(safeIdx - 1 + count) % count] });

  return (
    <Box
      sx={{
        position: 'relative',
        // `overflow-x: clip`, NOT `overflow: hidden`.
        //
        // This is what was drawing a hard line between the hero and the first rail. The
        // front card's shadow reaches ~70px below it (0 22px 48px) and the frame only has
        // 24px of padding, so `hidden` sliced the shadow off flat at the frame's edge:
        // darkened above the cut, plain page below it. Chased as a colour-wash problem for
        // three rounds; it was the shadow all along.
        //
        // `clip` still stops any horizontal overflow reaching the page, but — unlike
        // `hidden` — it does not force the other axis to clip too, so the shadow is free
        // to fade downward across the boundary the way a shadow should.
        overflowX: 'clip',
        pt: 'calc(56px + env(safe-area-inset-top, 0px))',
        pb: 3,
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

      <Box
        ref={frameRef}
        sx={{
          position: 'relative', zIndex: 1,
          // Sized to the card once measured and centred, so a wide tablet doesn't leave
          // the deck stranded against the left edge.
          width: measured ? cardW + PEEK_ROOM + LEFT_ROOM : '100%',
          maxWidth: '100%',
          mx: 'auto',
        }}
      >
        {/* Fixed height from the top card, so nothing below reflows as cards turn. */}
        <Box sx={{
          position: 'relative',
          height: cardH || undefined,
          minHeight: measured ? undefined : 320,
        }}>
          <AnimatePresence initial={false} custom={dir}>
            {deck.map(({ k, item }) => {
              const isFront = k === 0;
              const isLeft = k === -1;
              return (
                <Box
                  key={item.id ?? `slot-${k}`}
                  component={motion.div}
                  custom={dir}
                  variants={variants}
                  initial="enter"
                  animate={slot(k)}
                  exit="exit"
                  // z-index snaps; everything else eases.
                  //
                  // CSS z-index takes INTEGERS only. Animating it meant framer handed the
                  // browser 2.7, then 2.4 — each an invalid declaration, dropped, leaving
                  // the card at `z-index: auto` and stacking by DOM order for the whole
                  // turn. Cards swapped in front of each other mid-animation, in both
                  // directions. Zero duration keeps the ordering this deck depends on
                  // (the leaving card rides above the rest) without ever interpolating it.
                  transition={{ ...springTo, zIndex: { duration: 0 } }}
                  drag={isFront && count > 1 && measured ? 'x' : false}
                  // The left card is scenery: a tap on it turns back rather than opening it.
                  aria-hidden={isLeft || undefined}
                  dragDirectionLock
                  // Anchored: the card rubber-bands off its resting position and springs
                  // back on its own when the swipe wasn't decisive enough to turn it.
                  dragConstraints={{ left: 0, right: 0 }}
                  // Asymmetric ON PURPOSE.
                  //
                  // Forward, the top card IS what leaves, so it follows the finger. Backward
                  // it is not: the card that should come up is the PREVIOUS one, entering from
                  // the left. Letting the top card swing right meant the thing tracking your
                  // finger was the card that then had to snap back and sit down again, while a
                  // different card flew in from the opposite side — two contradictory motions
                  // for one gesture. It now barely gives, so the gesture still feels alive but
                  // the turn belongs to the card actually arriving.
                  dragElastic={{ left: 0.42, right: 0.07, top: 0, bottom: 0 }}
                  dragMomentum={false}
                  // Critically damped, so a swipe that doesn't commit settles back
                  // instead of wobbling there.
                  dragTransition={{ bounceStiffness: 500, bounceDamping: 45 }}
                  onDragStart={() => {
                    onInteract?.();
                    setLiftFor(deck[0]?.k === -1 ? deck[0].item?.id : null);
                    setPullingBack(true);
                  }}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: LEFT_ROOM,
                    touchAction: 'pan-y',
                    // Scaling from the top keeps the deck's shoulders visible above and
                    // beside the top card instead of tucking them behind it.
                    transformOrigin: 'center top',
                    cursor: isFront ? 'grab' : 'pointer',
                  }}
                >
                  {/* The finger's contribution, composed with the slot transform above
                      rather than replacing it — see the lift block. Identity for every
                      card except the one being carried. */}
                  <Box
                    component={motion.div}
                    style={{ x: item.id === liftFor ? liftX : 0 }}
                  >
                  <DeckCard
                    record={item}
                    front={isFront}
                    isXs={isXs}
                    cardW={cardW}
                    cardH={cardH}
                    badge={heroBadge(item, {
                      ranked, top10, rankLabel,
                      idx: (safeIdx + k) % count,
                    })}
                    inList={Boolean((interactions[item.id] ?? (isFront ? ix : null))?.watchlisted)}
                    // A tap on a card behind brings it forward instead of navigating;
                    // committing to a title you can only half see is never what you meant.
                    onOpen={() => {
                      if (Date.now() - dragEndedAt.current < 220) return;
                      if (isFront) goToDetail?.();
                      else if (isLeft) go?.(-1);
                      else go?.(1);
                    }}
                    onPlay={() => { if (isFront) goToPlay?.(); }}
                    onWatchlist={onWatchlist ? () => onWatchlist(item) : undefined}
                  />
                  </Box>
                </Box>
              );
            })}
          </AnimatePresence>

        </Box>

      </Box>
    </Box>
  );
};

export default HeroCardStack;
