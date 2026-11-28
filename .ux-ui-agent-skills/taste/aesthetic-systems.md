# Aesthetic Systems: Archetypes + the Design-System Library

Taste is not one look. It is the ability to choose the *right* look for the brief and execute it with conviction. This file gives you two layers:

1. **Archetypes**: a small set of reusable aesthetic directions, each mapped to our token system. Use these to reason about *what kind* of design fits.
2. **The Library**: 2,144 concrete, named design-system specs in `design-systems/library/`. Use these when the brief points at a specific vibe (or a specific brand reference).

> Taste serves the **Aesthetics** tier of the Decision Framework. An archetype or library system may set the *visual direction* but must still pass every Accessibility, Consistency, and token rule. See [`taste/design-taste.md`](./design-taste.md) for the anti-slop doctrine and [`taste/motion-choreography.md`](./motion-choreography.md) for motion.

---

## How to Use This File

1. **Read the brief.** Infer audience, domain, and emotional tone. Don't apply a direction the brief didn't ask for.
2. **Pick a direction**: either an Archetype (below) or a named system from the library (see "Finding a system in the library").
3. **Resolve to tokens.** Translate the chosen direction's color/type/space/radius/shadow/motion into our token files (`tokens/*.json`), overriding semantic tokens where needed (see the contract below).
4. **Render** through the target framework via the [Framework Adapter Protocol](../frameworks/adapter-protocol.md).
5. **Run the pre-flight aesthetic check** in `taste/design-taste.md` before shipping.

---

## The Archetypes

Each archetype is a *recipe*, not a brand. Settings reference our existing tokens.

### 1. High-End Agency (Linear / Apple-tier)
- **When:** premium products, launches, anything that must feel expensive.
- **Type:** large display scale (`6xl` to `7xl`), tight leading, wide measure; one UI sans.
- **Color:** off-black on warm/cool near-white; single restrained accent; calibrated low-chroma.
- **Space:** generous macro-whitespace; asymmetric grids; edge tension.
- **Depth:** hairline borders + subtle layered elevation; shadows rare.
- **Motion:** precise, fast, `ease-out`; scroll-reveals with restraint.
- **Library kin:** `linear-app`, `apple`, `vercel`, `stripe`, `superhuman`, `premium`.

### 2. Editorial Minimalism
- **When:** content, docs, marketing with a literary tone.
- **Type:** serif or refined sans for headings; strict 60-75ch measure; strong scale contrast.
- **Color:** paper/ink neutrals; one ink accent.
- **Space:** column grids, lots of air, baseline rhythm.
- **Depth:** flat; rules and whitespace separate, not boxes.
- **Library kin:** `editorial`, `warm-editorial`, `kami`, `notion`, `modern`, `wired`, `publication`.

### 3. Industrial Brutalism / Tactical
- **When:** data-heavy dashboards, dev tools, declassified-blueprint vibe.
- **Type:** monospace or grotesque; extreme scale contrast; mono kickers/labels.
- **Color:** utilitarian (black/white + one signal color); analog textures optional.
- **Space:** rigid modular grids, high density, visible structure.
- **Depth:** hard edges, thick borders, no soft shadows.
- **Library kin:** `brutalism`, `neobrutalism`, `mono`, `warp`, `voltagent`, `theverge`.

### 4. Warm Soft-SaaS
- **When:** friendly consumer/productivity apps, onboarding-heavy products.
- **Type:** rounded humanist sans; medium scale contrast.
- **Color:** warm neutrals + a friendly accent; soft pastels as support.
- **Space:** comfortable padding, soft radii (`radius.lg`+), dense bento grids - tight content-rich tiles, never large mostly-empty blocks.
- **Depth:** soft shadows allowed, chunky tactile elements optional.
- **Library kin:** `duolingo`, `lingo`, `friendly`, `intercom`, `zapier`, `xiaohongshu`.

### 5. Dark-Tech / Cinematic
- **When:** AI, crypto, gaming, infra: high-drama dark surfaces.
- **Type:** tight sans or mono; bright type on dark.
- **Color:** void-black surfaces, neon/gradient accents, desaturated supporting hues.
- **Space:** bounded media at dramatic scale - the drama comes from contrast and
  type, not from filling the viewport. Cap media at `sizing.screen.media-max-block`.
- **Depth:** glow, gradient, glass, used once each, never stacked.
- **Library kin:** `elevenlabs`, `runwayml`, `cursor`, `revolut`, `spacex`, `cosmic`, `shopify`.

