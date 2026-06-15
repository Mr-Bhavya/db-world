# Cinema Page Redesign & Optimization

**Date:** 2026-06-15  
**Branch:** feat/cinema-redesign (new off dev_acc)  
**Scope:** Rail Type Config, RailRow, RailSkeleton, RecordCard, Navbar (3 variants), HeroBanner optimization  
**Goal:** Full device compatibility — Android phones, tablets, desktops, monitors, smart TVs

---

## 1. Approach

**Config-first (Approach B):** A single `RAIL_TYPE_CONFIG` object encodes all card dimensions, behaviors, and skeleton shapes per type × device tier. Every component reads from this config — no hardcoded values inline. The config shape mirrors what the rail API will return later, so the frontend→API migration is just swapping a local import for a fetch.

---

## 2. Device Tiers

| Tier | Breakpoint | Target Devices |
|------|-----------|----------------|
| `mobile` | `< 600px` | Android phones |
| `tablet` | `600–959px` | Tablets, small Android |
| `desktop` | `960–1919px` | Laptops, monitors |
| `tv` | `≥ 1920px` + coarse pointer | Smart TVs, large displays |

Detection: `useDeviceTier()` hook reads MUI breakpoint + `window.matchMedia('(pointer: coarse)')` to distinguish touch tablet from TV.

---

## 3. Rail Type Config

**File:** `src/features/cinema/components/RailRow/railTypeConfig.js`

```js
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
}

export const RAIL_TYPE_DEFAULT = 'standard'
```

**Tier values are card heights in px.** Aspect ratio drives width. All text uses `rem`/`em`, never `px`. Card containers use `min-height` not `height`.

**Rail DTO change:** Add `type: string` field (one of the keys above). Frontend falls back to `'standard'` if absent, enabling a clean zero-migration path.

---

## 4. Rail Type Visual Behaviour

| Type | Card shape | Hover (desktop) | TV interaction | Notes |
|------|-----------|-----------------|----------------|-------|
| `standard` | 2:3 poster | Popup at 380ms | Focus ring + metadata overlay | Default row |
| `wide` | 16:9 backdrop | Popup at 380ms | Focus + resume button | Progress bar overlay |
| `prime` | 9:16 → 16:9 expand | Expand in-place, shift neighbors | Focus shows landscape | One per page |
| `top10` | 2:3 + rank glyph | Popup at 380ms | Rank glyph scales to TV tier | "Top 10 in [Region]" header |
| `jumbo` | 2:3 oversized (all cards uniform) | Popup at 380ms | Focus ring + metadata overlay | ~1.4× standard height |
| `continue` | 16:9 + progress bar | Popup + resume button | Focus + resume on select | Shows `watchedPercent` |
| `person` | 1:1 circle crop | Name tooltip only | Name always visible | Cast spotlight rows |
| `billboard` | 16:9 full-width snap | No hover | Arrow-key snappable | No header row |

---

## 5. RailRow

### Header row layout
```
[Rail Title]    [──── scroll track ────] [Explore All →]
```

- **Scroll indicator**: thin 2px track with moving thumb, driven by scroll position. Shown **only when `rail.infiniteScroll === false`**. Hidden for infinite rails.
- **"Explore All →"**: fades in on hover (desktop), always visible on TV, hidden on mobile.
- **Arrow buttons**: desktop only (hidden on mobile, TV uses D-pad).
- **Rail padding**: `clamp(12px, 4vw, 48px)` left/right — covers phone to TV overscan automatically.
- **Gap between cards**: from `RAIL_TYPE_CONFIG` per type, in `rem`.
- **Title font**: `clamp(0.95rem, 1.5vw, 1.4rem)`, `font-weight: 600`.

### Scroll behaviour
- `billboard` type: CSS scroll-snap, one card at a time.
- All others: free horizontal scroll with arrow buttons on desktop.
- Scroll position persisted in sessionStorage keyed by `cinema_rail_h_{railId}` (unchanged).

---

## 6. RailSkeleton

One skeleton shape per `skeleton` key in config:

| Skeleton | Shape |
|----------|-------|
| `poster` | 2:3 rounded rect pulse |
| `backdrop` | 16:9 rounded rect pulse |
| `portrait` | 9:16 rounded rect pulse |
| `top10` | 2:3 rect + large numeral ghost left |
| `circle` | Circle pulse + name line below |

- Count: `min(rail.limitSize, 8)`.
- Dimensions match exact card size for current tier — zero layout shift on load.
- `prefers-reduced-motion`: static grey, no pulse animation.

---

## 7. RecordCard

Card dimensions read from `RAIL_TYPE_CONFIG[type].tiers[tier]` — zero hardcoded sizes inside the component.

### Interaction model by tier

| Tier | Tap/Click | Hover |
|------|-----------|-------|
| `mobile` | Open detail sheet | None |
| `tablet` | Open detail sheet | None |
| `desktop` | Open detail modal | Per type (popup / expand / name / none) |
| `tv` | Open detail (full page) | None — focus-only |

