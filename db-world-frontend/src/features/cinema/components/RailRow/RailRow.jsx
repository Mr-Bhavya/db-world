import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import RecordCard, { RecordCardSkeleton } from '../RecordCard/RecordCard';
import useRailRecords from '../../hooks/useRailRecords';
import useDeviceTier from '../../hooks/useDeviceTier';
import { useViewportWidth, fluidDesktopHeight, desktopFluidFactor } from '../../hooks/useFluidCardSize';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT, inferRailType } from './railTypeConfig';
import { navBlock } from '../RecordCard/parts/cardHelpers';

const SCROLL_AMOUNT = 0.75;
const CARD_LEAVE_COLLAPSE_MS = 95;
const ROW_LEAVE_COLLAPSE_MS = 130;

// The neighbour slide-aside MUST use the same duration + easing as the
// PrimeDesktopCard overlay growth, otherwise the seam between the expanded
// card's right edge and the next card's left edge "breathes" during the
// animation, dropping the cursor into a dead zone and causing expand/collapse
// flicker. Keep these in sync with PrimeDesktopCard (DUR / EASE).
const PRIME_ANIM_MS = 300;
const PRIME_ANIM_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

// App accent (teal) — matches the Continue Watching progress bar + spinners.
const RAIL_ACCENT = '#14b8a6';

// Scroll indicator, teal-themed. Hides itself when the row doesn't overflow.
//  - Desktop/tablet: Netflix-style segmented dots — one thin segment per scrollable
//    "page" (real count, not a fixed 5), the current one lit teal, aligned 1:1 with
//    each arrow click.
//  - Mobile: a single compact progress bar (the full-width dashes read as clutter on a
//    narrow screen) whose teal fill tracks how far through the row you've scrolled.
const ScrollDots = ({ scrollRef }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [pages, setPages] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [filled, setFilled] = useState(0); // 0..1 scroll progress (mobile bar)

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const update = () => {
      // Page by a WHOLE number of cards (same width the arrows scroll by), so the
      // indicator segments line up 1:1 with each arrow click.
      const kids = el.children;
      let stride = el.clientWidth || 1;
      if (kids.length >= 2) stride = Math.abs(kids[1].offsetLeft - kids[0].offsetLeft) || stride;
      else if (kids.length === 1) stride = kids[0].offsetWidth || stride;
      const perPage = Math.max(1, Math.floor(el.clientWidth / stride));
      const pageW = Math.max(1, perPage * stride);
      const maxScroll = el.scrollWidth - el.clientWidth;
      // Pages = the scroll stops (0, pageW, 2·pageW, …, maxScroll). Count from the
      // SCROLLABLE distance, not the whole content, or the last dot is a phantom.
      const total = maxScroll <= 1 ? 1 : Math.ceil(maxScroll / pageW) + 1;
      setPages(total);
      // The final stop lands on maxScroll (not always a page multiple), so pin the
      // active dot to the last segment there — otherwise it never lit the last one
      // and looked like one more page was still available.
      const active = el.scrollLeft >= maxScroll - 1
        ? total - 1
        : Math.min(total - 1, Math.round(el.scrollLeft / pageW));
      setActiveIdx(active);
      // Mobile bar: fraction of the row that has scrolled into/through view — starts
      // partially filled (first page visible) and reaches 100% at the end.
      setFilled(el.scrollWidth <= el.clientWidth
        ? 1
        : Math.min(1, (el.scrollLeft + el.clientWidth) / el.scrollWidth));
    };

    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    update();

    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); };
  }, [scrollRef]);

  if (pages <= 1) return null;

  if (isMobile) {
    return (
      <Box sx={{ ml: 'auto', flexShrink: 0, width: 40, height: 3, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.22)' }}>
        <Box sx={{ width: `${Math.round(filled * 100)}%`, height: '100%', bgcolor: RAIL_ACCENT, borderRadius: 2, transition: 'width 0.15s ease' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center', ml: 'auto', flexShrink: 0, pr: 0.5 }}>
      {Array.from({ length: pages }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width: 14,
            height: 2,
            borderRadius: 1,
            bgcolor: i === activeIdx ? RAIL_ACCENT : 'rgba(255,255,255,0.28)',
            transition: 'background-color 0.2s ease',
            flexShrink: 0,
          }}
        />
      ))}
    </Box>
  );
};

// ─── RailRow ─────────────────────────────────────────────────────────────────

