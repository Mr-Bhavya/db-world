# DB World Home Page & Header Redesign

**Date:** 2026-03-28
**Status:** Approved

---

## Overview

Complete redesign of `Home.js` and `Header.js` (replaced in place). Style: dark glassmorphism — dark base, frosted glass cards, teal (`#0d9488`) accents, subtle gradients. Stack: MUI v7 + Framer Motion + React Router v6. Fully responsive across all screen sizes.

---

## Files Changed

| File | Action |
|------|--------|
| `src/shared/components/layout/Home.js` | Full rewrite |
| `src/shared/components/layout/Header.js` | Full rewrite |

No new files, no route changes.

---

## Design Tokens

```
Background base:    #0a0a0f
Background alt:     #0d1a1a
Teal accent:        #0d9488
Teal hover:         #0f766e
Teal glow:          rgba(13,148,136,0.15)
Glass card bg:      rgba(255,255,255,0.04)
Glass card border:  rgba(255,255,255,0.08)
Glass card hover:   rgba(255,255,255,0.07)
Header solid:       rgba(10,10,15,0.85)
Text primary:       #f1f5f9
Text muted:         rgba(241,245,249,0.55)
Text faint:         rgba(241,245,249,0.35)
Footer bg:          rgba(255,255,255,0.03)
Footer border:      rgba(255,255,255,0.06)
```

---

## Section 1 — Header

### Behaviour
- Sticky (`position: fixed`, full width, `z-index: 1200`)
- **Transparent** (`background: transparent`) when scrolled to top of hero
- **Solid glass** (`rgba(10,10,15,0.85) + backdrop-filter: blur(16px) + border-bottom: 1px solid rgba(255,255,255,0.06)`) once user scrolls past ~80px
- Transition: smooth CSS `transition: background 0.3s, backdrop-filter 0.3s`

### Layout (desktop, ≥ md)
```
[ DB World logo ]     [ Cinema · Weather · Games · Password Manager ]     [ Avatar ▾ ]
```
- Logo: teal circle icon + "DB World" bold white text, links to `/db-world`
- Nav links: flat text buttons, teal underline on active route, teal colour on hover
- Avatar: MUI `Avatar` with user initial, opens dropdown menu

### Dropdown menu (authenticated)
- My Profile → `/db-world/user-profile`
- Admin Console → `/db-world/admin` (visible only for ADMIN / OWNER role)
- Divider
- Sign Out

### Dropdown (guest / unauthenticated)
- Login → `/db-world/login`
- Register → `/db-world/registration`

### Layout (mobile, < md)
- Logo left, hamburger icon right
- Hamburger opens a full-height `Drawer` from the right containing nav links + auth actions stacked vertically

### Responsiveness
- Nav links hidden below `md` breakpoint
- Drawer closes on nav item click

---

## Section 2 — Hero

### Container
- `min-height: 100vh`, dark gradient background: `linear-gradient(135deg, #0a0a0f 0%, #0d1a1a 60%, #0a0f0f 100%)`
- Teal radial glow: `radial-gradient(ellipse 60% 50% at 60% 40%, rgba(13,148,136,0.12) 0%, transparent 70%)` layered on top
- Subtle animated background: Framer Motion `animate` on the glow opacity (0.08 ↔ 0.18, 6s loop)
- Padding top accounts for fixed header height (64px desktop, 56px mobile)

### Content (vertically + horizontally centred)
1. **Greeting** — `Typography variant="h2"` (desktop) / `h3` (mobile):
   `"Welcome back, [firstName]"` or `"Welcome back"` for guests
   Framer Motion: `initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6 }}`

2. **Subtitle** — `"Your personal media universe — everything in one place."`
   Muted colour, slightly delayed entrance animation

3. **Last opened chip** (only if localStorage has history):
   Teal-tinted `Chip` with app icon: *"Continue: DB Cinema →"*
   Click navigates directly to that app's route
   Framer Motion fade-in with 0.3s delay

4. **CTA buttons** (stacked on mobile, inline on desktop):
   - Primary: MUI `Button variant="contained"` teal — "Open Cinema" → `DB_CINEMA_BROWSE_ROUTE`
   - Ghost: MUI `Button variant="outlined"` teal — "Explore Apps" → smooth scroll to app grid section