### TV focus state
- Card scales `1.08×` on D-pad focus.
- Metadata overlay appears: title + year + rating.
- Focus ring: `4px solid accent, 4px offset`.
- No hover popup on TV.

### Progress bar (`wide`, `continue`)
- 4px height, bottom of card, accent color.
- Hidden when `watchedPercent === 0` or `=== 100`.

### Rank glyph (`top10`)
- Bebas Neue, WebKit stroked, size from config per tier.
- Negative left margin to tuck behind edge.

### Font scaling safety
- Card title overlay: `clamp(0.7rem, 2vw, 1rem)`.
- All text containers: `min-height` not `height`, `overflow: visible` for metadata.
- Hover popup: `rem` units throughout, `max-height: 80vh` with scroll fallback.

---

## 8. Navbar

### Mobile (< 600px) — two bars

**Top bar** (fixed, slim, transparent over hero / blur-on-scroll):
- Left: DB World logo
- Center: Current page name (Home / Movies / Series)
- Right: Filter icon + Notifications icon (with unread badge)

**Bottom pill** (floating, fixed, blur backdrop):
- 5 slots: Home, Movies, Series, Search, Downloads
- Active state: filled icon + small label below (in `rem`, won't overlap at large font sizes)
- `safe-area-inset-bottom` respected

### Desktop (600px–1919px) — top AppBar

- Logo left | Nav links center (Home, Movies, Series) | Search + Filter + Notifications + Downloads right
- Active link: underline dot indicator
- Transparent over hero, `backdrop-filter: blur(8px)` + semi-transparent when scrolled
- Downloads included (has its own route)

### TV (≥ 1920px + coarse pointer) — left drawer

- Collapsed: 72px wide (icons only)
- Expanded: 220px (icon + label slide in)
- Expands on D-pad left, collapses on D-pad right or item select
- Items: Home, Movies, Series, Search, Filter, Notifications, Downloads
- Focus rings: `4px solid accent, 4px offset`
- Overscan padding: 48px left, 48px top/bottom
- No hover — focus-only

---

## 9. HeroBanner (Optimization)

Structural files unchanged (`HeroBanner.jsx`, `HeroBannerDesktop.jsx`, `HeroBannerMobile.jsx`, `heroUtils.jsx`).

### Desktop changes
- Add `tablet` tier (600–959px) between mobile and desktop.
- TV tier: title `clamp(3rem, 5.5vw, 7rem)`, buttons 64px, overscan-safe left padding 48px.
- All font sizes: pure `clamp(min-rem, vw, max-rem)` — no mixed `px`/`vw`.
- Bottom gradient deepened for better legibility on bright backdrops.

### Mobile changes
- Poster width: `clamp` in `rem`-equivalent — large system fonts don't push buttons off screen.
- Title/metadata area: `min-height` not fixed height — content grows down, never clips.
- Swipe threshold stays 42px (touch, not font-dependent).

### Both variants
- Auto-cycle pauses on `document.visibilityState === 'hidden'`.
- Progress dots: `min-width: 6px` — always tappable regardless of font scale.
- `prefers-reduced-motion`: disables auto-cycle + crossfade, shows static first record.

---

## 10. Accessibility — Font Scaling

Hard requirement throughout all components:

- **No `px` for font sizes** — use `rem`, `em`, or `clamp(rem, vw, rem)`.
- **No fixed `height` on text containers** — use `min-height` so content reflows at 130–200% system font.
- **No `overflow: hidden` on metadata** — use `overflow: visible` or `auto` with `max-height`.
- **Tap targets**: minimum `44×44px` (CSS pixels), enforced via `min-width`/`min-height`.
- **Focus visible**: all interactive elements have explicit `:focus-visible` ring styles.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all transitions and auto-cycles.

---

## 11. Files Changed / Created

| File | Action |
|------|--------|
| `components/RailRow/railTypeConfig.js` | **New** — type config only |
| `hooks/useDeviceTier.js` | **New** — `useDeviceTier()` hook (shared by RailRow, RecordCard, Navbar) |
| `components/RailRow/RailRow.jsx` | **Update** — read from config, scroll indicator, header layout |
| `components/RailRow/RailSkeleton.jsx` | **Update** — shape from config, tier-matched dimensions |
| `components/RecordCard/RecordCard.jsx` | **Update** — dimensions from config, TV focus state, font scaling |
| `components/HeroBanner/HeroBannerDesktop.jsx` | **Update** — tablet tier, TV fix, clamp fonts |
| `components/HeroBanner/HeroBannerMobile.jsx` | **Update** — min-height, clamp widths |
| `navbar/index.js` | **Update** — split into 3 variants driven by `useDeviceTier()` |
| `screens/CinemaPage/CinemaPage.jsx` | **Update** — pass `type` from rail DTO, remove heuristic detection |

---

## 12. Out of Scope

- Backend rail DTO `type` field (frontend defaults to `'standard'` until added)
- RecordDetailPage / bottom sheet / player (separate concerns)
- WatchlistRailRow (will inherit RailRow changes automatically)
- Search overlay