const RailRow = ({
  rail,
  category,
  pageType,
  interactions = {},
  onWatchlist,
  onLike,
  onLove,
  onWatched,
  onExplore,
  eager = false,
  wide: wideProp,
  top10: top10Prop,
  expandOnHover: expandOnHoverProp,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const tier = useDeviceTier();
  const isTv = tier === 'tv';

  const type = inferRailType({
    ...rail,
    type: rail?.type ?? (expandOnHoverProp ? 'prime' : top10Prop ? 'top10' : wideProp ? 'wide' : null),
  });

  const cfg = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const expandOnHover = cfg.expandOnHover ?? false;
  const isTop10 = cfg.showRank ?? false;
  const isBillboard = cfg.scroll === 'snap';

  // Fluid desktop card height — keeps the prime-shift math (below) in lock-step
  // with PrimeDesktopCard, which receives this same scaled height from RecordCard.
  const vw = useViewportWidth();
  const fluidDeskH = fluidDesktopHeight(cfg.tiers.desktop, tier, vw);

  const rowRef = useRef(null);
  const scrollRef = useRef(null);
  const observerRef = useRef(null);
  const cardRefs = useRef([]);
  const collapseTimerRef = useRef(null);
  const prevExpandedIdxRef = useRef(null);
  // Live scroll-arrow state read by cards on hover (a ref → no re-render on scroll).
  const edgeArrowRef = useRef({ left: false, right: true });

  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [navHovered, setNavHovered] = useState(false); // reveal scroll arrows on hover

  // Single source of truth for prime rail expansion.
  // `push` = whether neighbours slide aside (interior) or the overlay just
  // covers them (edge-constrained, so the card never lands off-screen).
  const [expand, setExpand] = useState({ idx: null, dir: 'right', push: false });

  const {
    records,
    loading,
    hasNext,
    initialLoaded,
    trigger,
    loadMore,
  } = useRailRecords(rail?.id, rail?.limitSize, rail?.infiniteScroll, category, pageType);

  const getPrimeBaseHeight = () => {
    if (isTv) return cfg.tiers.tv;
    if (isMobile) return cfg.tiers.mobile;
    if (isTablet) return cfg.tiers.tablet;
    return fluidDeskH;
  };

  
const PRIME_OVERLAY_GAP = 6;

const PRIME_SHIFT = (() => {
  const h = getPrimeBaseHeight();
  const portraitWidth = Math.round((h * 9) / 16);
  const overlayWidth = Math.round((h * 16) / 9) - PRIME_OVERLAY_GAP;
  return Math.max(0, overlayWidth - portraitWidth);
})();


  const getVisibleRange = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller || !records.length) {
      return { firstVisible: 0, lastVisible: Math.max(0, records.length - 1) };
    }

    const viewportLeft = scroller.scrollLeft;
    const viewportRight = viewportLeft + scroller.clientWidth;

    let firstVisible = -1;
    let lastVisible = -1;

    for (let i = 0; i < records.length; i += 1) {
      const el = cardRefs.current[i];
      if (!el) continue;

      const left = el.offsetLeft;
      const right = left + el.offsetWidth;

      const isVisible = right > viewportLeft + 4 && left < viewportRight - 4;
      if (isVisible) {
        if (firstVisible === -1) firstVisible = i;
        lastVisible = i;
      }
    }

    if (firstVisible === -1 || lastVisible === -1) {
      return { firstVisible: 0, lastVisible: Math.max(0, records.length - 1) };
    }

    return { firstVisible, lastVisible };
  }, [records.length]);

  // Decide which way a card expands AND whether it pushes its neighbours.
  //  - interior card (room on the side it grows toward): slide neighbours aside,
  //    keeping direction continuity with the last hover.
  //  - edge card (a side without PRIME_SHIFT of room): grow toward the side that
  //    DOES fit, still pushing neighbours aside. The direction (not the push) is
  //    what keeps it on-screen — this was the bug: continuity used to win over
  //    the edge check, so the first/last card expanded past the viewport edge.
  //  - degenerate case (neither side fits, e.g. viewport narrower than a
  //    landscape card): overlay covers instead of pushing, so still no scroll.
  const chooseExpand = useCallback((idx) => {
    const scroller = scrollRef.current;
    const el = cardRefs.current[idx];
    const prevIdx = prevExpandedIdxRef.current;

    let fitsRight = true;
    let fitsLeft = true;
    let roomRight = Infinity;
    let roomLeft = Infinity;

    if (scroller && el) {
      const viewLeft = scroller.scrollLeft;
      const viewRight = viewLeft + scroller.clientWidth;
      const cardLeft = el.offsetLeft;               // layout pos — ignores transform
      const cardRight = cardLeft + el.offsetWidth;
      const PAD = 8;                                 // small breathing room at edges
      roomRight = viewRight - cardRight;
      roomLeft = cardLeft - viewLeft;
      fitsRight = cardRight + PRIME_SHIFT <= viewRight - PAD;
      fitsLeft = cardLeft - PRIME_SHIFT >= viewLeft + PAD;
    }

    // A side without room → grow toward the side that DOES fit, still pushing
    // neighbours aside (the expanded card stays fully visible because that side
    // has the required PRIME_SHIFT of space).
    if (!fitsLeft && fitsRight) return { dir: 'right', push: true };
    if (!fitsRight && fitsLeft) return { dir: 'left', push: true };
    // Neither side fits → pick the roomier side and let the overlay cover rather
    // than push, so the card still never requires scrolling.
    if (!fitsRight && !fitsLeft) {
      return { dir: roomRight >= roomLeft ? 'right' : 'left', push: false };
    }

    // Interior (both sides fit) → slide-aside with direction continuity.
    if (prevIdx != null) {
      if (idx > prevIdx) return { dir: 'right', push: true };
      if (idx < prevIdx) return { dir: 'left', push: true };
    }

    const { firstVisible, lastVisible } = getVisibleRange();
    if (idx <= firstVisible) return { dir: 'right', push: true };
    if (idx >= lastVisible) return { dir: 'left', push: true };
    return { dir: (lastVisible - idx) >= (idx - firstVisible) ? 'right' : 'left', push: true };
  }, [getVisibleRange, PRIME_SHIFT]);

  const expandNow = useCallback((idx) => {
    const { dir, push } = chooseExpand(idx);
    setExpand({ idx, dir, push });
    prevExpandedIdxRef.current = idx;
  }, [chooseExpand]);

  const handleHoverExpand = useCallback((idx) => {
    // cancel pending collapse if next card is entered quickly
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }

    if (idx == null) {
      // do not collapse immediately — let next card take over first
      collapseTimerRef.current = setTimeout(() => {
        setExpand((prev) => ({ ...prev, idx: null }));
        prevExpandedIdxRef.current = null;
        collapseTimerRef.current = null;
      }, CARD_LEAVE_COLLAPSE_MS);
      return;
    }

    expandNow(idx);
  }, [expandNow]);

  const handleRowMouseLeave = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }

    collapseTimerRef.current = setTimeout(() => {
      setExpand((prev) => ({ ...prev, idx: null }));
      prevExpandedIdxRef.current = null;
      collapseTimerRef.current = null;
    }, ROW_LEAVE_COLLAPSE_MS);
  }, []);

  const handleRowMouseEnter = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  const cardShift = useCallback((i) => {
    if (!expandOnHover || expand.idx == null || !expand.push) return 0;

    if (expand.dir === 'right' && i > expand.idx) {
      return PRIME_SHIFT;
    }

    if (expand.dir === 'left' && i < expand.idx) {
      return -PRIME_SHIFT;
    }

    return 0;
  }, [expandOnHover, expand.idx, expand.dir, expand.push, PRIME_SHIFT]);

  // Lazy load via Intersection Observer
  useEffect(() => {
    if (!rowRef.current || eager) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trigger();
          obs.disconnect();
        }
      },
      { rootMargin: '400px', threshold: 0.01 }
    );

    obs.observe(rowRef.current);
    observerRef.current = obs;

    return () => obs.disconnect();
  }, [trigger, eager]);

  useEffect(() => {
    if (eager && !initialLoaded) trigger();
  }, [eager, initialLoaded, trigger]);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const canLeft = el.scrollLeft > 8;
    const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 8;
    setShowLeft(canLeft);
    setShowRight(canRight);
    edgeArrowRef.current = { left: canLeft, right: canRight };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateButtons, { passive: true });
    updateButtons();

    return () => el.removeEventListener('scroll', updateButtons);
  }, [updateButtons, records]);

  const hScrollKey = rail?.id ? `cinema_rail_h_${rail.id}` : null;

  useEffect(() => {
    if (!hScrollKey || !records.length || !scrollRef.current) return;
    const saved = parseInt(sessionStorage.getItem(hScrollKey) || '0', 10);
    if (saved > 0) scrollRef.current.scrollLeft = saved;
  }, [records.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrollWithSave = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateButtons();

    if (hScrollKey) {
      sessionStorage.setItem(hScrollKey, String(el.scrollLeft));
    }

    const nearEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 200;
    if (nearEnd && hasNext && !loading) {
      loadMore();
    }
  }, [updateButtons, hScrollKey, hasNext, loading, loadMore]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;

    // Suppress hover popups for the duration of the smooth scroll, so cards
    // sliding under the stationary cursor don't pop open as you click through.
    navBlock.until = Date.now() + 700;

    // Advance by a WHOLE number of cards (a "page"), snapped to a stride multiple
    // measured from 0 — so every click moves the same amount, no card is left
    // half-cut, right→left returns to the exact original position, and it lines up
    // with the segmented indicator. Works on every screen (stride read from the DOM).
    const kids = el.children;
    let stride = el.clientWidth * SCROLL_AMOUNT;
    if (kids.length >= 2) stride = Math.abs(kids[1].offsetLeft - kids[0].offsetLeft) || stride;
    else if (kids.length === 1) stride = kids[0].offsetWidth || stride;
    const perPage = Math.max(1, Math.floor(el.clientWidth / stride));
    const maxScroll = el.scrollWidth - el.clientWidth;

    let snapped = Math.round((el.scrollLeft + dir * perPage * stride) / stride) * stride;
    // Land cleanly on the two ends so the first/last card is never left half-cut.
    if (snapped <= stride * 0.5) snapped = 0;
    if (snapped >= maxScroll - stride * 0.5) snapped = maxScroll;
    snapped = Math.max(0, Math.min(snapped, maxScroll));

    el.scrollTo({ left: snapped, behavior: 'smooth' });
  };

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  if (!rail) return null;

  const skeletonCount = Math.min(rail.limitSize ?? 8, 8);
  const px = 'clamp(12px, 4vw, 48px)';

  const rowPadY = expandOnHover ? '44px' : isTop10 ? '72px' : '16px';
  const rowNegY = expandOnHover ? '-44px' : isTop10 ? '-72px' : '-16px';

  // Inter-card gap scales with the viewport on desktop (matches the fluid cards),
  // and falls back to the breakpoint-based spacing on mobile/tablet/TV.
  const railGap = tier === 'desktop'
    ? `${Math.round((isTop10 ? 4 : 16) * desktopFluidFactor(vw))}px`
    : (isTop10 ? 0.5 : { xs: 1.25, md: 2 });

  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Box
        sx={{
          mb: { xs: 3.25, md: 5 },
          background: 'transparent',
        }}
      >
        {type !== 'billboard' && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              px,
              mb: 1,
              cursor: 'default',
              gap: 1,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: '#e5e5e5',
                fontWeight: 700,
                fontSize: 'clamp(0.95rem, 1.5vw, 1.4rem)',
                letterSpacing: 0.2,
                flexShrink: 0,
              }}
            >
              {rail.title}
            </Typography>

            {!rail?.infiniteScroll && <ScrollDots scrollRef={scrollRef} />}
          </Box>
        )}

        <Box
          onMouseEnter={() => setNavHovered(true)}
          onMouseLeave={() => setNavHovered(false)}
          sx={{
            position: 'relative',
            background: 'transparent',
          }}
        >
          {showLeft && !isMobile && !isTv && (
            <Box
              onMouseEnter={() => { navBlock.until = Date.now() + 600; }}
              onClick={() => scroll(-1)}
              role="button"
              aria-label="Scroll left"
              sx={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 64, zIndex: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-start', pl: 0.5,
                background: 'linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.42) 45%, rgba(0,0,0,0.08) 80%, transparent 100%)',
                opacity: navHovered ? 1 : 0,
                // Full-height handle: captures hover so an edge card can't pop open
                // UNDER it (which used to cover the control), and the WHOLE strip is
                // the click target. Hovering it also suppresses card popups (navBlock).
                pointerEvents: 'auto',
                cursor: 'pointer',
                transition: 'opacity 0.22s ease',
                '&:hover .rail-arrow': { bgcolor: 'rgba(0,0,0,0.85)', transform: 'scale(1.08)' },
              }}
            >
              <Box
                className="rail-arrow"
                sx={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', bgcolor: 'rgba(0,0,0,0.62)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                  transition: 'background 0.15s ease, transform 0.15s ease',
                }}
              >
                <ChevronLeft />
              </Box>
            </Box>
          )}

          {showRight && !isMobile && !isTv && (
            <Box
              onMouseEnter={() => { navBlock.until = Date.now() + 600; }}
              onClick={() => scroll(1)}
              role="button"
              aria-label="Scroll right"
              sx={{
                position: 'absolute', right: 0, top: 0, bottom: 0, width: 64, zIndex: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 0.5,
                background: 'linear-gradient(to left, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.42) 45%, rgba(0,0,0,0.08) 80%, transparent 100%)',
                opacity: navHovered ? 1 : 0,
                // Full-height handle: captures hover so an edge card can't pop open
                // UNDER it (which used to cover the control), and the WHOLE strip is
                // the click target. Hovering it also suppresses card popups (navBlock).
                pointerEvents: 'auto',
                cursor: 'pointer',
                transition: 'opacity 0.22s ease',
                '&:hover .rail-arrow': { bgcolor: 'rgba(0,0,0,0.85)', transform: 'scale(1.08)' },
              }}
            >
              <Box
                className="rail-arrow"
                sx={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', bgcolor: 'rgba(0,0,0,0.62)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                  transition: 'background 0.15s ease, transform 0.15s ease',
                }}
              >
                <ChevronRight />
              </Box>
            </Box>
          )}

          <Box
            ref={scrollRef}
            onScroll={handleScrollWithSave}
            onMouseLeave={expandOnHover ? handleRowMouseLeave : undefined}
            onMouseEnter={expandOnHover ? handleRowMouseEnter : undefined}
            sx={{
              display: 'flex',
              gap: railGap,
              overflowX: isBillboard ? 'hidden' : 'auto',
              overflowY: 'visible',
              px,
              py: rowPadY,
              my: rowNegY,
              position: 'relative',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              ...(isBillboard && {
                scrollSnapType: 'x mandatory',
                '& > *': { scrollSnapAlign: 'start' },
              }),
            }}
          >
            {(!initialLoaded || (loading && records.length === 0))
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <RecordCardSkeleton key={i} type={type} />
                ))
              : records.map((rec, i) => {
                  const isExpanded = expand.idx === i;
                  const shiftedX = cardShift(i);

                  if (expandOnHover) {
                    return (
                      <Box
                        key={rec.id}
                        ref={(el) => { cardRefs.current[i] = el; }}
                        sx={{
                          flexShrink: 0,
                          position: 'relative',
                          zIndex: isExpanded ? 7 : 1,
                          transform: `translateX(${shiftedX}px)`,
                          // Matched to the overlay growth so the seam stays constant.
                          transition: `transform ${PRIME_ANIM_MS}ms ${PRIME_ANIM_EASE}`,
                          willChange: 'transform',
                        }}
                      >
                        <RecordCard
                          record={rec}
                          type={type}
                          imageVariant={rail?.imageVariant}
                          interaction={interactions[rec.id] ?? {}}
                          onWatchlist={onWatchlist}
                          onLike={onLike}
                          onLove={onLove}
                          onWatched={onWatched}
                          onExplore={onExplore}
                          expandOnHover
                          index={i}
                          onHoverExpand={handleHoverExpand}
                          expandDir={isExpanded ? expand.dir : 'right'}
                          forceExpanded={isExpanded}
                        />
                      </Box>
                    );
                  }

                  return (
                    <Box
                      key={rec.id}
                      ref={(el) => { cardRefs.current[i] = el; }}
                      sx={{ flexShrink: 0 }}
                    >
                      <RecordCard
                        record={rec}
                        type={type}
                        imageVariant={rail?.imageVariant}
                        interaction={interactions[rec.id] ?? {}}
                        onWatchlist={onWatchlist}
                        onLike={onLike}
                        onLove={onLove}
                        onWatched={onWatched}
                        onExplore={onExplore}
                        edgeArrowRef={edgeArrowRef}
                        rank={isTop10 ? i + 1 : undefined}
                      />
                    </Box>
                  );
                })}

            {loading && records.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
                {[...Array(3)].map((_, i) => (
                  <RecordCardSkeleton key={i} type={type} />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default RailRow;