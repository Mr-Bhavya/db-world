# Cinematic Frontend Redesign — Design Spec
**Date:** 2026-04-20
**Scope:** Header, Home Page (all sections), Footer, Error Page
**Style:** Cinematic / streaming-platform (Netflix/Prime Video feel for a personal app hub)
**Animation level:** Medium polish — scroll-triggered reveals, hover effects, no heavy video
**Theme:** Fully dark/light aware via `useT()` tokens — no hardcoded colors
**Screens:** Mobile, tablet, desktop, large monitor (all breakpoints)

---

## 1. Shared Primitives

### 1.1 BokehBackground component
A reusable lightweight background layer used in both the Hero and ErrorPage.

**Layers (bottom → top):**
1. `T.bg` base fill
2. Two drifting radial gradient orbs (teal `#0d9488` and indigo `#4f46e5`) on a 30s looping framer-motion path — not mouse-tracked, purely CSS-like loop
3. CSS film grain overlay via an SVG `feTurbulence` filter pseudo-element at ~3% opacity — essentially zero weight
4. Bottom vignette: gradient fade from transparent → `T.bg` at the base edge

**Bokeh dots:** 6–8 small circles (4–16px), opacity 0.15–0.4, drifting upward on staggered loops. Reduced to 3 dots on mobile via `useMediaQuery`.

**Props:** `children`, `vignette: boolean`, `height: string` (defaults to `'100vh'`)

### 1.2 SectionHeading component
Cinematic section heading used across all Home sections.

**Structure:** Short teal left-border accent bar (3px wide, 20px tall) + all-caps label + hairline `<hr>` extending right.

**Animation:** `whileInView` slide-in from left, `once: true`, 0.4s ease-out.

### 1.3 StaggerContainer / StaggerItem
Reusable framer-motion container + item pair for staggered entrance animations.
- Container: `staggerChildren: 0.07`, `delayChildren: 0.1`
- Item: `opacity 0→1`, `y 20→0`, spring `stiffness: 120, damping: 14`
- Triggered via `whileInView`, `once: true`

---

## 2. Header

**File:** `src/shared/components/layout/Header.js`

### Logo
- Text "DB World" with teal gradient (`#0d9488 → #14b8a6`) via `background-clip: text`
- A play-circle or film-reel MUI icon to the left, teal colored
- One-time glow pulse animation on mount (opacity 0.6→1→0.6, 0.8s, plays once)

### Desktop nav links
- Same links: Cinema, Weather, Games, Password Manager
- Hover state: underline becomes a teal glow bar (`box-shadow` spread) instead of flat line
- Active link: faint `T.tealBg` pill background behind the text
- Transition: 0.2s ease

### Scroll behavior
- At `scrollY === 0`: fully transparent, no border
- On scroll: `backdropFilter: blur(12px)`, `T.bg` at ~85% opacity, 1px bottom border `T.glassBorder`
- Transition: 0.3s ease — same mechanism as current, cleaner execution

### Theme toggle
- Keep existing toggle but add sun↔moon icon swap: rotate 180° + scale 0→1, spring 0.3s

### Mobile drawer
- `T.bg` background
- Logo at the top of the drawer
- Nav links as large spaced rows (48px height), teal accent on active
- A 2px teal vertical line animates `scaleY` from 0→1 (0.3s) on drawer open

---

## 3. Home Page

**File:** `src/shared/components/layout/Home.js`

### 3.1 Hero Section
**Height:** `100vh` desktop, `85vh` mobile/tablet

**Background:** `BokehBackground` component (see §1.1) with `vignette: true`

**Content layout:** Left-aligned on desktop (max-width 600px), centered on mobile

**Content elements (staggered entrance, spring physics):**
1. Eyebrow: all-caps `"YOUR PERSONAL UNIVERSE"`, `T.textMuted`, wide letter-spacing, fades in first (delay 0)
2. Headline: `"Welcome back, [firstName]"` — large bold, `T.textPrimary`, slides up (delay 0.15s). `firstName` comes from the existing auth context/user state; fallback to `"back"` if unauthenticated (becomes `"Welcome back"`)
3. Subline: one-sentence platform description, `T.textMuted`, slides up (delay 0.25s)
4. CTA buttons row (delay 0.35s):
   - Primary: "Browse Cinema" — teal filled, hover glow (`box-shadow teal 0 0 16px`), navigates to `Constants.DB_CINEMA_BROWSE_ROUTE`
   - Secondary: "Open Vault" — glass outline (`T.glassBorder` border, transparent bg), hover: `T.tealBg` fill, navigates to `Constants.DB_PASSWORD_MANAGER_ROUTE`
5. Scroll indicator: thin animated line extending downward, fades in after 1.5s delay

**Bokeh dots:** From `BokehBackground` (3 on mobile, 6–8 on desktop)

### 3.2 Favorites Section
**Heading:** `SectionHeading` component with label "Favorites"

**Layout:**
- Desktop: wrapping flex row
- Mobile: horizontal scrollable row (no wrap, `-webkit-overflow-scrolling: touch`)

