# Cinema Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Cinema page (RailRow, RecordCard, RailSkeleton, Navbar, HeroBanner) with config-driven rail types, 4-tier device support (mobile/tablet/desktop/tv), and large-font accessibility.

**Architecture:** A single `RAIL_TYPE_CONFIG` object encodes all card dimensions, behaviors, and skeleton shapes. A `useDeviceTier()` hook detects the tier. Components read from config — no hardcoded sizes. Navbar gains a TV left-drawer, fixes the mobile breakpoint to `<600px`, and exposes Downloads on all platforms.

**Tech Stack:** React 18, MUI v5, Framer Motion, TanStack Query, Capacitor, React Router v6

---

## File Map

| File | Action |
|------|--------|
| `src/features/cinema/hooks/useDeviceTier.js` | **Create** |
| `src/features/cinema/components/RailRow/railTypeConfig.js` | **Create** |
| `src/features/cinema/components/RailRow/RailSkeleton.jsx` | **Create** (extracted + improved from CinemaPage) |
| `src/features/cinema/components/RailRow/RailRow.jsx` | **Modify** |
| `src/features/cinema/components/RecordCard/RecordCard.jsx` | **Modify** |
| `src/features/cinema/components/HeroBanner/HeroBanner.jsx` | **Modify** |
| `src/features/cinema/components/HeroBanner/HeroBannerDesktop.jsx` | **Modify** |
| `src/features/cinema/components/HeroBanner/HeroBannerMobile.jsx` | **Modify** |
| `src/features/cinema/navbar/index.js` | **Modify** |
| `src/features/cinema/screens/CinemaPage/CinemaPage.jsx` | **Modify** |

All paths relative to `db-world-frontend/`.

---

### Task 1: useDeviceTier hook

**Files:**
- Create: `db-world-frontend/src/features/cinema/hooks/useDeviceTier.js`

- [ ] **Step 1: Create the file**

```js
import { useTheme, useMediaQuery } from '@mui/material';

// Returns current device tier. 'tv' requires ≥1920px width AND coarse pointer
// (d-pad remote), distinguishing it from a large desktop monitor with a mouse.
export default function useDeviceTier() {
  const theme = useTheme();
  const isMobileBreak = useMediaQuery(theme.breakpoints.down('sm'));       // < 600px
  const isTabletBreak = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600–959px
  const isTvWidth     = useMediaQuery('(min-width:1920px)');
  const isCoarse      = useMediaQuery('(pointer: coarse)');

  if (isTvWidth && isCoarse) return 'tv';
  if (isMobileBreak)         return 'mobile';
  if (isTabletBreak)         return 'tablet';
  return 'desktop';
}
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/cinema/hooks/useDeviceTier.js
git commit -m "feat(cinema): add useDeviceTier hook for 4-tier device detection"
```

---

### Task 2: Rail type config

**Files:**
- Create: `db-world-frontend/src/features/cinema/components/RailRow/railTypeConfig.js`

- [ ] **Step 1: Create the file**

```js
// Tier values are card heights in px. Aspect ratio drives card width.
// Shape mirrors what the rail API will expose — migration = swap import for fetch.
export const RAIL_TYPE_CONFIG = {
  standard: {
    cardAspect: '2/3',
    tiers: { mobile: 110, tablet: 130, desktop: 150, tv: 200 },
    hover: 'popup',
    skeleton: 'poster',
    scroll: 'horizontal',
  },
  wide: {
    cardAspect: '16/9',
    tiers: { mobile: 200, tablet: 240, desktop: 280, tv: 380 },
    hover: 'popup',
    skeleton: 'backdrop',
    scroll: 'horizontal',
    showProgress: true,
  },
  prime: {
    cardAspect: '9/16',
    tiers: { mobile: 140, tablet: 180, desktop: 380, tv: 500 },
    hover: 'expand',
    skeleton: 'portrait',
    scroll: 'horizontal',
    expandOnHover: true,
  },
  top10: {
    cardAspect: '2/3',
    tiers: { mobile: 130, tablet: 170, desktop: 210, tv: 280 },
    hover: 'popup',
    skeleton: 'top10',
    scroll: 'horizontal',
    showRank: true,
  },
  jumbo: {
    cardAspect: '2/3',
    tiers: { mobile: 160, tablet: 200, desktop: 260, tv: 340 },
    hover: 'popup',
    skeleton: 'poster',
    scroll: 'horizontal',
  },
  continue: {
    cardAspect: '16/9',
    tiers: { mobile: 200, tablet: 240, desktop: 280, tv: 380 },
    hover: 'popup',
    skeleton: 'backdrop',
    scroll: 'horizontal',
    showProgress: true,
    showResume: true,
  },
  person: {
    cardAspect: '1/1',
    tiers: { mobile: 100, tablet: 120, desktop: 140, tv: 190 },
    hover: 'name',
    skeleton: 'circle',
    scroll: 'horizontal',
  },
  billboard: {
    cardAspect: '16/9',
    tiers: { mobile: 200, tablet: 300, desktop: 420, tv: 600 },
    hover: 'none',
    skeleton: 'backdrop',
    scroll: 'snap',
    snapCount: 1,
  },
};

export const RAIL_TYPE_DEFAULT = 'standard';
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/cinema/components/RailRow/railTypeConfig.js
git commit -m "feat(cinema): add RAIL_TYPE_CONFIG — config-first rail type system"
```

---

### Task 3: RecordCardSkeleton + RecordCard — config-driven dimensions

