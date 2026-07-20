# Design Spec: Android Episode List + Hero Banner Optimization

**Date:** 2026-05-01  
**Branch:** `feat/android-episode-list-hero-optimize`  
**Status:** Approved

---

## Task 1 — Android Episode List with Quality Inheritance

### Goal

When a user launches the native Android video player for a TV series episode, the episode panel (already built in `VideoPlayerActivity.java`) should populate with all episodes from that record. If the user is watching in 1080p, only 1080p variants of other episodes appear in the list.

### Problem

`VideoPlayerActivity.java` already has a complete episode panel (`btnEpisodes`, `EpisodeItem`, `parseEpisodes()`, `populateEpisodePanel()`) but it only shows when the `episodesJson` launch parameter is non-empty. Neither call site passes this parameter:

- `RecordDetailPage.jsx` — `handlePlay()` launches the Android native player without `episodes`
- `CinemaPlayer.jsx` — `openAndroid()` launches the Android native player without `episodes`

The web `CinemaPlayer` already has the full logic (`parseEpisode`, `getQualityLabel`, `buildEpisodeMap`) but it is duplicated inline and never reused for the Android path.

### Approach

**Extract shared utilities → fix both call sites.**

1. **New file:** `src/features/cinema/utils/episodeUtils.js`  
   Exports three pure functions extracted from `CinemaPlayer.jsx`:
   - `parseEpisode(fileName)` — regex S##E## extraction → `{ season, episode }` or null
   - `getQualityLabel(mediaFile)` — derives `"4K"` / `"1080p"` / `"720p"` / `"SD"` from `video.resolution` or filename
   - `buildEpisodeMap(files)` — groups files by season+episode key
   
   Plus one new function:
   - `buildAndroidEpisodeList(allFiles, currentFile)` — filters `allFiles` to same quality as `currentFile`, sorts by S/E, returns `EpisodeItem[]` format `{ fileId, url, title, quality }`

2. **`CinemaPlayer.jsx`** — remove the three duplicated local functions, import from `episodeUtils`. Update `openAndroid()` to call `buildAndroidEpisodeList(allFiles, currentFile)` and pass the result as `episodes` in the plugin call.

3. **`RecordDetailPage.jsx`** — import `buildAndroidEpisodeList`. In `handlePlay()`, after resolving `enriched` files and `current` file, compute `episodes = buildAndroidEpisodeList(enriched, current)` and pass it to `AndroidPlugins.launchNativePlayer`.

### EpisodeItem Format (matches VideoPlayerActivity contract)

```json
[
  { "fileId": 42, "url": "https://...", "title": "S01 · E01 · Pilot", "quality": "1080p" },
  { "fileId": 43, "url": "https://...", "title": "S01 · E02 · Next", "quality": "1080p" }
]
```

### Quality Inheritance

`buildAndroidEpisodeList` derives `currentQuality = getQualityLabel(currentFile)` then filters `allFiles` to only those where `getQualityLabel(f) === currentQuality`. This ensures if the user picks the 1080p stream, the episode list shows only 1080p alternatives.

### Scope

- No changes to `VideoPlayerActivity.java` — the Android side is already correct.
- No changes to backend — media file URLs are already resolved before the player launches.
- Movies (no S##E## pattern) produce an empty episodes list → `btnEpisodes` stays hidden, no regression.

### Files Changed

| File | Change |
|------|--------|
| `src/features/cinema/utils/episodeUtils.js` | **New** — shared pure utilities |
| `src/features/cinema/player/CinemaPlayer.jsx` | Import from utils, fix `openAndroid()` |
| `src/features/cinema/screens/RecordDetailPage.jsx` | Fix `handlePlay()` Android launch |

---

## Task 2 — Hero Banner Optimization

### Goal

The `HeroBanner.jsx` hero section has several issues: the auto-cycle timer is effectively disabled (80 000 000 ms), transitions are jarring slide animations, there is no cycle progress indicator, and mobile is missing the "More Info" button and genre chips.

### Approach

**In-place rewrite of `HeroBanner.jsx`** — no new files, same component API.

### Changes

#### Timer Fix
- `CYCLE_MS = 8000` (was `80000000`, ~22 hours)
- Auto-cycle resumes normally; user click on an indicator pauses for one full cycle then resumes

#### Progress Bar
- 3 px animated bar at the bottom of the hero, fills left-to-right over `CYCLE_MS`
- Implemented with Framer Motion `motion.div` animating `scaleX: 0 → 1`, reset on slide change
- Color: `primary.main` with slight glow

#### Desktop Backdrop — Cross-fade + Ken Burns
- Replace slide (`x: ±60`) with cross-fade (`opacity: 0 → 1`) so transitions feel cinematic
- Ken Burns: `motion.div` wraps the backdrop image, animates `scale: 1 → 1.06` over `CYCLE_MS`
- Scale resets to 1 on slide change (new image begins fresh zoom)

#### Responsive Positioning
- Remove hardcoded `left: 80, bottom: 100, width: '42%'`
- Replace with: `left: { xs: 16, sm: 40, md: 80 }`, `bottom: { xs: 80, md: 100 }`, `width: { xs: '90%', sm: '60%', md: '42%' }`

#### Mobile Enhancements
- Add "More Info" `Button` below the existing action buttons, visible only on xs/sm
- Add genre chips row (up to 3 genres from `record.genres`) below the title on mobile
- Increase `posterColor` shadow opacity from 0.3 → 0.6 on mobile for better contrast

#### Pill Indicators
- Replace bare `Box` dots with pill-shaped indicators: active pill is wider (24 px) and fully opaque; inactive pills are 8 px wide and 50% opaque
- Framer Motion `layout` transition for smooth width change on active change

#### Image Preloading
- On each slide change, preload the **next** item's backdrop via `new Image().src = nextUrl`
- Prevents blank-frame flash on slow connections

### Files Changed

| File | Change |
|------|--------|
| `src/features/cinema/components/HeroBanner/HeroBanner.jsx` | In-place rewrite |

---

## Testing Checklist

- [ ] Series record: Android player opens with episode panel populated
- [ ] 1080p file selected → only 1080p episodes in panel
- [ ] 720p file selected → only 720p episodes in panel
- [ ] Movie record: Android player opens with no episode panel (panel hidden)
- [ ] Web CinemaPlayer series: episode panel unchanged
- [ ] Hero auto-cycles every 8 s
- [ ] Progress bar fills and resets per cycle
- [ ] Desktop: cross-fade + Ken Burns visible
- [ ] Mobile: "More Info" and genre chips visible
- [ ] Indicator pills animate width on active change
- [ ] No flash between slides (preloading works)
