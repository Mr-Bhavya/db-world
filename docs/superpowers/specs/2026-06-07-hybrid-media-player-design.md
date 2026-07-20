# Hybrid Media Player — Design

**Date:** 2026-06-07
**Status:** Approved (pending spec review)
**Goal:** Rebuild the DB-World player into an Amazon-Prime-class experience with a **single React UI** that drives a **native ExoPlayer video surface** on Android and an HTML5 `<video>` on web. Add device-based auto-quality, next-episode autoplay, a unified settings sheet, and a HW/SW decoder toggle. Fix the broken episode side-panel by rebuilding it once as a shared component.

Explicitly **out of scope:** X-Ray, true per-segment adaptive bitrate (HLS/DASH ABR), and Skip-Intro/Recap (no timestamp data available).

---

## 1. Decisions (locked)

| Topic | Decision |
|---|---|
| Player target | Both — **one React UI** rendered over a **native video surface** on Android; HTML5 `<video>` on web |
| Auto-quality | **Smart one-time pick** by device caps (screen height + codec support); manual override remembered; **no cellular cap** (always best for screen) |
| Next-episode | **Autoplay ON** with a **10s** countdown card; carries over audio/subtitle language + quality |
| Skip Intro/Recap | **Not built** (no timestamp data) |
| Decoder | **HW / SW / Auto** toggle in settings; **bundle Media3 software decoder** (risk-gated — see §8) |
| Process | **Spike first** to de-risk transparent-surface approach; **one phased spec** |

---

## 2. Current state (baseline)

- **Web** `src/features/cinema/player/CinemaPlayer.jsx` — HTML5 `<video>`, manual quality (`allFiles`), next-episode overlay + panel, audio/subtitle menus, **no speed control**, **does not restore resume**.
- **Native** `android/app/src/main/java/com/db/dbworld/player/VideoPlayerActivity.java` (separate full-screen Activity launched via `DbWorldPlayerPlugin`) — ExoPlayer/Media3, gestures (swipe brightness/volume, double-tap seek, pinch-zoom), speed 0.25–2×, PiP, audio/subtitle dialogs, lock, per-file resume (SharedPrefs + backend), episode side-panel.
- **Quality** = discrete files (each resolution is a separate `MediaFile`); **not** an adaptive manifest. User picks manually.
- **Episodes** parsed from filename `S##E##` and/or `tmdbSeasonNumber/tmdbEpisodeNumber` (`episodeUtils.js`). Web has next-episode; Android panel has **no autoplay on end**. **The episode side-panel is currently reported broken — root-cause before the rebuild (§7) so the bug isn't carried forward.**
- **Backend** (no changes required): `GET /api/stream/resolve/{mediaFileId}`, `GET /api/stream/media-info/{recordId}`, `PUT/GET /api/cinema/progress/{fileId}`.

---

## 3. Architecture: the hybrid player

One React component, `DbWorldVideoPlayer`, renders **all** UI on every platform (controls, episode panel, settings sheet, next-episode card, buffering/error states). Only the video layer underneath differs, hidden behind a **platform adapter** with a single interface.

```
   ┌─────────────────────────────────────────────┐
   │  React player UI (controls · episodes ·      │  ← Capacitor WebView, transparent bg
   │  settings · next-ep countdown · buffering)   │
   │            [ video shows through ]           │
   └─────────────────────────────────────────────┘
                       ▲                ▲
        web: HTML5 <video>     android: ExoPlayer SurfaceView
        (in the DOM)           BEHIND the transparent WebView
                       │
        ┌──────────────┴───────────────────────────┐
        │  PlayerAdapter (one JS interface)          │
        │  load(src,startMs) play pause seek(ms)     │
        │  setRate(x) selectAudio(id) selectText(id) │
        │  setQuality(src,ms) setDecoderMode(mode)   │
        │  enterPip() show() hide() release()        │
        │  getCapabilities()                          │
        │  events: ready·time·buffering·duration·    │
        │          tracks·ended·error·stopped        │
        └─────────────────────────────────────────────┘
```