### Scroll indicator
- Small animated chevron-down at the bottom of the hero, fades out on scroll

---

## Section 3 — App Grid

### Container
- `id="apps"` (scroll target from hero CTA)
- `padding: 80px 24px` desktop, `48px 16px` mobile
- Section label: small teal uppercase `"YOUR APPS"`, bold `h5` title `"Everything in one place"`

### Cards
Four app cards (+ Admin card shown only to ADMIN/OWNER):

| App | Icon | Route |
|-----|------|-------|
| DB Cinema | `MovieFilter` | `DB_CINEMA_BROWSE_ROUTE` |
| DB Weather | `WbSunny` | `DB_WEATHER_ROUTE` |
| DB Games | `SportsEsports` | `DB_GAMES_ROUTE` |
| Password Manager | `Lock` | `DB_PASSWORD_MANAGER_ROUTE` |
| Admin Console | `AdminPanelSettings` | `DB_ADMIN_BASE_ROUTE/dashboard` |

### Card design
- Background: `rgba(255,255,255,0.04)`, border: `1px solid rgba(255,255,255,0.08)`, `border-radius: 16px`
- Hover: `rgba(255,255,255,0.07)` bg + `border-color: rgba(13,148,136,0.4)` + teal box-shadow glow
- Content: teal icon (40px), app name (`h6`), short description (`body2` muted), arrow icon bottom-right
- Framer Motion stagger: `transition={{ delay: index * 0.08 }}`

### Grid
- Desktop (≥ lg): 4 columns
- Tablet (md–lg): 2 columns
- Mobile (< md): 1 column (full width cards, side-by-side icon + text layout on xs)

### Recent Activity tracking
- On card click: save `{ appId, route, timestamp }` to `localStorage` key `dbworld_recent`
- Keep last 5 entries, deduplicated by appId

---

## Section 4 — Recent Activity

### Visibility
- Hidden if `localStorage` has no history
- Shown between App Grid and Footer

### Layout
- Section title: `"Continue where you left off"`
- Horizontal scroll row of mini-cards (up to 3 most recent)
- Each mini-card: app icon + app name + relative timestamp (`"2 hours ago"`)
- Glassmorphic style consistent with app grid cards but smaller (compact height)
- Click navigates to that app's route

---

## Section 5 — Footer

### Layout (single row, wraps on mobile)
- Left: DB World logo (icon + text, links to `/db-world`)
- Center: version string (e.g. `"v2.0"`) in faint text
- Right: empty or placeholder for future links

### Style
- Background: `rgba(255,255,255,0.03)`
- Top border: `1px solid rgba(255,255,255,0.06)`
- Padding: `24px`
- Text colour: faint (`rgba(241,245,249,0.35)`)

---

## Responsiveness Summary

| Breakpoint | Header | Hero | App Grid |
|------------|--------|------|----------|
| xs (< 600px) | Logo + hamburger drawer | h3 greeting, stacked CTAs | 1 col |
| sm (600–900px) | Logo + hamburger drawer | h3 greeting, stacked CTAs | 2 col |
| md (900–1200px) | Full nav | h2 greeting, inline CTAs | 2 col |
| lg (≥ 1200px) | Full nav | h2 greeting, inline CTAs | 4 col |

---

## Animation Summary

| Element | Animation |
|---------|-----------|
| Hero greeting | fade up, 0.6s, on mount |
| Hero subtitle | fade up, 0.7s delay 0.1s |
| Hero chip | fade in, delay 0.3s |
| Hero CTAs | fade up, delay 0.4s |
| App cards | stagger fade up, 80ms between each |
| Recent cards | stagger fade in, 60ms between each |
| Header bg | CSS transition 0.3s on scroll |
| Hero glow | Framer Motion loop 6s |
| Scroll chevron | Framer Motion bounce loop, fade out on scroll |

---

## Out of Scope

- Cinema navbar (separate component, not touched)
- Admin layout (already redesigned)
- Login / Registration pages
- Any backend changes