**Files:**
- Modify: `db-world-frontend/src/features/cinema/components/RecordCard/RecordCard.jsx`

- [ ] **Step 1: Add two new imports after the existing import block (after line 18)**

```js
import useDeviceTier from '../../hooks/useDeviceTier';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT } from '../RailRow/railTypeConfig';
```

- [ ] **Step 2: Replace RecordCardSkeleton (lines 27–52) with config-aware version**

```jsx
export const RecordCardSkeleton = ({ type = 'standard', wide, top10, prime }) => {
  // Support legacy boolean props from WatchlistRailRow
  const resolvedType = type !== 'standard'
    ? type
    : prime ? 'prime' : top10 ? 'top10' : wide ? 'wide' : 'standard';

  const cfg    = RAIL_TYPE_CONFIG[resolvedType] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const deskH  = cfg.tiers.desktop;
  const mobH   = cfg.tiers.mobile;
  const tabH   = cfg.tiers.tablet;
  const isCirc = resolvedType === 'person';
  const is10   = resolvedType === 'top10';
  const isPrim = resolvedType === 'prime';
  const isWide = ['wide', 'continue', 'billboard'].includes(resolvedType);

  const w = isPrim
    ? { xs: Math.round(mobH * 9/16), sm: Math.round(tabH * 9/16), md: Math.round(deskH * 9/16) }
    : is10
      ? { xs: Math.round(mobH * 2/3), sm: Math.round(tabH * 2/3), md: Math.round(deskH * 2/3) }
      : isWide
        ? { xs: Math.round(mobH * 16/9), sm: Math.round(tabH * 16/9), md: Math.round(deskH * 16/9) }
        : isCirc
          ? { xs: mobH, sm: tabH, md: deskH }
          : { xs: Math.round(mobH * 2/3), sm: Math.round(tabH * 2/3), md: Math.round(deskH * 2/3) };

  const h = isPrim
    ? { xs: mobH, sm: tabH, md: deskH }
    : isCirc
      ? { xs: mobH, sm: tabH, md: deskH }
      : undefined;

  return (
    <Box sx={{
      flexShrink: 0,
      pl: is10 ? { xs: 6, md: 10 } : 0,
      width: w,
      ...(h ? { height: h } : { aspectRatio: cfg.cardAspect }),
      borderRadius: isCirc ? '50%' : 1.5,
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,.06)',
    }}>
      <Skeleton variant="rectangular" width="100%" height="100%"
        sx={{ bgcolor: 'rgba(255,255,255,.06)',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }} />
    </Box>
  );
};
```

- [ ] **Step 3: Update RecordCard function signature — add `type` prop (line 360–365)**

Replace:
```js
const RecordCard = ({
  record, wide = false, interaction = {},
  onWatchlist, onLike, onLove, onWatched,
  rank, expandOnHover = false,
  index, onHoverExpand, expandDir = 'left',
}) => {
```
With:
```js
const RecordCard = ({
  record, type: typeProp, wide = false, interaction = {},
  onWatchlist, onLike, onLove, onWatched,
  rank, expandOnHover = false,
  index, onHoverExpand, expandDir = 'left',
}) => {
```

- [ ] **Step 4: Add tier + config lookup after the existing `isMobile` line (after line 367)**

```js
  const tier  = useDeviceTier();
  const isTv  = tier === 'tv';
  // Resolve type: explicit prop wins, then infer from legacy boolean props
  const type  = typeProp ?? (expandOnHover ? 'prime' : rank != null ? 'top10' : wide ? 'wide' : 'standard');
  const cfg   = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const baseH = cfg.tiers[tier];
```

- [ ] **Step 5: Replace the `PRIME_HEIGHT`, `cardWidth`, `aspectRatio` dimension block (lines ~437–462)**

Find the comment `// ── dimensions ──` and replace everything from there through the `aspectRatio` assignment with:

```js
  // ── dimensions — driven by RAIL_TYPE_CONFIG ─────────────────────────────
  const PRIME_HEIGHT = {
    xs: cfg.tiers.mobile,
    sm: cfg.tiers.tablet,
    md: cfg.tiers.desktop,
  };

  const cardWidth = (type === 'prime')
    ? {
        xs: `calc(${cfg.tiers.mobile}px * ${16/9})`,
        sm: `calc(${cfg.tiers.tablet}px * ${16/9})`,
        md: isExpanded
          ? `calc(${cfg.tiers.desktop}px * ${16/9})`
          : `calc(${cfg.tiers.desktop}px * ${9/16})`,
      }
    : (type === 'top10')
      ? { xs: Math.round(cfg.tiers.mobile * 2/3), sm: Math.round(cfg.tiers.tablet * 2/3), md: Math.round(cfg.tiers.desktop * 2/3) }
      : (type === 'wide' || type === 'continue')
        ? { xs: Math.round(cfg.tiers.mobile * 16/9), sm: Math.round(cfg.tiers.tablet * 16/9), md: Math.round(cfg.tiers.desktop * 16/9) }
        : (type === 'person')
          ? { xs: cfg.tiers.mobile, sm: cfg.tiers.tablet, md: cfg.tiers.desktop }
          : (type === 'jumbo')
            ? { xs: Math.round(cfg.tiers.mobile * 2/3), sm: Math.round(cfg.tiers.tablet * 2/3), md: Math.round(cfg.tiers.desktop * 2/3) }
            : // standard/billboard: 2:3 poster
              { xs: Math.round(cfg.tiers.mobile * 2/3), sm: Math.round(cfg.tiers.tablet * 2/3), md: Math.round(cfg.tiers.desktop * 2/3) };

  const aspectRatio = cfg.cardAspect.replace('/', ' / ');
```

