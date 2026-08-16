# True-HDR Native Android Player — Design

**Date:** 2026-08-02
**Status:** Draft (pending spec review)
**Branch:** `feat/true-hdr-native-player`

**Goal:** Replace the Android *TextureView-behind-transparent-WebView* video path with a **native, HDR-capable, production-grade player**. Deliver true **HDR10 / HDR10+ / HLG passthrough** on HDR displays, **smooth playback on low-end devices**, **FFmpeg software-decode fallback**, and **Netflix-class robustness** — with **zero regression** to the JS-owned playback orchestration (resume/timestamp, telemetry, episode list, watched-marking). The **web** player (HTML5 `<video>` + React) is **unchanged**.

---

## 1. Why

1080p **AV1 HDR** plays far too dark on a Samsung Galaxy S24 FE (crushed blacks, faces lost in shadow). Root cause: the current player composites video into a **`TextureView`** inside the app's SDR window (chosen so the transparent Capacitor WebView overlay can host the React controls). A TextureView cannot present an HDR signal, so HDR frames render as if SDR → dark. A `SurfaceView` is required for true HDR, but an earlier spike found a transparent WebView **over** a SurfaceView unreliable (device-dependent black screens) and pivoted to TextureView — see the code comment in `HybridPlayerPlugin.attachSurface()` and the original design `docs/superpowers/specs/2026-06-07-hybrid-media-player-design.md` §3.2/§9/§10.

**Key insight that unblocks this:** the WebView-over-SurfaceView problem only exists because the *controls* are a WebView. If the controls are **native Compose** instead, there is no WebView-over-SurfaceView compositing at all — native views over a SurfaceView is the standard, universally-reliable video-app pattern. That is the architecture below.

An interim `setVideoEffects` HDR→SDR **tone-map** fix (plus the `media3-effect` dependency) already exists on this branch as a **shipping stopgap** until this native player lands; it is then retired on Android.

---

## 2. Locked decisions (from brainstorming)