**Favorite cards:** Pill-shaped, compact (icon + app name)
- Each app has a unique accent color: Cinema=`#ef4444`, Weather=`#38bdf8`, Games=`#a855f7`, PasswordManager=`#0d9488`, Admin=`#f59e0b`
- Active/favorited: glows with its accent color (`box-shadow`)
- Bookmark icon (filled/outlined) replaces star icon for toggle
- Entrance: `StaggerContainer` / `StaggerItem` on scroll-entry

### 3.3 All Apps Grid
**Heading:** `SectionHeading` component with label "All Apps"

**Grid:** 1 col mobile → 2 col tablet → 3–4 col desktop (MUI Grid or CSS grid)

**App cards:**
- Top colored band (app accent color, ~80px height) with centered app icon + soft glow matching band color
- App name + short description below in `T.bg` / `T.glass` area
- Hover: `translateY(-4px)`, band brightens, inner glow radiates (`box-shadow`, 0.25s ease)
- Border: `T.glassBorder`, border-radius: 16px
- Entrance: `StaggerContainer` / `StaggerItem` on scroll-entry, `staggerChildren: 0.07`

**App accent colors:** Cinema=`#ef4444`, Weather=`#38bdf8`, Games=`#a855f7`, PasswordManager=`#0d9488`, Admin=`#f59e0b`

### 3.4 Recent Activity Section
**Heading:** `SectionHeading` component with label "Recent Activity"

**Desktop layout:** Timeline — thin vertical teal line, circular dot for each entry (app icon inside dot), timestamp + app name to the right. Entries stagger in on scroll-entry.

**Mobile layout:** Horizontal scrollable chip row — each chip is icon + app name + relative time.

**Data source:** Unchanged — existing `localStorage` key `dbworld_recent`

### 3.5 About Modal
- Keep existing trigger (button or link)
- Modal: dark cinematic backdrop (`rgba(0,0,0,0.7)` blur overlay)
- Content panel: `T.glass` + `T.glassBorder` + `backdropFilter: blur(16px)`, slides up on open (spring animation), close button top-right
- No structural content changes

---

## 4. Footer

**File:** `src/shared/components/layout/Footer.js`

**Height:** ~56px desktop, ~80px mobile (two-line stacked)

**Top accent:** A 1px line, gradient `teal → transparent`, `scaleX` animates 0→1 on scroll-entry (0.6s ease-out, `once: true`)

**Desktop layout (single row):**
- Left: `© 2026 DB World` — `T.textFaint`, 12px
- Center: version pill badge — `T.glassBorder` border, `T.textFaint` text, 11px. Version string hardcoded as a constant (e.g. `APP_VERSION = "1.0.0"`) in the Footer component; no dynamic fetch needed
- Right: theme toggle button (same sun/moon animation as header)

**Mobile layout (two lines, centered):**
- Line 1: copyright + version pill
- Line 2: theme toggle

**Background:** `T.bg`, no additional effects — intentionally minimal

---

## 5. Error Page

**File:** `src/shared/components/layout/ErrorPage.js`

**Full page background:** `BokehBackground` component (same as Hero) — fully theme-aware, replaces hardcoded `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`

**Content card:**
- Centered, `max-width: 480px`, `width: 90%`
- `T.glass` + `T.glassBorder` + `backdropFilter: blur(16px)` + `border-radius: 24px`
- Padding: 48px desktop, 32px mobile

**Card content (staggered spring entrance):**
1. "404" — large bold, gradient text (`#0d9488 → #4f46e5`), each digit scales in with spring stagger (0.1s between digits)
2. Headline: `"Lost in the void"` — `T.textPrimary`, slides up
3. Subline: `"This page doesn't exist in any dimension."` — `T.textMuted`, slides up
4. Buttons row:
   - "Go Home" — teal filled, hover glow
   - "Login" — glass outline, hover `T.tealBg` fill

**No hardcoded colors anywhere** — all values from `useT()` tokens

---

## 6. Implementation Notes

### Dependencies
- All existing: `framer-motion`, `@mui/material`, `useT()`, `T` tokens — no new packages needed
- `useMediaQuery` from MUI for responsive bokeh dot count

### Theme compliance
- Every color value must come from `T.*` token or a fixed accent color listed in §3.2 (app accent colors are intentionally fixed — they are brand colors, not theme-dependent)
- `BokehBackground` orb colors (teal + indigo) are fixed brand colors. In light mode, orb opacity is reduced to 0.12 (vs 0.25 dark) and film grain opacity to 1.5% so the effect is soft on a white background without looking muddy

### Performance
- Film grain: SVG filter pseudo-element, no image file
- Bokeh: 3–8 `div` elements with CSS `border-radius: 50%` and framer-motion transforms only — no canvas
- All scroll animations use `whileInView` with `once: true` — not re-triggered on scroll back up
- No video, no large images, no external image URLs for structural UI elements

### Files changed
1. `src/shared/components/layout/Header.js`
2. `src/shared/components/layout/Home.js`
3. `src/shared/components/layout/Footer.js`
4. `src/shared/components/layout/ErrorPage.js`

### New shared components (can live in `src/shared/components/ui/`)
- `BokehBackground.js`
- `SectionHeading.js`
- `StaggerContainer.js` + `StaggerItem.js` (or combined as `Stagger.js`)