- [ ] **Step 6: Update desktopPrime `PRIME_H` constant (inside `if (desktopPrime)` block, ~line 481)**

Replace:
```js
    const PRIME_H   = 380;
```
With:
```js
    const PRIME_H   = cfg.tiers.desktop;
```

- [ ] **Step 7: Add TV focus styles to the card `<Box>` (inside the main return, the card box ~line 629)**

Inside the outer card `<Box sx={{ width: cardWidth, ... }}>`, add at the end of the sx object:
```js
          // TV: focus-visible ring + scale instead of hover
          ...(isTv && {
            '&:focus-visible': {
              outline: '4px solid',
              outlineColor: 'primary.main',
              outlineOffset: '4px',
              transform: 'scale(1.08)',
              zIndex: 10,
              transition: 'transform 0.15s ease',
            },
          }),
```

Also add `tabIndex={isTv ? 0 : undefined}` to the outer `<motion.div>` so TV cards are keyboard-focusable.

- [ ] **Step 8: Fix font scaling — card title overlay uses clamp(rem)**

In the "Default compact hover overlay" section (~line 776), change the title Typography `fontSize`:
```js
fontSize: 'clamp(0.65rem, 2vw, 0.9rem)',
```

In the rating Typography just below it:
```js
fontSize: 'clamp(0.6rem, 1.5vw, 0.78rem)',
```

In HoverPopup title Typography (~line 307):
```js
fontSize: 'clamp(0.85rem, 1.5vw, 1rem)',
```

- [ ] **Step 9: Commit**

```bash
git add db-world-frontend/src/features/cinema/components/RecordCard/RecordCard.jsx
git commit -m "feat(cinema): RecordCard — config-driven dimensions, TV focus, font scaling"
```

---

### Task 4: RailSkeleton — new config-aware component

**Files:**
- Create: `db-world-frontend/src/features/cinema/components/RailRow/RailSkeleton.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React from 'react';
import { Box, Skeleton } from '@mui/material';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT } from './railTypeConfig';
import useDeviceTier from '../../hooks/useDeviceTier';

const SkeletonCard = ({ type, tier }) => {
  const cfg     = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];
  const h       = cfg.tiers[tier];
  const isCirc  = type === 'person';
  const isTop10 = type === 'top10';
  const isPrime = type === 'prime';
  const isWide  = ['wide', 'continue', 'billboard'].includes(type);

  const w = isPrime  ? Math.round(h * 9/16)
    : isTop10        ? Math.round(h * 2/3)
    : isWide         ? Math.round(h * 16/9)
    : isCirc         ? h
    :                  Math.round(h * 2/3);

  return (
    <Box sx={{
      flexShrink: 0,
      pl: isTop10 ? { xs: 6, md: 10 } : 0,
      width: w,
      height: (isPrime || isCirc) ? h : undefined,
      aspectRatio: (!isPrime && !isCirc) ? cfg.cardAspect : undefined,
      borderRadius: isCirc ? '50%' : 1.5,
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,.06)',
    }}>
      <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{
          bgcolor: 'rgba(255,255,255,.06)',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
    </Box>
  );
};

const RailSkeleton = ({ type = 'standard', count = 6 }) => {
  const tier = useDeviceTier();

  return (
    <Box sx={{ mb: { xs: 2.5, md: 3.5 }, px: { xs: 2, md: 4 } }}>
      <Skeleton
        variant="text"
        width={200}
        height={28}
        sx={{
          bgcolor: 'rgba(255,255,255,.08)',
          mb: 1,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
      <Box sx={{ display: 'flex', gap: type === 'top10' ? 0.5 : 1.5, overflowX: 'hidden' }}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} type={type} tier={tier} />
        ))}
      </Box>
    </Box>
  );
};

export default RailSkeleton;
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/cinema/components/RailRow/RailSkeleton.jsx
git commit -m "feat(cinema): add RailSkeleton with per-type shapes and tier-matched dimensions"
```

---

### Task 5: RailRow — scroll indicator, config, remove heuristics

**Files:**
- Modify: `db-world-frontend/src/features/cinema/components/RailRow/RailRow.jsx`

Replace the entire file with:

- [ ] **Step 1: Write new RailRow.jsx**

```jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Typography, IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import { ChevronLeft, ChevronRight, ArrowForward } from '@mui/icons-material';
import RecordCard, { RecordCardSkeleton } from '../RecordCard/RecordCard';
import useRailRecords from '../../hooks/useRailRecords';
import useDeviceTier from '../../hooks/useDeviceTier';
import { RAIL_TYPE_CONFIG, RAIL_TYPE_DEFAULT } from './railTypeConfig';

const SCROLL_AMOUNT = 0.75;

// Thin scroll track + moving thumb. Only shown when rail.infiniteScroll === false.
const ScrollIndicator = ({ scrollRef }) => {
  const [left,   setLeft]   = useState(0);
  const [thumbW, setThumbW] = useState(20);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const max  = el.scrollWidth - el.clientWidth;
      const vis  = el.clientWidth / el.scrollWidth;
      const tw   = Math.max(12, Math.min(60, vis * 100));
      setThumbW(tw);
      setLeft(max > 0 ? (el.scrollLeft / max) * (100 - tw) : 0);
    };
    el.addEventListener('scroll', update, { passive: true });
    update();
    return () => el.removeEventListener('scroll', update);
  }, [scrollRef]);

  return (
    <Box sx={{
      flex: 1, height: '2px', bgcolor: 'rgba(255,255,255,.1)',
      borderRadius: '1px', overflow: 'hidden', mx: 1.5, alignSelf: 'center',
    }}>
      <Box sx={{
        height: '100%',
        width: `${thumbW}%`,
        ml: `${left}%`,
        bgcolor: 'rgba(255,255,255,.45)',
        borderRadius: '1px',
        transition: 'margin-left 0.12s linear',
      }} />
    </Box>
  );
};

// ─── RailRow ─────────────────────────────────────────────────────────────────

const RailRow = ({
  rail,
  category,
  interactions = {},
  onWatchlist,
  onLike,
  onLove,
  onWatched,
  onExplore,
  eager = false,
  // Legacy boolean props — kept for backward compat with WatchlistRailRow
  wide: wideProp,
  top10: top10Prop,
  expandOnHover: expandOnHoverProp,
}) => {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const tier     = useDeviceTier();
  const isTv     = tier === 'tv';

  // Resolve rail type: DTO field wins, then legacy props, then default
  const type = rail?.type
    ?? (expandOnHoverProp ? 'prime' : top10Prop ? 'top10' : wideProp ? 'wide' : RAIL_TYPE_DEFAULT);
  const cfg = RAIL_TYPE_CONFIG[type] ?? RAIL_TYPE_CONFIG[RAIL_TYPE_DEFAULT];

  // Derived flags from config (no more heuristic string matching)
  const expandOnHover = cfg.expandOnHover ?? false;
  const isTop10       = cfg.showRank      ?? false;
  const isBillboard   = cfg.scroll === 'snap';

  const rowRef      = useRef(null);
  const scrollRef   = useRef(null);
  const observerRef = useRef(null);

  const [showLeft,     setShowLeft]     = useState(false);
  const [showRight,    setShowRight]    = useState(true);
  const [titleHovered, setTitleHovered] = useState(false);

  // Prime-rail expand coordination
  const [expand,   setExpand]   = useState({ idx: null, dir: null });
  const lastXRef   = useRef(null);
  const moveDirRef = useRef('right');

  const handleMouseMove = useCallback((e) => {
    if (lastXRef.current != null) {
      const dx = e.clientX - lastXRef.current;
      if (Math.abs(dx) > 2) moveDirRef.current = dx > 0 ? 'right' : 'left';
    }
    lastXRef.current = e.clientX;
  }, []);

  const handleHoverExpand = useCallback((idx) => {
    if (idx == null) { setExpand({ idx: null, dir: null }); return; }
    setExpand({ idx, dir: moveDirRef.current === 'right' ? 'left' : 'right' });
  }, []);

  // Prime shift: landscape width − portrait width at current desktop tier
  const deskH      = cfg.tiers.desktop;
  const PRIME_SHIFT = Math.round(deskH * 16/9) - Math.round(deskH * 9/16);

  const cardShift = (i) => {
    if (expand.idx == null) return 0;
    if (expand.dir === 'left'  && i < expand.idx) return -PRIME_SHIFT;
    if (expand.dir === 'right' && i > expand.idx) return  PRIME_SHIFT;
    return 0;
  };

  const { records, loading, hasNext, initialLoaded, trigger, loadMore } =
    useRailRecords(rail?.id, rail?.limitSize, rail?.infiniteScroll, category);

  // Lazy load via Intersection Observer
  useEffect(() => {
    if (!rowRef.current || eager) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { trigger(); obs.disconnect(); } },
      { rootMargin: '400px', threshold: 0.01 }
    );
    obs.observe(rowRef.current);
    observerRef.current = obs;
    return () => obs.disconnect();
  }, [trigger, eager]);

  useEffect(() => {
    if (eager && !initialLoaded) trigger();
  }, [eager, initialLoaded, trigger]);

  // Arrow button visibility
  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 8);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateButtons, { passive: true });
    updateButtons();
    return () => el.removeEventListener('scroll', updateButtons);
  }, [updateButtons, records]);

  // Horizontal scroll persistence
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
    if (hScrollKey) sessionStorage.setItem(hScrollKey, String(el.scrollLeft));
    const nearEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 200;
    if (nearEnd && hasNext && !loading) loadMore();
  }, [updateButtons, hasNext, loading, loadMore, hScrollKey]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * SCROLL_AMOUNT, behavior: 'smooth' });
  };

  if (!rail) return null;

  const skeletonCount       = Math.min(rail.limitSize ?? 8, 8);
  const showScrollIndicator = rail.infiniteScroll === false;
  // clamp covers phone edge → TV overscan (48px) automatically
  const px                  = 'clamp(12px, 4vw, 48px)';

  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Box sx={{ mb: { xs: 2.5, md: 3.5 } }}>

        {/* ── Row header: [Title] [scroll track?] [Explore All →] ── */}
        {type !== 'billboard' && (
          <Box
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={() => setTitleHovered(false)}
            sx={{ display: 'flex', alignItems: 'center', px: 'clamp(12px, 4vw, 48px)', mb: 1, cursor: 'default', gap: 1 }}
          >
            <Typography
              variant="h6"
              sx={{
                color: '#e5e5e5', fontWeight: 700,
                fontSize: 'clamp(0.95rem, 1.5vw, 1.4rem)',
                letterSpacing: 0.2, flexShrink: 0,
              }}
            >
              {rail.title}
            </Typography>

            {/* Scroll indicator — finite rails only */}
            {showScrollIndicator && (
              <ScrollIndicator scrollRef={scrollRef} />
            )}

            {/* "Explore All" — hidden on mobile, always visible on TV */}
            <Box
              component={motion.div}
              animate={{ opacity: (titleHovered || isTv) ? 1 : 0, x: (titleHovered || isTv) ? 0 : -8 }}
              transition={{ duration: 0.2 }}
              onClick={() => onExplore?.(rail)}
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center', gap: 0.3,
                cursor: 'pointer', flexShrink: 0,
                ml: showScrollIndicator ? 0 : 'auto',
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'primary.main', fontWeight: 600, fontSize: '0.75rem', letterSpacing: 0.5 }}
              >
                Explore All
              </Typography>
              <ArrowForward sx={{ fontSize: 12, color: 'primary.main' }} />
            </Box>
          </Box>
        )}

        {/* ── Scroll container ── */}
        <Box sx={{ position: 'relative' }}>
          {/* Left arrow — desktop only, not TV (TV uses D-pad) */}
          {showLeft && !isMobile && !isTv && (
            <IconButton
              onClick={() => scroll(-1)}
              sx={{
                position: 'absolute', left: 0, top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 5, bgcolor: 'rgba(20,20,20,.85)',
                color: '#fff', height: '100%', width: 40, borderRadius: 0,
                '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
              }}
            >
              <ChevronLeft />
            </IconButton>
          )}

          {/* Right arrow — desktop only, not TV */}
          {showRight && !isMobile && !isTv && (
            <IconButton
              onClick={() => scroll(1)}
              sx={{
                position: 'absolute', right: 0, top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 5, bgcolor: 'rgba(20,20,20,.85)',
                color: '#fff', height: '100%', width: 40, borderRadius: 0,
                '&:hover': { bgcolor: 'rgba(20,20,20,.95)' },
              }}
            >
              <ChevronRight />
            </IconButton>
          )}

          {/* Cards row */}
          <Box
            ref={scrollRef}
            onScroll={handleScrollWithSave}
            onMouseMove={expandOnHover ? handleMouseMove : undefined}
            sx={{
              display: 'flex',
              gap: isTop10 ? 0.5 : { xs: 1, md: 1.5 },
              overflowX: isBillboard ? 'hidden' : 'auto',
              overflowY: 'visible',
              px,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              py: isTop10 ? '40px' : '16px',
              my: isTop10 ? '-40px' : '-16px',
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
              : records.map((rec, i) => (
                  expandOnHover ? (
                    <Box
                      key={rec.id}
                      sx={{
                        flexShrink: 0,
                        transform: `translateX(${cardShift(i)}px)`,
                        transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
                        willChange: 'transform',
                      }}
                    >
                      <RecordCard
                        record={rec}
                        type={type}
                        interaction={interactions[rec.id] ?? {}}
                        onWatchlist={onWatchlist}
                        onLike={onLike}
                        onLove={onLove}
                        onWatched={onWatched}
                        expandOnHover
                        index={i}
                        onHoverExpand={handleHoverExpand}
                        expandDir={expand.idx === i ? expand.dir : 'left'}
                      />
                    </Box>
                  ) : (
                    <RecordCard
                      key={rec.id}
                      record={rec}
                      type={type}
                      interaction={interactions[rec.id] ?? {}}
                      onWatchlist={onWatchlist}
                      onLike={onLike}
                      onLove={onLove}
                      onWatched={onWatched}
                      rank={isTop10 ? i + 1 : undefined}
                    />
                  )
                ))
            }

            {/* Inline loading-more skeletons */}
            {loading && records.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
                {[...Array(3)].map((_, i) => <RecordCardSkeleton key={i} type={type} />)}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default RailRow;
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/cinema/components/RailRow/RailRow.jsx
git commit -m "feat(cinema): RailRow — config-driven type, scroll indicator, remove heuristics"
```