### 6. Morphism & Effects
- **When:** a specific tactile gimmick is the point.
- **Use the matching library spec directly** rather than improvising: `glassmorphism`, `claymorphism`, `neumorphism`, `skeumorphism`, `gradient`, `neon`. These are effect-forward and carry strict execution rules in their `DESIGN.md`.

---

## Library Contract: mapping a `DESIGN.md` to our tokens

Specs come in two shapes, and both carry the same information:

- **Measured** (2,087). YAML frontmatter holds the values - `colors`,
  `typography`, `rounded`, `spacing`, `components` - and the prose below it runs
  Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components,
  Do's and Don'ts, Responsive Behavior. Read values from the frontmatter; the
  prose says how they are used. Where the live site used an emoji or pictograph
  (a star in a rating, a heart in a footer), the spec gives its code points,
  `[U+2605]`, because the kit ships no emoji. Render it as an icon or as words,
  never as the glyph.
- **Hand-written** (57). Visual Theme, Color Palette & Roles, Typography,
  Spacing, Components and Motion, as numbered prose sections.

To apply one:

| `DESIGN.md` section | Maps to |
|---------------------|---------|
| `colors:` / Colors / Color Palette & Roles (hex + role) | Override `semantic.*` in `tokens/colors.json` (primitives stay; re-point semantic aliases). Verify every pair against `accessibility/wcag-checklist.md` contrast: **a brand hex that fails contrast must be adjusted**. |
| `typography:` / Typography (family, scale, weight) | Set families/scale in `tokens/typography.json`; keep our composite `textStyle` structure. |
| `spacing:` / Layout / Spacing | Map to `tokens/spacing.json` scale + `tokens/breakpoints.json` grid. |
| `rounded:` / Shapes / Radius / geometry | `tokens/borders.json`. |
| Elevation & Depth / shadow / effects | `tokens/shadows.json`, plus `tokens/blur.json` / `tokens/gradients.json` for morphism systems. |
| Motion | `tokens/motion.json` + `taste/motion-choreography.md`. |
| `components:` / Components | Render via component specs in `components/` through the framework adapter. |

A measured value is what the site shipped, not what this kit allows. Brand
sites use px off our 4px scale, contrast below AA, and proprietary fonts. Snap
spacing to the nearest token, fix the contrast, and substitute a licensed or
open face - then say which values you changed.

> **Non-negotiable:** library specs describe brand aesthetics, not accessibility. After applying one, re-run contrast, focus-visible, target-size, and reduced-motion checks. Taste never overrides POUR.

> **Non-negotiable:** a named system never overrides **screen economy**. Several
> specs here call for full-bleed photography or a screen-filling hero - nike and
> spacex say so outright, and they are in the library because that identity is
> worth studying. Resolving one into tokens keeps the identity (the monochrome,
> the type scale, the stark contrast) and caps the media at
> `sizing.screen.media-max-block`. A box that covers more than
> `sizing.screen.box-max-viewport-share` of the viewport still has to carry
> content. `apply-aesthetic` **states the adaptation it made** in its output - a
> silent adaptation is as bad as a silent override, because the next person
> cannot tell which happened. Measured by `scripts/verify_screen_economy.mjs`;
> the rule itself is in `taste/design-taste.md` -> Screen economy.

---

## Finding a system in the library

There are **2,144 named design systems** in `design-systems/library/`, one
`DESIGN.md` each. 2,087 of them were measured from the brand's live site; the
rest are hand-written specs, mostly style families (brutalism, claymorphism,
editorial) rather than brands.

Do not read the whole list to choose one. Narrow it first:

```bash
python3 scripts/design_systems.py search <term>    # slug, description or category
python3 scripts/design_systems.py categories       # how many in each category
python3 scripts/design_systems.py show <slug>      # one system: category, summary, path
```

An npm install carries the index (`design-systems/library.json`) and no spec.
`node scripts/library.mjs get <slug>` fetches one into
`design-systems/library/<slug>/DESIGN.md`, refuses it unless its sha256 matches
the index, and prints the path; `library.mjs pull` fetches all of them for
offline use. A clone or a plugin install already has every spec on disk.

Through the MCP server the same library is `get_design_system`. The full list,
grouped by category, is [`design-systems/catalog.md`](../design-systems/catalog.md),
generated from the folder so it cannot fall behind it.

Pick two or three candidates that match the brief's positioning, not only its
industry, read their `DESIGN.md`, and choose. A brand's own name in the brief
("make it feel like Stripe") goes straight to `show <slug>`.
