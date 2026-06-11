# Android Episode List + Hero Banner Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the Android native player's existing episode panel with quality-matched episodes, and fix the HeroBanner's broken auto-cycle, jarring transitions, missing progress bar, and poor mobile UX.

**Architecture:** Extract shared episode utility functions into `episodeUtils.js`; fix both Android call sites (`CinemaPlayer.openAndroid` and `RecordDetailPage.handlePlay`) to pass the built episode list. Rewrite `HeroBanner.jsx` in place to fix timing, add Ken Burns + cross-fade, progress bar, pill indicators, mobile enhancements.

**Tech Stack:** React 18, Framer Motion, MUI v5, Capacitor (Android bridge via `AndroidPlugins.launchNativePlayer`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/features/cinema/utils/episodeUtils.js` | **Create** | Pure episode parsing + Android list builder |
| `src/features/cinema/player/CinemaPlayer.jsx` | **Modify** | Remove duplicate helpers, import from utils, fix `openAndroid()` |
| `src/features/cinema/screens/RecordDetailPage.jsx` | **Modify** | Fix `handlePlay()` to pass episodes to Android |
| `src/features/cinema/components/HeroBanner/HeroBanner.jsx` | **Modify** | Timer fix, Ken Burns, cross-fade, progress bar, mobile UX, pill indicators |

---

## Task 1: Create `episodeUtils.js`

**Files:**
- Create: `src/features/cinema/utils/episodeUtils.js`

- [ ] **Step 1: Create the utility file**

```js
/** Parse S##E## from a filename → { season, episode } or null */
export function parseEpisode(fileName) {
  const m = (fileName ?? '').match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
  if (!m) return null;
  return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
}

/** Derive quality label from a mediaFile object (has .video.resolution or .general.fileName) */
export function getQualityLabel(mediaFile) {
  const res = mediaFile?.video?.resolution;
  if (!res) {
    return mediaFile?.general?.fileName?.match(/(\d{3,4}p|4K|8K)/i)?.[1] ?? 'SD';
  }
  const [, h] = res.split('x').map(Number);
  if (h >= 2160) return '4K';
  if (h >= 1080) return '1080p';
  if (h >= 720)  return '720p';
  if (h >= 480)  return '480p';
  return 'SD';
}

/** Build { [season]: [{season, episode, files}] } from an allFiles array */
export function buildEpisodeMap(files) {
  const map = {};
  for (const f of files) {
    const ep = parseEpisode(f?.general?.fileName);
    if (!ep) continue;
    const key = `${ep.season}x${ep.episode}`;
    if (!map[key]) map[key] = { ...ep, files: [] };
    map[key].files.push(f);
  }
  const seasons = {};
  for (const ep of Object.values(map)) {
    if (!seasons[ep.season]) seasons[ep.season] = [];
    seasons[ep.season].push(ep);
  }
  for (const s of Object.keys(seasons)) {
    seasons[s].sort((a, b) => a.episode - b.episode);
  }
  return seasons;
}

/**
 * Build the episode list for Android VideoPlayerActivity.
 * Filters allFiles to same quality as currentFile, sorts by season/episode.
 * Returns [] for movies (no S##E## pattern) so the Android panel stays hidden.
 *
 * @param {object[]} allFiles  — all media file objects for the record
 * @param {object}   currentFile — the file the user tapped Play on
 * @returns {{ fileId: number, url: string, title: string, quality: string }[]}
 */
export function buildAndroidEpisodeList(allFiles, currentFile) {
  if (!Array.isArray(allFiles) || !currentFile) return [];
  const currentQuality = getQualityLabel(currentFile);

  const sameQuality = allFiles.filter(f => getQualityLabel(f) === currentQuality);

  const withEp = sameQuality
    .map(f => ({ f, ep: parseEpisode(f?.general?.fileName) }))
    .filter(({ ep }) => ep !== null)
    .sort((a, b) =>
      a.ep.season !== b.ep.season
        ? a.ep.season - b.ep.season
        : a.ep.episode - b.ep.episode
    );

  return withEp.map(({ f, ep }) => ({
    fileId:  f.id ?? f.mediaFileId ?? 0,
    url:     f.streamUrl ?? '',
    title:   `S${String(ep.season).padStart(2, '0')} · E${String(ep.episode).padStart(2, '0')}`,
    quality: currentQuality,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/cinema/utils/episodeUtils.js
git commit -m "feat: add episodeUtils with buildAndroidEpisodeList"
```

---

## Task 2: Update `CinemaPlayer.jsx`

**Files:**
- Modify: `src/features/cinema/player/CinemaPlayer.jsx`

The file currently defines `parseEpisode` (line 78), `getQualityLabel` (line 42), and `buildEpisodeMap` (line 85) as local functions. `openAndroid()` (line 635) does not pass `episodes`.

- [ ] **Step 1: Replace the three local helper functions with imports**

Find the block starting at line 42 (`function getQualityLabel`) and ending at line 103 (closing `}` of `buildEpisodeMap`). Replace it with:

```js
import {
  parseEpisode, getQualityLabel, buildEpisodeMap, buildAndroidEpisodeList,
} from '../utils/episodeUtils';
```

Add this import at the top of the file alongside the other imports (after the `AndroidPlugins` import line).

Then delete the three local function bodies (`getQualityLabel`, `parseEpisode`, `buildEpisodeMap`) between lines 42–103.

- [ ] **Step 2: Fix `openAndroid()` to pass episodes**

The current `openAndroid` (around line 635 after edits) is:

```js
const openAndroid = () => {
  AndroidPlugins.launchNativePlayer({
    url:            currentFile?.streamUrl,
    title:          record?.tmdb?.title || record?.tmdb?.name || record?.name || title,
    fileName:       currentFile?.general?.fileName,
    fileId:         String(currentFile?.id || ''),
    preferredAudio: 'Hindi',
    preferredSub:   null,
  });
};
```

Replace with:

```js
const openAndroid = () => {
  const episodes = buildAndroidEpisodeList(allFiles ?? [], currentFile);
  AndroidPlugins.launchNativePlayer({
    url:            currentFile?.streamUrl,
    title:          record?.tmdb?.title || record?.tmdb?.name || record?.name || title,
    fileName:       currentFile?.general?.fileName,
    fileId:         String(currentFile?.id || ''),
    preferredAudio: 'Hindi',
    preferredSub:   null,
    episodes,
  });
};
```

- [ ] **Step 3: Commit**

```bash
git add src/features/cinema/player/CinemaPlayer.jsx
git commit -m "feat: pass quality-matched episode list to Android player from CinemaPlayer"
```

---

## Task 3: Update `RecordDetailPage.jsx`

**Files:**
- Modify: `src/features/cinema/screens/RecordDetailPage.jsx`

The `handlePlay` function at line 1587 launches the Android player without `episodes`. `enriched` is the resolved `allFiles` array; `current` is the selected file.

- [ ] **Step 1: Add import for `buildAndroidEpisodeList`**

Near the top of the file, alongside other cinema imports, add:

```js
import { buildAndroidEpisodeList } from '../utils/episodeUtils';
```

- [ ] **Step 2: Fix `handlePlay` to pass episodes**

The current Android block (lines 1593–1601):

```js
if (Capacitor.getPlatform() === 'android') {
  AndroidPlugins.launchNativePlayer({
    url: current?.streamUrl,
    title: record?.tmdb?.title || record?.title || general?.fileName || '',
    fileName: general?.fileName || '',
    fileId: String(mediaInfo.id || ''),
    preferredAudio: 'Hindi',
    preferredSub: null,
  });
}
```

Replace with:

```js
if (Capacitor.getPlatform() === 'android') {
  const episodes = buildAndroidEpisodeList(enriched, current);
  AndroidPlugins.launchNativePlayer({
    url: current?.streamUrl,
    title: record?.tmdb?.title || record?.title || general?.fileName || '',
    fileName: general?.fileName || '',
    fileId: String(mediaInfo.id || ''),
    preferredAudio: 'Hindi',
    preferredSub: null,
    episodes,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/cinema/screens/RecordDetailPage.jsx
git commit -m "feat: pass quality-matched episode list to Android player from RecordDetailPage"
```

---

## Task 4: Rewrite `HeroBanner.jsx`

**Files:**
- Modify: `src/features/cinema/components/HeroBanner/HeroBanner.jsx`

This is an in-place rewrite. The file is 512 lines. All changes are within the same file, same exports.

### Step-by-step changes

- [ ] **Step 1: Fix `CYCLE_MS` and add `progressKey` state**

Line 15 currently: `const CYCLE_MS  = 80000000;`

Replace with:
```js
const CYCLE_MS  = 8000;
const FADE_SECS = 0.6;
```

In the component body, after the existing state declarations (after `touchStartRef`), add:
```js
const [progressKey, setProgressKey] = useState(0);
```

`progressKey` is incremented on every slide change so the progress bar animation resets.

- [ ] **Step 2: Reset `progressKey` on slide change**

The `go` function currently:
```js
const go = (d) => {
  clearInterval(timerRef.current);
  setDir(d);
  setIdx(i => (i + d + featured.length) % featured.length);
  startCycle();
};
```

Replace with:
```js
const go = (d) => {
  clearInterval(timerRef.current);
  setDir(d);
  setIdx(i => (i + d + featured.length) % featured.length);
  setProgressKey(k => k + 1);
  startCycle();
};
```

Also update the auto-cycle `setInterval` callback inside `startCycle`:
```js
const startCycle = useCallback(() => {
  clearInterval(timerRef.current);
  timerRef.current = setInterval(() => {
    setDir(1);
    setIdx(i => (i + 1) % Math.max(featured.length, 1));
    setProgressKey(k => k + 1);
  }, CYCLE_MS);
}, [featured.length]);
```

- [ ] **Step 3: Add animated progress bar to the desktop layout**

In the desktop layout `<Box>` (the outermost container returned for non-mobile, after the dot indicators `<Box>`), add before the closing `</Box>` of the outer container (before line 507 `<Box sx={{ position: 'absolute', bottom: 0 ...}}`):

```jsx
{/* Progress bar */}
<Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, zIndex: 4, overflow: 'hidden' }}>
  <motion.div
    key={progressKey}
    initial={{ scaleX: 0, originX: 0 }}
    animate={{ scaleX: 1 }}
    transition={{ duration: CYCLE_MS / 1000, ease: 'linear' }}
    style={{
      height: '100%',
      background: 'var(--mui-palette-primary-main, #1976d2)',
      boxShadow: '0 0 8px rgba(25,118,210,0.6)',
      transformOrigin: 'left',
    }}
  />
</Box>
```

- [ ] **Step 4: Replace desktop backdrop slide with cross-fade + Ken Burns**

Find the `AnimatePresence` block for the desktop backdrop (lines 374–398):

```jsx
<AnimatePresence mode="sync" initial={false} custom={dir}>
  <motion.div
    key={record.id}
    custom={dir}
    variants={{
      enter:  (d) => ({ opacity: 0, x: d > 0 ? 60 : -60 }),
      center: { opacity: 1, x: 0 },
      exit:   (d) => ({ opacity: 0, x: d > 0 ? -60 : 60 }),
    }}
    initial="enter" animate="center" exit="exit"
    transition={{ duration: FADE_SECS, ease: 'easeInOut' }}
    style={{ position: 'absolute', inset: 0 }}
  >
    {backdrop && (
      <Box
        component="img"
        src={backdrop}
        alt={record.title}
        sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
      />
    )}
    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,.85) 0%, rgba(0,0,0,.55) 45%, transparent 75%)' }} />
    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.4) 30%, transparent 60%)' }} />
  </motion.div>
</AnimatePresence>
```

Replace with:

```jsx
<AnimatePresence mode="sync" initial={false}>
  <motion.div
    key={record.id}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: FADE_SECS, ease: 'easeInOut' }}
    style={{ position: 'absolute', inset: 0 }}
  >
    {backdrop && (
      <motion.div
        key={`kb-${record.id}`}
        initial={{ scale: 1 }}
        animate={{ scale: 1.06 }}
        transition={{ duration: CYCLE_MS / 1000, ease: 'linear' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Box
          component="img"
          src={backdrop}
          alt={record.title}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
        />
      </motion.div>
    )}
    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,.85) 0%, rgba(0,0,0,.55) 45%, transparent 75%)' }} />
    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.4) 30%, transparent 60%)' }} />
  </motion.div>