---

### Task 6: HeroBanner — visibility pause + reduced-motion fixes

**Files:**
- Modify: `db-world-frontend/src/features/cinema/components/HeroBanner/HeroBanner.jsx`
- Modify: `db-world-frontend/src/features/cinema/components/HeroBanner/HeroBannerDesktop.jsx`

- [ ] **Step 1: Update `startCycle` in HeroBanner.jsx to respect `reducedMotion`**

Current `startCycle` (lines 143–153):
```js
  const startCycle = useCallback(() => {
    clearInterval(timerRef.current);
    if (featured.length <= 1) return;
    timerRef.current = setInterval(() => {
      setDir(1);
      setIdx((i) => (i + 1) % featured.length);
      setProgressKey((k) => k + 1);
    }, CYCLE_MS);
  }, [featured.length]);
```

Replace with:
```js
  const startCycle = useCallback(() => {
    clearInterval(timerRef.current);
    if (featured.length <= 1 || reducedMotion) return;
    timerRef.current = setInterval(() => {
      setDir(1);
      setIdx((i) => (i + 1) % featured.length);
      setProgressKey((k) => k + 1);
    }, CYCLE_MS);
  }, [featured.length, reducedMotion]);
```

- [ ] **Step 2: Add `visibilitychange` listener to the cycle useEffect (lines 155–161)**

Replace:
```js
  useEffect(() => {
    startCycle();
    return () => {
      clearInterval(timerRef.current);
    };
  }, [startCycle]);
```