| Topic | Decision |
|---|---|
| HDR target | **HDR10 / HDR10+ / HLG passthrough** on HDR displays; tone-map to SDR only on **SDR-only** displays. **Dolby Vision OUT** (Samsung panels, incl. S24 FE, don't support DV). |
| Effort ceiling | **Guarantee HDR; native controls acceptable.** (Chosen over spike-first and accept-SDR-fallback.) |
| UI | **Full feature parity, native Jetpack Compose.** |
| Video surface | **`SurfaceView`** — required for HDR, and lower-overhead than TextureView (no per-frame GL copy) → also a low-end win. |
| Controls host | **Native Compose layer inside the existing `MainActivity`** — not a separate Activity, not a WebView overlay. |
| Orchestration | **JS stays authoritative** for backend/auth/resume/telemetry/episode-resolve. Native emits events; existing JS handlers react **unchanged**. |
| Decode | **Hardware-first, FFmpeg (NextLib) software fallback**; HW/SW/Auto toggle retained. |
| Web | **Unchanged** (HTML5 React player). Platforms deliberately diverge on the player screen only. |

---

## 3. Architecture

```
 MainActivity (existing BridgeActivity)
 ┌───────────────────────────────────────────────┐
 │  Compose control layer (native, mostly transparent)   ← top
 │   transport · gestures · menus · episode panel ·      │
 │   settings sheet · next-ep card · error/retry UI      │
 ├───────────────────────────────────────────────┤
 │  ExoPlayer SurfaceView  (real HDR display layer)      ← bottom of the visible stack
 ├───────────────────────────────────────────────┤
 │  Capacitor WebView (React SPA)  — INVISIBLE but ALIVE │
 │   runs the unchanged JS playback orchestration        │
 └───────────────────────────────────────────────┘
```

- The **video** renders to a `SurfaceView` added to `MainActivity`'s content view (same insertion point the TextureView uses today). Being a real display layer, the panel can enter HDR mode.
- The **controls** are a native **Compose** layer (a `ComposeView`) added *above* the SurfaceView. Native-over-SurfaceView compositing is reliable on all devices — this is what removes the original blocker.
- The **WebView stays alive** (set `INVISIBLE`, not removed) while the native player is up, so the React SPA and all its JS keep running. When the player closes, the native layers are removed and the WebView returns to `VISIBLE`.
- **One Activity** → no separate-Activity lifecycle/stop of the WebView → JS orchestration keeps executing. Bridge events reach JS via `evaluateJavascript`, which runs regardless of WebView visibility, so native-driven progress/telemetry saves remain reliable.

### 3.1 New plugin
A new **`NativePlayerPlugin` (Kotlin)** supersedes `HybridPlayerPlugin` on Android. It owns the SurfaceView, the ExoPlayer, and the Compose layer, and exposes the bridge in §4. `HybridPlayerPlugin` (TextureView) is kept behind a **feature flag** until the parity checklist (§9) passes on-device, then deleted.

### 3.2 What is native vs. what stays JS
- **Native (new):** SurfaceView + ExoPlayer setup, HDR per-display branch, decoder strategy, all **rendering** (Compose controls, gestures, menus, episode panel, settings sheet, next-ep card, subtitles, storyboard scrub, error UI), PiP, audio-focus/lifecycle.
- **JS (unchanged):** stream resolve (`resolveMediaBatch` / `resolveMediaUrl`), the `media` payload assembly (`resolveAndBuildMedia` / `buildMediaFromFileId`), resume read/write (`getWatchProgress`/`saveWatchProgress`), auto-mark Watched (`addWatched`) + Continue-Watching invalidation, and telemetry (`usePlayerReporting` → `STREAM_*` to `/api/track/events`), episode list building (`buildHybridEpisodes`) and per-episode lazy URL resolve, preference persistence.

The Android `DbWorldVideoPlayer` React component becomes a **headless controller**: no visible UI, it just wires native events to the existing JS handlers and forwards commands. On web it is unchanged.

---

## 4. Bridge contract

The `media` payload is exactly today's shape (from `playerLaunch.js`): `{ url, fileId, mediaFileId, title, fileName, overview, recordId, audio[], variants[]{url,label,height,mediaFileId,codec,hdr}, episodes[], storyboard, requestId }`.

**JS → native (commands)**
- `present({ media, startMs, prefs })` — show the native player, add layers, hide WebView, load `url` at `startMs`. `prefs` = remembered audio/subtitle language, quality override, speed, decoder mode, autoplay-next.
- `loadResolved({ url, startMs, variants, audio, storyboard, requestId, episodeMeta })` — result of a JS episode/quality resolve; swaps the stream in place.
- `setDecoderMode`, `setRate`, `setOrientation`, `enterPip`, `dismiss()` — as today.
- (Volume/brightness handled natively via gestures; system-volume sync retained.)

**Native → JS (events)** — mapped to the existing adapter events so JS handlers are unchanged:
- `playerTime { positionMs, durationMs, bufferedMs }` (~4 Hz) → drives `saveWatchProgress` + telemetry TICK.
- `playerState { playing | state }` → START/PAUSE telemetry, UI.
- `playerSeek { positionMs }` → SEEK telemetry.
- `playerEnded {}` → progress reset + `addWatched` (last ep/movie) + Continue-Watching refresh.
- `playerTracks { audio[], text[], video[] }` → menus + persisted prefs.
- `playerSelectEpisode { fileId, mediaFileId }` → JS `selectEpisode` resolves the lazy URL, then calls `loadResolved`.
- `playerPrefChanged { key, value }` → JS persists (audio/sub lang, quality, speed, decoder, autoplay).
- `playerError { code, message, retryable }`, `playerPipChanged { pip }`, `playerClosed { positionMs, durationMs }` → final save + WebView back to visible.

**Regression guard:** the START/TICK/PAUSE/SEEK/STOP telemetry keyed on `requestId` (sessionId), the resume rules (resume only if `>5s` in and not within `30s` of end), and per-episode session re-arming all remain in JS and are re-verified by the parity checklist.

---

## 5. HDR handling

- Decode to the `SurfaceView`; **no effects pipeline** when the display supports the content's HDR type → true passthrough, panel enters HDR mode.
- **Per-display branch, decided at load** from `Format.colorInfo.colorTransfer` (ST2084/PQ or HLG) vs. the display's supported types (`Display.getHdrCapabilities().getSupportedHdrTypes()` / `Display.getMode().getSupportedHdrTypes()` on newer APIs):
  - HDR content **+ HDR-capable display** → passthrough (real HDR).
  - HDR content **+ SDR-only display** → enable `player.setVideoEffects(emptyList())` HDR→SDR tone-map (the interim fix), so it is never dark.
  - SDR content → normal path.
- Request wide-gamut/HDR window color mode where applicable; validated on-device in Phase 0.

---

## 6. Decoding strategy (HW-first, FFmpeg fallback)

- Keep **`NextRenderersFactory`** (`io.github.anilbeesetti:nextlib-media3ext`) with `EXTENSION_RENDERER_MODE_ON` and `setEnableDecoderFallback(true)`. NextLib ships **FFmpeg software decoders for H.264/HEVC/VP8/VP9/AV1 video** (and E-AC3/AC3/DTS/TrueHD audio) — so software fallback needs **no NDK build-from-source** (the 2026-06 design's concern is obsolete).
- Order: **hardware decoder first, FFmpeg software as automatic fallback** so anything plays even without a hardware decoder. Retain the **HW / SW / Auto** toggle (`decoderMode`, live player recreate).
- Software video decode is paired with **auto-quality** (§7) so it lands on a resolution the CPU can sustain.
- **License note:** NextLib is **GPL-3.0** (already shipped in the app for audio); relevant for distribution.

---

## 7. Low-end smooth playback

- **Auto-quality by real device caps** — choose the highest `variants[]` entry whose height ≤ display height **and** ≤ the device's actual decode ceiling for that codec (`MediaCodecList` / `CodecCapabilities.VideoCapabilities`). Never feed a low-end chip a 4K stream. Manual override remembered (parity with the 2026-06 design §4).
- **Device-tier-aware buffering** — scale the current 96 MB / 30 s–2 min `DefaultLoadControl` **down** on `ActivityManager.isLowRamDevice()` / low-RAM devices to avoid OOM + GC jank; keep the generous ceiling on capable devices.
- **Refresh-rate / frame-rate matching** — set the display mode to the content fps (24/25/30) so film content doesn't judder on 60/120 Hz panels.
- **Fast scrub** — `SeekParameters.CLOSEST_SYNC` (keyframe) while dragging, precise on release.
- **SurfaceView** removes the TextureView's per-frame GL composite — a direct low-end CPU/GPU saving.

---

## 8. Production robustness (Netflix-class)

- **Audio focus + becoming-noisy** — `setAudioAttributes(..., handleAudioFocus=true)` and `setHandleAudioBecomingNoisy(true)`: auto-pause on incoming call / another app taking audio / headphone unplug. (Today's player does neither — a real gap.)
- **Lifecycle** — pause on background (except PiP); save progress on pause, on background, on close, **and** periodically; clean `release()`; no leaks; correct config-change/rotation handling.
- **Network resilience + error UI** — transient errors retry (ExoPlayer error-handling policy); hard errors show a clear, **retry-able** screen with a code (not a dead black frame).
- **Seamless transitions** — quality/episode switches preserve position and carry over audio/subtitle language.
- **Captions** — honor system caption style/size (`SubtitleView.setUserDefault*`), support SRT/VTT/PGS/ASS as today.

---

## 9. Regression safety (the "nothing breaks" guarantee)

1. **Freeze the correctness logic in JS.** Resume/timestamp, telemetry, watched-marking, episode list + resolve, and preference persistence are **not rewritten** — they stay in the existing JS modules and are fed by native events (§4). This is the primary guard.
2. **Feature flag.** The old TextureView `HybridPlayerPlugin` path stays shippable behind a flag; the native path is opt-in until sign-off, so any device regression is instantly revertible.
3. **Parity checklist (acceptance gate, on-device).** Every current capability must pass before the old path is removed:
   - play/pause/seek · buffered fill · **storyboard scrub thumbnails** · time labels
   - gestures: tap-toggle · double-tap ±10 s · swipe brightness · swipe volume (system sync + hw keys) · **pinch-zoom** · lock
   - audio-track select (lang/codec/channels labels) · subtitle select + render · speed 0.25–2× · **decoder HW/SW/Auto**
   - **episode panel** (seasons/eps, current highlighted) · **next-episode autoplay** countdown · **quality switch** (same position)
   - **resume** (correct start; not within 30 s of end) · progress save on tick/pause/close/ended · **auto-mark Watched** + Continue-Watching refresh
   - **STREAM_START/TICK/PAUSE/SEEK/STOP** telemetry present with correct `requestId`, positions, `clientApp=APP`
   - PiP · orientation · pause info card · error/retry
   - **HDR: real HDR on S24 FE; not-dark on an SDR display**
   - low-end: smooth on a weak device at auto-quality

---

## 10. Build / tooling

- Add **Kotlin + Jetpack Compose** to the `app` module (currently Java; `kotlin-stdlib` is already a dependency). Adds: Kotlin Gradle plugin (bump from 1.8.22 to a Compose-compatible version), Compose BOM, `activity-compose`, `material3`, Compose compiler plugin. Existing Java plugins (download/vault/appupdate) stay Java — mixed Java/Kotlin is fine.
- Keep `androidx.media3:media3-effect` (added on this branch) for the SDR-display tone-map branch.
- **Risk:** first-time Compose setup + Kotlin/Compose-compiler version alignment (build-config work) — gated in Phase 0.

---

## 11. Phasing

0. **Kotlin/Compose bootstrap** + a bare native `SurfaceView` in `MainActivity` playing one hardcoded HDR10 file → **verify true HDR on the S24 FE** (display in HDR mode, not dark) and confirm the WebView-alive/hidden model. De-risks before UI work.
1. **Player shell + Compose control layer + bridge** (`present`/`loadResolved`/events); **JS orchestration preserved & re-verified** (resume, telemetry, watched, episodes); old path behind a flag.
2. **Transport + gestures + HDR per-display branch + zoom rework + audio-focus/lifecycle.**
3. **Track menus + speed + decoder toggle + subtitle rendering.**
4. **Episode panel + next-episode autoplay + quality switching + `selectEpisode` bridge.**
5. **Settings sheet + storyboard scrub + PiP + low-end bundle** (auto-quality, tier buffering, fps match, fast scrub) + **error/retry UI**.
6. **Parity-checklist sign-off on-device → delete the old TextureView path.**

---

## 12. Testing

- **Unit-test the pure logic:** HDR per-display branch decision, auto-quality selection, aspect/zoom math, track mapping, buffer-tier selection.
- **Everything else is on-device.** Android cannot compile or run in the dev/CI-agent environment here (Gradle loopback limitation), and HDR/gestures/PiP/audio-focus are inherently device-behaviours. Each phase ships with an explicit on-device checklist; the parity checklist (§9) is the final gate before the old path is deleted (Phase 6).

---

## 13. Backend

**No changes required.** `stream/resolve`, `stream/resolve-batch`, `stream/media-info`, `cinema/progress`, and `track/events` already cover every need; the native player consumes JS-resolved URLs and reports through the unchanged JS layer.

---

## 14. Risks

1. **Phase 0 HDR passthrough** must be confirmed on the S24 FE before UI investment (the whole premise).
2. **WebView-alive-while-hidden** must keep delivering bridge events reliably (expected via `evaluateJavascript`; verified in Phase 0/1).
3. **Compose/Kotlin bootstrap** in a Java module (build-config).
4. **Full-parity surface area** is large — the feature flag + parity checklist bound the risk.
5. **GPL-3.0** (NextLib) distribution note (already in use).