</AnimatePresence>
```

- [ ] **Step 5: Fix responsive positioning of the content overlay**

Find:
```jsx
<Box
  sx={{
    position: 'absolute',
    bottom: 100, left: 80,
    width: '42%',
    zIndex: 2,
  }}
>
```

Replace with:
```jsx
<Box
  sx={{
    position: 'absolute',
    bottom: { xs: 80, md: 100 },
    left: { xs: 16, sm: 40, md: 80 },
    width: { xs: '90%', sm: '60%', md: '42%' },
    zIndex: 2,
  }}
>
```

- [ ] **Step 6: Add next-image preloading on slide change**

Add a `useEffect` in the component body (after the poster-color extraction effect) that preloads the next backdrop when `idx` changes:

```js
useEffect(() => {
  if (featured.length < 2) return;
  const nextIdx = (idx + 1) % featured.length;
  const nextRecord = featured[nextIdx];
  const nextUrl = tmdbImg(nextRecord?.backdropPath ?? nextRecord?.backdropPathText, 'original');
  if (nextUrl) {
    const img = new Image();
    img.src = nextUrl;
  }
}, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 7: Replace desktop dot indicators with Framer Motion pill indicators**

Find the desktop dot indicators block:
```jsx
{featured.length > 1 && (
  <Box sx={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0.8, zIndex: 3 }}>
    {featured.map((_, i) => (
      <Box
        key={i}
        onClick={() => { clearInterval(timerRef.current); setDir(i > idx ? 1 : -1); setIdx(i); startCycle(); }}
        sx={{ width: i === idx ? 24 : 8, height: 8, borderRadius: 4, bgcolor: i === idx ? 'primary.main' : 'rgba(255,255,255,.35)', cursor: 'pointer', transition: 'all .3s' }}
      />
    ))}
  </Box>
)}
```

Replace with:
```jsx
{featured.length > 1 && (
  <Box sx={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0.8, zIndex: 3 }}>
    {featured.map((_, i) => (
      <motion.div
        key={i}
        layout
        onClick={() => { clearInterval(timerRef.current); setDir(i > idx ? 1 : -1); setIdx(i); setProgressKey(k => k + 1); startCycle(); }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          width: i === idx ? 24 : 8,
          height: 8,
          borderRadius: 4,
          background: i === idx ? 'var(--mui-palette-primary-main, #1976d2)' : 'rgba(255,255,255,.35)',
          cursor: 'pointer',
          opacity: i === idx ? 1 : 0.5,
        }}
      />
    ))}
  </Box>
)}
```

Also do the same for the **mobile** dot indicators (lines 338–351):
```jsx
{featured.length > 1 && (
  <Box sx={{ display: 'flex', gap: 0.8, mt: 2.5, zIndex: 2 }}>
    {featured.map((_, i) => (
      <motion.div
        key={i}
        layout
        onClick={() => { clearInterval(timerRef.current); setDir(i > idx ? 1 : -1); setIdx(i); setProgressKey(k => k + 1); startCycle(); }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          width: i === idx ? 24 : 8,
          height: 8,
          borderRadius: 4,
          background: i === idx ? 'var(--mui-palette-primary-main, #1976d2)' : 'rgba(255,255,255,.35)',
          cursor: 'pointer',
          opacity: i === idx ? 1 : 0.5,
        }}
      />
    ))}
  </Box>
)}
```

- [ ] **Step 8: Add "More Info" button to mobile layout**

In the mobile action buttons `<Box>` (after the "My List" `Button`, before the closing `</Box>` of the button row — around line 333):

```jsx
<Button
  variant="outlined"
  startIcon={<Info />}
  onClick={goToDetail}
  sx={{
    display: { md: 'none' },
    borderColor: 'rgba(255,255,255,.6)', color: '#fff',
    fontWeight: 600, fontSize: '0.88rem',
    px: 2.2, py: 1, borderRadius: 2, textTransform: 'none',
    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.1)' },
  }}
>
  More Info
</Button>
```

- [ ] **Step 9: Strengthen mobile glow (posterColor opacity)**

Find in the mobile poster card `boxShadow`:
```js
boxShadow: `0 28px 72px rgba(0,0,0,0.85), 0 0 50px rgba(${posterColor},0.3)`,
```

Replace `0.3` with `0.6`:
```js
boxShadow: `0 28px 72px rgba(0,0,0,0.85), 0 0 50px rgba(${posterColor},0.6)`,
```

- [ ] **Step 10: Commit hero changes**

```bash
git add src/features/cinema/components/HeroBanner/HeroBanner.jsx
git commit -m "feat: hero banner — fix timer, Ken Burns, cross-fade, progress bar, mobile UX, pill indicators"
```

---

## Task 5: Manual Verification

- [ ] **Episode list — Android series**
  - Open any TV series record on Android, tap Play
  - Confirm the episode panel button (≡) appears
  - Tap it — episodes matching the playing file's quality are listed
  - Tap a different episode — it plays

- [ ] **Episode list — quality filter**
  - If the record has both 1080p and 720p files, pick the 720p file
  - Episode panel should list only 720p episodes

- [ ] **Episode list — movie regression**
  - Open a movie record on Android, tap Play
  - Episode panel button must NOT appear

- [ ] **Web player — no regression**
  - Open any series in the web CinemaPlayer
  - Episode panel still works (uses the same extracted utils)

- [ ] **Hero timer**
  - Load the home page; hero should auto-cycle every ~8 seconds

- [ ] **Hero progress bar**
  - A thin bar fills left-to-right across the bottom of the hero over 8 s, resets on slide change

- [ ] **Hero Ken Burns**
  - Desktop backdrop slowly zooms in; resets to normal on slide change

- [ ] **Hero cross-fade**
  - Slide transitions are opacity fades, not horizontal slides

- [ ] **Hero mobile**
  - "More Info" button visible on mobile below the action buttons
  - Glow behind the poster card is visibly stronger

- [ ] **Hero pill indicators**
  - Active pill is wider (24 px); inactive pills are narrow (8 px); animate on change

---

## Self-Review Notes

- `buildAndroidEpisodeList` returns `[]` for movies because no files match `parseEpisode` → Android panel stays hidden. ✓
- `progressKey` is incremented in `go()`, the auto-cycle callback, and the indicator `onClick` — all slide-change paths. ✓
- The Ken Burns `motion.div` uses `key={`kb-${record.id}`}` to force a fresh animation on every slide change. ✓
- `allFiles` in `CinemaPlayer` is a prop (`allFiles {array}`), so it is available in `openAndroid()`. ✓
- `enriched` in `RecordDetailPage.handlePlay` is the full resolved array — correct input for `buildAndroidEpisodeList`. ✓
- No changes to `VideoPlayerActivity.java` needed — Android side already parses `episodesJson`. ✓