With:
```js
  useEffect(() => {
    startCycle();
    const handleVisibility = () => {
      if (document.hidden) clearInterval(timerRef.current);
      else startCycle();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [startCycle]);
```

- [ ] **Step 3: Update HeroBannerDesktop metrics for TV tier (HeroBannerDesktop.jsx)**

In the `metrics` useMemo (lines 53–92), update the TV tier values to match spec:

```js
      heroHeight: isTv
        ? 'clamp(760px, 86vh, 1100px)'
        : isMonitor
          ? 'clamp(680px, 82vh, 980px)'
          : 'clamp(560px, 78vh, 860px)',

      contentLeft: isTv ? 48 : isMonitor ? 72 : 52,    // TV: overscan-safe 48px
      contentBottom: isTv ? 122 : isMonitor ? 106 : 92,

      contentWidth: isTv
        ? 'min(35vw, 780px)'
        : isMonitor
          ? 'min(38vw, 680px)'
          : 'min(44vw, 560px)',

      titleSize: isTv
        ? 'clamp(3rem, 5.5vw, 7rem)'       // updated per spec
        : isMonitor
          ? 'clamp(3rem, 4.2vw, 4.8rem)'
          : 'clamp(2.2rem, 3.4vw, 3.9rem)',

      bodySize: isTv ? '1.1rem' : isMonitor ? '1rem' : '0.95rem',
      chipSize: isTv ? '0.9rem' : '0.74rem',
      chipHeight: isTv ? 30 : 24,

      buttonHeight: isTv ? 64 : 48,        // updated per spec (was 60)
      buttonFont: isTv ? '1.08rem' : '0.96rem',
      roundBtnSize: isTv ? 56 : 44,

      arrowBtnSize: isTv ? 64 : isMonitor ? 54 : 46,
      arrowIconSize: isTv ? 36 : 28,
      sidePadding: isTv ? 48 : 20,         // overscan-safe

      indicatorBottom: isTv ? 34 : 24,
      fadeHeight: isTv ? 100 : 82,
```

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/src/features/cinema/components/HeroBanner/HeroBanner.jsx
git add db-world-frontend/src/features/cinema/components/HeroBanner/HeroBannerDesktop.jsx
git commit -m "feat(cinema): HeroBanner — visibility pause, reduced-motion cycle, TV metric fixes"
```

- [ ] **Step 5: Fix HeroBannerMobile posterWidth to be clamp-based (HeroBannerMobile.jsx)**

In the `metrics` useMemo (lines 30–45), replace `posterWidth` and `actionWidth`:

```js
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
```

- [ ] **Step 6: Commit**

```bash
git add db-world-frontend/src/features/cinema/components/HeroBanner/HeroBannerMobile.jsx
git commit -m "feat(cinema): HeroBannerMobile — clamp poster width, min-height text containers"
```

---

### Task 7: Navbar — 3-tier (mobile top+pill, desktop AppBar, TV drawer)

**Files:**
- Modify: `db-world-frontend/src/features/cinema/navbar/index.js`

Key changes:
1. `isMobile` → `down('sm')` (tablets now get desktop AppBar)
2. Downloads shown on all platforms (remove `isAndroid` gate)
3. Desktop right side: adds Filter icon
4. TV: left drawer variant

- [ ] **Step 1: Update imports — add useDeviceTier**

After the existing imports, add:
```js
import useDeviceTier from '../hooks/useDeviceTier';
```

- [ ] **Step 2: Fix `isMobile` breakpoint and add `isTv`**

Replace:
```js
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
```
With:
```js
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px only
  const tier     = useDeviceTier();
  const isTv     = tier === 'tv';
```

- [ ] **Step 3: Remove `isAndroid` gate from `navItems` — Downloads on all platforms**

Replace:
```js
  const navItems = useMemo(() => [
    { id: 0, title: 'Home',       route: Constants.DB_CINEMA_BROWSE_ROUTE, icon: <HomeIcon /> },
    { id: 1, title: 'Movies',     route: Constants.DB_CINEMA_MOVIES_ROUTE, icon: <MovieIcon /> },
    { id: 2, title: 'TV Shows',   route: Constants.DB_CINEMA_SERIES_ROUTE, icon: <TvIcon /> },
    { id: 3, title: 'Categories', route: null,                              icon: null },
    ...(isAndroid ? [{ id: 4, title: 'Downloads', route: Constants.DB_DOWNLOAD_QUEUE_ROUTE, icon: <DownloadNavIcon /> }] : []),
  ], [isAndroid]);
```
With:
```js
  const navItems = useMemo(() => [
    { id: 0, title: 'Home',       route: Constants.DB_CINEMA_BROWSE_ROUTE, icon: <HomeIcon /> },
    { id: 1, title: 'Movies',     route: Constants.DB_CINEMA_MOVIES_ROUTE, icon: <MovieIcon /> },
    { id: 2, title: 'TV Shows',   route: Constants.DB_CINEMA_SERIES_ROUTE, icon: <TvIcon /> },
    { id: 3, title: 'Categories', route: null,                              icon: null },
    { id: 4, title: 'Downloads',  route: Constants.DB_DOWNLOAD_QUEUE_ROUTE, icon: <DownloadNavIcon /> },
  ], []);