### 3.1 Web adapter
Thin wrapper over an HTML5 `<video>` element (reuses today's CinemaPlayer playback internals). Capabilities from `screen.height × devicePixelRatio` and `video.canPlayType(...)`.

### 3.2 Android adapter (the new part)
A `DbWorldPlayer` Capacitor plugin (evolves the existing `DbWorldPlayerPlugin`) that:
- Adds an **ExoPlayer + `SurfaceView`** to `MainActivity`'s content view, positioned **behind** the Capacitor WebView.
- Makes the WebView **transparent** (`webView.setBackgroundColor(TRANSPARENT)`) while the player is visible, and opaque again when hidden, so the rest of the SPA is unaffected.
- Receives commands JS→native and emits playback state native→JS via `notifyListeners`:
  - **Commands:** `load(url, startMs, headers)`, `play`, `pause`, `seekTo(ms)`, `setRate(x)`, `selectAudioTrack(id)`, `selectTextTrack(id|off)`, `setQuality(url, positionMs)` (re-load a different file at the same position), `setDecoderMode('hw'|'sw'|'auto')`, `enterPip()`, `show()`, `hide()`, `release()`, `getCapabilities()`.
  - **Events:** `playerReady`, `playerTime{positionMs}` (~4 Hz), `playerBuffering{active, percent}`, `playerDuration{ms}`, `playerTracks{audio[], text[], video[]}`, `playerEnded`, `playerError{code,msg}`, `playerStopped{positionMs,durationMs,audioLang,subLang}` (drives the existing progress PUT).
- **Gestures & fullscreen** are handled by the React overlay (touch on the WebView) and translated into commands. Immersive mode stays as today.
- **PiP** remains native (Activity `enterPictureInPictureMode`), triggered by a command; the React overlay hides during PiP.

The current separate `VideoPlayerActivity` is retired once the surface-in-MainActivity model is proven (kept as a fallback until Phase 2 completes).

### 3.3 Why this fixes things at once
- Episode panel is **rebuilt once** in React → the current breakage is designed out.
- Auto-quality, episode/next-episode logic, settings — **shared JS**, identical web vs app.
- Web parity (resume, speed) is largely **free** because it's the same component.

---

## 4. Auto-quality engine (shared JS)

`pickAutoQuality(files, caps)` — pure function, used by both adapters:
1. Filter to files whose codec the device can decode (`caps.supportedCodecs`).
2. `targetHeight = caps.displayHeight` (no network cap per decision).
3. Choose the highest variant with `height ≤ targetHeight`; if all exceed, the lowest; prefer a hardware-decodable codec on ties.
4. Returns `{ file, label: "Auto (1080p)" }`.
- **Caps source:** web → screen + `canPlayType`; android → `DbWorldPlayer.getCapabilities()` → `{ displayHeight, displayWidth, supportsHevc, supportsAv1, supportsVp9 }` (queried from `Display` + `MediaCodecList`).
- **Override:** user-chosen quality persisted (per user); auto only applies when no override or "Auto" is selected. Quality switch re-loads the new file at the current position (`setQuality`).

---

## 5. Episode panel + next-episode (shared React)

- **One `EpisodePanel` React component** (seasons + episodes, current highlighted), driven by the existing shared `episodeUtils.js` grouping. Replaces both the web `EpisodePanel` and the native Java panel.
- **Next-episode autoplay:** on `playerEnded` (and a button surfaced in the last ~20s), show the countdown card:

```
        ┌──────────────────────────────────────┐
        │  ▸ Next: S1E4 — "The Climb"           │
        │  [thumb]   Playing in  7              │
        │            [ Watch now ]   [ Cancel ] │
        └──────────────────────────────────────┘
```

  - Default **ON**, **10s** countdown, cancellable. A settings toggle can disable autoplay (then the card is button-only). Preference remembered.
  - Carries over audio/subtitle language + selected quality to the next episode (auto-quality re-evaluates if "Auto").

---

## 6. Settings bottom-sheet (shared React)

Prime-style single sheet replacing scattered menus:

```
   ┌─ Settings ──────────────────┐
   │ Quality    Auto (1080p)   › │
   │ Audio      Hindi 5.1      › │
   │ Subtitles  English        › │
   │ Speed      1.0×           › │
   │ Decoder    Auto           › │   (Android only)
   │ Autoplay next      [ ON ] │
   └─────────────────────────────┘
```

Each row opens a secondary list. Audio/subtitle selection drives `selectAudioTrack/selectTextTrack`; quality drives `setQuality`; decoder drives `setDecoderMode`.

---

## 7. Episode-panel breakage (must root-cause)

Before Phase 4, diagnose why the current panel "and related features" don't work (candidate areas: `episodeUtils.js` parsing, `allFiles` not reaching the player, `buildAndroidEpisodeList` quality filtering, intent JSON size limits). Capture the root cause in the plan so the React rebuild doesn't reproduce it.

---

## 8. HW/SW decoder (Android)

- **Toggle:** HW / SW / Auto in the settings sheet → `setDecoderMode`.
  - **Auto** (default): ExoPlayer default + `setEnableDecoderFallback(true)` (falls back to OS software decoders when HW init fails).
  - **HW:** prefer hardware via `MediaCodecSelector`.
  - **SW:** prefer software decoders.
- **Bundled software *video* decoder (risk-gated):** Media3's FFmpeg extension is **not** a drop-in Maven dependency for video — it generally must be built from source via NDK with HEVC/AV1 enabled. **Phase 5 first ships HW + OS-fallback (Auto/HW/SW where the OS allows).** Bundling FFmpeg for true SW HEVC/AV1 is a tail sub-task; if the NDK build balloons, we stop at OS-fallback and document the limitation. Audio SW decoding (if needed) is cheap and can be added independently.

---

## 9. Risks

1. **Transparent WebView over a native surface** — known pattern, but device-specific compositing/perf/z-order quirks; gestures + fullscreen now route through the WebView. → **Phase 0 spike** de-risks on real hardware before any big build; fallback is the lighter "consistent native UI" path.
2. **Bridge timing/perf** — high-frequency `playerTime` events must be throttled (~4 Hz) to keep the WebView smooth.
3. **SW video decoder packaging** — see §8; risk-gated.
4. **PiP / lifecycle** with UI in the WebView — handled natively; overlay hides during PiP/background.

---

## 10. Phasing

0. **Spike** — ExoPlayer `SurfaceView` behind a transparent WebView in MainActivity; bridge `load/play/pause/seek` + `playerTime`; one hardcoded video; verify on-device (smooth video, working overlay, no black screen). Throwaway.
1. **Player shell + adapters** — `DbWorldVideoPlayer` React component + web and android `PlayerAdapter`; port existing controls/gestures; resume wired via `/api/cinema/progress` (web + android).
2. **Retire `VideoPlayerActivity`** path; route all playback through the hybrid player.
3. **Auto-quality** engine + `getCapabilities`.
4. **Episode panel rebuild** (root-cause §7 first) + **next-episode autoplay** card.
5. **Settings sheet** + **HW/SW decoder** (OS-fallback first; bundled SW decoder risk-gated).
6. **Web parity polish** — speed, gesture parity, final visual matching.

---

## 11. Backend

**No changes required.** `resolve`, `media-info`, and `progress` endpoints already cover the needs.