```

- [ ] **Step 4: Update `bottomNavItems` — Downloads for all (remove isAndroid gate)**

Replace:
```js
  const bottomNavItems = useMemo(() => [
    { id: 0,  title: 'Home',      route: Constants.DB_CINEMA_BROWSE_ROUTE, icon: <HomeIcon /> },
    { id: 1,  title: 'Movies',    route: Constants.DB_CINEMA_MOVIES_ROUTE, icon: <MovieIcon /> },
    { id: 2,  title: 'Shows',     route: Constants.DB_CINEMA_SERIES_ROUTE, icon: <TvIcon /> },
    { id: 99, title: 'Search',    route: null,                              icon: <SearchIcon /> },
    ...(isAndroid ? [{ id: 4, title: 'Downloads', route: Constants.DB_DOWNLOAD_QUEUE_ROUTE, icon: <DownloadNavIcon /> }] : []),
  ], [isAndroid]);
```
With:
```js
  const bottomNavItems = useMemo(() => [
    { id: 0,  title: 'Home',      route: Constants.DB_CINEMA_BROWSE_ROUTE, icon: <HomeIcon /> },
    { id: 1,  title: 'Movies',    route: Constants.DB_CINEMA_MOVIES_ROUTE, icon: <MovieIcon /> },
    { id: 2,  title: 'Shows',     route: Constants.DB_CINEMA_SERIES_ROUTE, icon: <TvIcon /> },
    { id: 99, title: 'Search',    route: null,                              icon: <SearchIcon /> },
    { id: 4,  title: 'Downloads', route: Constants.DB_DOWNLOAD_QUEUE_ROUTE, icon: <DownloadNavIcon /> },
  ], []);
```

- [ ] **Step 5: Add Filter to desktop right side**

In the `/* RIGHT */` Box (around line 461), the current desktop shows Bell + Search. Add Filter:

```jsx
          {/* RIGHT */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0 }}>
            {/* Bell — all screen sizes */}
            {iconBtn(handleBellClick, (
              <Badge
                badgeContent={unreadCount > 0 ? unreadCount : null}
                color="error"
                max={99}
                sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16, minWidth: 16, p: '0 4px' } }}
              >
                <BellIcon sx={{ fontSize: '1.3rem' }} />
              </Badge>
            ))}

            {/* Filter — mobile top bar AND desktop */}
            {iconBtn(
              () => setCategoryModalOpen(true),
              <TuneIcon sx={{ fontSize: '1.3rem' }} />,
              selectedCategory ? { color: theme.palette.primary.main } : {},
            )}

            {/* Search — desktop only */}
            {!isMobile && (
              iconBtn(() => setSearchActive(true), <SearchIcon sx={{ fontSize: '1.35rem' }} />)
            )}
          </Box>
```

- [ ] **Step 6: Add TV Drawer component and conditional render**

Add a `TvDrawer` component just before the `Navbar` function, then conditionally render it:

```jsx
// ─── TV Drawer (≥ 1920px + coarse pointer) ───────────────────────────────────

const TV_NAV_ITEMS = [
  { id: 0, title: 'Home',        route: (c) => c.DB_CINEMA_BROWSE_ROUTE,    icon: <HomeIcon /> },
  { id: 1, title: 'Movies',      route: (c) => c.DB_CINEMA_MOVIES_ROUTE,    icon: <MovieIcon /> },
  { id: 2, title: 'TV Shows',    route: (c) => c.DB_CINEMA_SERIES_ROUTE,    icon: <TvIcon /> },
  { id: 3, title: 'Search',      route: null,                                icon: <SearchIcon /> },
  { id: 4, title: 'Filter',      route: null,                                icon: <TuneIcon /> },
  { id: 5, title: 'Notifications', route: null,                              icon: <BellIcon /> },
  { id: 6, title: 'Downloads',   route: (c) => c.DB_DOWNLOAD_QUEUE_ROUTE,   icon: <DownloadIcon /> },
];

function TvDrawer({ activeId, unreadCount, onSearch, onFilter, onBell, onNavigate }) {
  const [expanded, setExpanded] = React.useState(false);
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: expanded ? 220 : 72,
        zIndex: 1300,
        bgcolor: alpha(theme.palette.common.black, 0.92),
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        display: 'flex',
        flexDirection: 'column',
        pt: 6, pb: 4, // overscan top/bottom
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}
      onFocus={() => setExpanded(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setExpanded(false); }}
    >
      {TV_NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        const icon = item.id === 5
          ? (
            <Badge badgeContent={unreadCount > 0 ? unreadCount : null} color="error">
              <BellIcon />
            </Badge>
          )
          : item.icon;

        return (
          <ButtonBase
            key={item.id}
            tabIndex={0}
            focusRipple
            onClick={() => {
              if (item.id === 3) { onSearch?.(); setExpanded(false); }
              else if (item.id === 4) { onFilter?.(); setExpanded(false); }
              else if (item.id === 5) { onBell?.(); setExpanded(false); }
              else if (item.route) { onNavigate?.(item.route(Constants)); setExpanded(false); }
            }}
            sx={{
              display: 'flex', alignItems: 'center',
              gap: 2,
              px: 3,          // 24px = overscan-safe left
              py: 1.5,
              minHeight: 56,
              color: isActive ? '#fff' : alpha('#fff', 0.55),
              bgcolor: isActive ? alpha(theme.palette.primary.main, 0.18) : 'transparent',
              borderLeft: isActive ? `4px solid ${theme.palette.primary.main}` : '4px solid transparent',
              transition: 'background 0.15s, color 0.15s',
              '&:focus-visible': {
                outline: `4px solid ${theme.palette.primary.main}`,
                outlineOffset: '-4px',
                color: '#fff',
                bgcolor: alpha(theme.palette.primary.main, 0.12),
              },
              '&:hover': {
                color: '#fff',
                bgcolor: alpha('#fff', 0.06),
              },
              justifyContent: 'flex-start',
              flexShrink: 0,
            }}
          >
            <Box sx={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>
              {icon}
            </Box>
            <Typography
              sx={{
                fontSize: '1rem', fontWeight: isActive ? 700 : 400,
                opacity: expanded ? 1 : 0,
                transition: 'opacity 0.2s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {item.title}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 7: Wrap the existing JSX return to conditionally render TV drawer vs normal nav**

In the `Navbar` component's `return`, wrap the `<>` with a TV check:

```jsx
  if (isTv) {
    return (
      <>
        <TvDrawer
          activeId={selectedNav?.id ?? 0}
          unreadCount={unreadCount}
          onSearch={() => setSearchActive(true)}
          onFilter={() => setCategoryModalOpen(true)}
          onBell={(e) => setBellAnchorEl(e?.currentTarget ?? document.body)}
          onNavigate={(route) => { navigate(route); }}
        />
        {/* Page content offset for drawer width */}
        <Box sx={{ ml: '72px' }} />

        <CategoryModal
          open={categoryModalOpen}
          categories={categoryList}
          selectedCategory={selectedCategory}
          onSelect={handleCategorySelect}
          onClear={handleClearCategory}
          onClose={() => setCategoryModalOpen(false)}
          appBarHeight={0}
        />
        <NotificationPanel
          anchorEl={bellAnchorEl}
          onClose={handleBellClose}
          onUnreadClear={handleUnreadClear}
        />
        <AnimatePresence>
          {searchActive && <SearchOverlay onClose={() => setSearchActive(false)} />}
        </AnimatePresence>
      </>
    );
  }
```

The existing non-TV `return` stays below this early-return.

- [ ] **Step 8: Add `ButtonBase` to the MUI import at the top of navbar/index.js**

Ensure `ButtonBase` is in the MUI import (it's already there — check line 15).

- [ ] **Step 9: Commit**

```bash
git add db-world-frontend/src/features/cinema/navbar/index.js
git commit -m "feat(cinema): Navbar — fix mobile breakpoint, TV drawer, Downloads on all platforms"
```

---

### Task 8: CinemaPage — wire rail.type, use new RailSkeleton

**Files:**
- Modify: `db-world-frontend/src/features/cinema/screens/CinemaPage/CinemaPage.jsx`

- [ ] **Step 1: Replace the inline `RailSkeleton` with the new component**

Remove the inline `RailSkeleton` definition (lines 66–80) and add this import at the top of the file (after the existing imports):
```js
import RailSkeleton from '../../components/RailRow/RailSkeleton';
```

- [ ] **Step 2: Pass `rail.type` to RailRow and remove heuristic props**

Replace the `<RailRow ... />` call inside `remainingRails.map(...)` (lines 243–259):

```jsx
            {remainingRails.map((rail) => (
              <RailRow
                key={rail.id}
                rail={rail}
                category={category}
                interactions={interactions}
                onWatchlist={handleWatchlist}
                onLike={handleLike}
                onLove={handleLove}
                onWatched={handleWatched}
                onExplore={handleExploreAll}
                eager={false}
              />
            ))}
```

No `wide`, `top10`, or `expandOnHover` props — `RailRow` now reads everything from `rail.type` via the config.

- [ ] **Step 3: Update the loading skeleton section to pass default type**

The existing loading section uses `<RailSkeleton />` three times. Keep them — the new `RailSkeleton` defaults to `type="standard"` which is correct for the loading state before rail metadata is known.

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/src/features/cinema/screens/CinemaPage/CinemaPage.jsx
git commit -m "feat(cinema): CinemaPage — use config-driven RailRow, import new RailSkeleton"
```

---

### Task 9: Verify end-to-end

- [ ] **Step 1: Start dev server**

```bash
cd db-world-frontend && npm run dev
```

- [ ] **Step 2: Verify desktop (Chrome ≥ 960px)**
  - Cinema page loads with rail rows
  - Rail header shows title + scroll indicator (for finite rails) + "Explore All →" on hover
  - Cards show hover popup after 380ms
  - Prime rail expands in-place on hover
  - Top 10 rail shows rank numerals
  - Navbar shows desktop AppBar with Bell, Filter, Search, Downloads

- [ ] **Step 3: Verify mobile (DevTools < 600px)**
  - Top bar visible: Logo | "Home"/"Movies"/"Series" | Filter + Bell
  - Bottom pill: Home, Movies, Series, Search, Downloads (5 items)
  - Cards are tappable, no hover popups
  - Skeletons match card shapes

- [ ] **Step 4: Verify tablet (DevTools 600–959px)**
  - Desktop AppBar renders (not the mobile two-bar)
  - Cards use tablet tier sizes from config

- [ ] **Step 5: Verify TV (DevTools ≥ 1920px, set pointer: coarse in emulation)**
  - Left drawer renders (72px collapsed)
  - Focus on drawer item → expands to 220px with labels
  - Rail cards show focus ring on keyboard Tab, scale 1.08×

- [ ] **Step 6: Verify large system font (Android DevTools font scale 130–200%)**
  - Card title overlay text does not clip (uses clamp rem)
  - HeroBannerMobile poster does not push buttons off screen
  - Bottom pill labels do not overflow pill height (labels use px not rem)

- [ ] **Step 7: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(cinema): address visual regressions from redesign verification"
```
