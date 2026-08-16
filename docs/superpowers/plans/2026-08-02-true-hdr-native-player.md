# True-HDR Native Android Player — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Android TextureView-behind-transparent-WebView video path with a native `SurfaceView` + Jetpack Compose player inside `MainActivity`, delivering true HDR10/HDR10+/HLG passthrough, low-end smooth playback, FFmpeg software-decode fallback, and Netflix-class robustness — without regressing the JS-owned resume/telemetry/episode/watched logic.

**Architecture:** Video renders to a `SurfaceView` (a real display layer → panel enters HDR mode). Native Compose controls composite *above* it (reliable, unlike a WebView over a SurfaceView). Both are added into the existing `MainActivity`; the Capacitor WebView is set `INVISIBLE` but stays alive so the unchanged React/JS orchestration keeps running, fed by plugin events. A new Kotlin `NativePlayerPlugin` owns ExoPlayer + surface + Compose; the old `HybridPlayerPlugin` stays behind a feature flag until an on-device parity checklist passes.

**Tech Stack:** Kotlin 1.9.20, Jetpack Compose (BOM 2023.10.01 = runtime 1.5.4, compiler 1.5.4 — the matched triple for Kotlin 1.9.20), Java 21, AndroidX Media3 1.7.1 (`exoplayer`, `ui`, `effect`, `session`), NextLib `nextlib-media3ext` 1.7.1-0.9.0 (FFmpeg HW-fallback decoders), Capacitor plugin bridge, React (web unchanged).

**Spec:** `docs/superpowers/specs/2026-08-02-true-hdr-native-player-design.md`

## Global Constraints

- **HDR target:** HDR10 / HDR10+ / HLG passthrough on HDR displays; tone-map to SDR **only** on SDR-only displays. **Dolby Vision is OUT** (Samsung panels don't support it).
- **Video surface:** `SurfaceView` (never TextureView — TextureView cannot present HDR).
- **Controls:** native Jetpack Compose, hosted inside `MainActivity` (not a separate Activity, not a WebView overlay).
- **Orchestration stays in JS, unchanged:** stream resolve, `media` payload assembly, resume read/write (`getWatchProgress`/`saveWatchProgress`), auto-mark Watched (`addWatched`) + Continue-Watching invalidation, telemetry (`usePlayerReporting` → `STREAM_*` to `/api/track/events`), episode list build + lazy per-episode resolve, preference persistence. Native emits events; JS reacts.
- **Decode:** hardware-first, FFmpeg (NextLib) software fallback; keep HW/SW/Auto toggle.
- **Resume rule (verbatim):** resume only if `positionMs > 5000` **and** (`durationMs == 0` **or** `positionMs < durationMs - 30000`).
- **Telemetry (verbatim):** events `STREAM_START/TICK/PAUSE/SEEK/STOP`, `sessionId = requestId`, `clientApp = 'APP'` on native, `activity = 'STREAM'`; skip entirely when `requestId` is null.
- **Build:** AGP 8.8.1, Gradle Kotlin plugin 1.9.20 (already on root classpath), `compileSdk`/`targetSdk` 35, `minSdk` 23, Java 21, `abiFilters "arm64-v8a"`.
- **Web unchanged:** the HTML5 React player path (`createWebAdapter`) must not be touched.
- **License note:** NextLib is GPL-3.0 (already shipped).
- **Commits:** no `Co-Authored-By: Claude` trailer. Work stays on branch `feat/true-hdr-native-player`; do not push (the user pushes/merges).

## Environment note — verification is on-device

**Android cannot be compiled or run in the implementation environment** (Gradle "loopback" limitation). Every `Run:` step below whose command is `./gradlew …`, `adb …`, or an on-device action is executed **by the user on their machine/S24 FE**, and the plan states the expected result so they can confirm. Pure-JVM unit tests (`./gradlew :app:testDebugUnitTest`) also run on the user's machine. Do not claim a build/test passed from inside this environment.

---

## File Structure

**New (Kotlin, `android/app/src/main/java/com/db/dbworld/player/`):**
- `NativePlayerPlugin.kt` — Capacitor plugin: `present`/`loadResolved`/`dismiss`/`play`/`pause`/`seekTo`/`setRate`/`setDecoderMode`/`setOrientation`/`enterPip`; emits `playerTime`/`playerState`/`playerSeek`/`playerEnded`/`playerTracks`/`playerSelectEpisode`/`playerPrefChanged`/`playerError`/`playerPipChanged`/`playerClosed`. Owns the player session.
- `PlayerSurfaceHost.kt` — adds/removes the `SurfaceView` + a `ComposeView` into `MainActivity`'s content root; toggles WebView `INVISIBLE`↔`VISIBLE`; paints letterbox black; owns aspect-fit + zoom sizing.
- `ExoPlayerFactory.kt` — builds `ExoPlayer` (NextRenderersFactory, tuned `LoadControl`, decoder-mode selector); ported from `HybridPlayerPlugin.java`.
- `HdrSupport.kt` — pure functions: is-content-HDR, display-supports-HDR-type, tone-map-needed decision. Unit-testable.
- `probe/HdrProbeActivity.kt` — **Phase 0 throwaway**: bare full-screen SurfaceView HDR test.

**New (Kotlin tests, `android/app/src/test/java/com/db/dbworld/player/`):**
- `HdrSupportTest.kt` — JVM unit tests for the HDR decision logic.

**New (Compose UI, Phases 2–5, `.../player/ui/`):** `PlayerControls.kt`, `GestureLayer.kt`, `TrackMenus.kt`, `EpisodePanel.kt`, `SettingsSheet.kt`, `NextEpisodeCard.kt`, `StoryboardScrub.kt`, `ErrorOverlay.kt`, plus `AutoQuality.kt` + `AutoQualityTest.kt` and `BufferTier.kt` (+ test).

**Modified:**
- `android/app/build.gradle` — Kotlin + Compose.
- `android/build.gradle` — bump the forced `kotlin-stdlib` from 1.8.22 → 1.9.20 (match the compiler for Compose).
- `android/app/src/main/AndroidManifest.xml` — register `HdrProbeActivity` (Phase 0).
- `android/app/src/main/java/com/db/dbworld/MainActivity.java` — register `NativePlayerPlugin`; forward PiP to it.
- `db-world-frontend/src/features/cinema/player/hybrid/playerAdapter.js` — add a native "controller" branch that drives `NativePlayer` and maps its events; gated by the feature flag.
- `db-world-frontend/src/features/cinema/player/hybrid/DbWorldVideoPlayer.jsx` — on Android + flag on, render headless (no overlay UI) and delegate to native.
- `db-world-frontend/src/features/cinema/player/hybrid/nativePlayerFlag.js` — **new**, the feature flag.

---

## Phase 0 — Kotlin/Compose bootstrap + on-device HDR proof

**Outcome:** Kotlin + Compose compile in the `app` module, and a bare `SurfaceView` proves true HDR passthrough on the S24 FE, plus the WebView-alive-while-hidden bridge model is confirmed. This gates all UI work.

### Task 0.1: Add Kotlin + Jetpack Compose to the app module

**Files:**
- Modify: `db-world-frontend/android/app/build.gradle`
- Modify: `db-world-frontend/android/build.gradle:28-30`
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ComposeSmoke.kt`

**Interfaces:**
- Produces: a compiling Kotlin+Compose toolchain in `:app` (no runtime API).

- [ ] **Step 1: Apply the Kotlin Android plugin**

In `db-world-frontend/android/app/build.gradle`, change the top:

```groovy
apply plugin: 'com.android.application'
apply plugin: 'org.jetbrains.kotlin.android'
```

- [ ] **Step 2: Enable Compose + set the JVM/Kotlin target**

Inside the `android { … }` block, set `compileOptions` to Java 21 (matching the Kotlin `jvmTarget` and the `capacitor.build.gradle` override — KGP 1.9.20 fails on an inconsistent Java/Kotlin JVM target) and add the Kotlin/Compose options after it:

```groovy
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
    kotlinOptions {
        jvmTarget = '21'
    }
    buildFeatures {
        compose true
    }
    composeOptions {
        // Must match Kotlin 1.9.20 (the version on the root buildscript classpath).
        kotlinCompilerExtensionVersion '1.5.4'
    }
```

- [ ] **Step 3: Add the Compose dependencies**

In the `dependencies { … }` block of `db-world-frontend/android/app/build.gradle`, bump the existing kotlin-stdlib line and add Compose:

```groovy
    // Match the compiler on the root classpath (1.9.20) for Compose.
    implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.20"
    // Jetpack Compose (native player UI).
    def composeBom = platform('androidx.compose:compose-bom:2023.10.01')  // runtime 1.5.4 ↔ compiler 1.5.4
    implementation composeBom
    implementation 'androidx.compose.ui:ui'
    implementation 'androidx.compose.ui:ui-graphics'
    implementation 'androidx.compose.ui:ui-tooling-preview'
    implementation 'androidx.compose.material3:material3'
    implementation "androidx.activity:activity-compose:$androidxActivityVersion"
    debugImplementation 'androidx.compose.ui:ui-tooling'
```

Then replace the old `implementation "org.jetbrains.kotlin:kotlin-stdlib:1.8.22"` line (it is now duplicated) so only the 1.9.20 line remains.

- [ ] **Step 4: Align the forced stdlib version**

In `db-world-frontend/android/build.gradle`, change the three forced versions from `1.8.22` to `1.9.20`:

```groovy
        resolutionStrategy {
            force "org.jetbrains.kotlin:kotlin-stdlib:1.9.20"
            force "org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.9.20"
            force "org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.20"
        }
```

- [ ] **Step 5: Add a Compose smoke file to force the compiler path**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ComposeSmoke.kt`:

```kotlin
package com.db.dbworld.player

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

/** Exists only so the Compose compiler is exercised during Phase 0 bring-up. Delete after Phase 1. */
@Composable
internal fun ComposeSmoke() {
    Text("compose-ok")
}
```

- [ ] **Step 6: Build (user, on machine)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`. If it fails on `kotlinCompilerExtensionVersion`, the Kotlin plugin version differs from 1.9.20 — align `kotlinCompilerExtensionVersion` to the [Compose↔Kotlin compatibility map](https://developer.android.com/jetpack/androidx/releases/compose-kotlin) for the actual `kotlin_version` in `android/build.gradle`.

- [ ] **Step 7: Commit**

```bash
git add db-world-frontend/android/app/build.gradle db-world-frontend/android/build.gradle db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ComposeSmoke.kt
git commit -m "build(android): bootstrap Kotlin + Jetpack Compose in the app module"
```

### Task 0.2: Bare SurfaceView HDR probe Activity

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/probe/HdrProbeActivity.kt`
- Modify: `db-world-frontend/android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: an adb-launchable Activity that plays a URL on a full-screen `SurfaceView` with ExoPlayer and logs the decoded color transfer.

- [ ] **Step 1: Write the probe Activity**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/probe/HdrProbeActivity.kt`:

```kotlin
package com.db.dbworld.player.probe

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.view.SurfaceView
import android.view.ViewGroup
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer

/**
 * PHASE-0 THROWAWAY. Plays an HDR10 file on a bare full-screen SurfaceView to prove
 * true HDR passthrough on-device. Launch:
 *   adb shell am start -n com.db.dbworld/com.db.dbworld.player.probe.HdrProbeActivity \
 *     -e url "https://<host>/<hdr10-file>"
 */
class HdrProbeActivity : Activity() {
    private var player: ExoPlayer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val surface = SurfaceView(this)
        setContentView(surface, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        val url = intent.getStringExtra("url") ?: run {
            Log.e("HdrProbe", "no -e url provided"); finish(); return
        }
        val p = ExoPlayer.Builder(this).build().also { player = it }
        p.setVideoSurfaceView(surface)
        p.addListener(object : Player.Listener {
            override fun onTracksChanged(tracks: Tracks) {
                for (g in tracks.groups) {
                    if (g.type != androidx.media3.common.C.TRACK_TYPE_VIDEO) continue
                    val f = g.mediaTrackGroup.getFormat(0)
                    val ci = f.colorInfo
                    Log.i("HdrProbe", "video=${f.sampleMimeType} " +
                        "colorTransfer=${ci?.colorTransfer} colorSpace=${ci?.colorSpace} " +
                        "(ST2084=6, HLG=7)")
                }
            }
        })
        p.setMediaItem(MediaItem.fromUri(url))
        p.prepare()
        p.playWhenReady = true
    }

    override fun onDestroy() {
        player?.release(); player = null
        super.onDestroy()
    }
}
```

- [ ] **Step 2: Register the Activity**

In `db-world-frontend/android/app/src/main/AndroidManifest.xml`, add inside `<application>`:

```xml
        <activity
            android:name="com.db.dbworld.player.probe.HdrProbeActivity"
            android:exported="true"
            android:theme="@style/AppTheme.NoActionBar" />
```

(If `@style/AppTheme.NoActionBar` does not exist, use the theme already applied to `MainActivity` in this manifest.)

- [ ] **Step 3: Build + install (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:installDebug`
Expected: `BUILD SUCCESSFUL`, app installed on the S24 FE.

- [ ] **Step 4: Launch the probe against an HDR10 file (user, on-device)**

Run:
```bash
adb shell am start -n com.db.dbworld/com.db.dbworld.player.probe.HdrProbeActivity -e url "https://<host>/<your-1080p-av1-hdr-file>"
adb logcat -s HdrProbe:I
```
Expected:
- The clip plays at **correct brightness** (not dark — daytime scenes look normal, faces visible).
- Logcat prints `colorTransfer=6` (ST2084/PQ) or `7` (HLG).
- The phone shows its HDR indicator (Settings varies) / `adb shell dumpsys display | grep -iE "hdr|colorMode"` reflects HDR while playing.

**This is the gate: if the video is bright and HDR is active, true passthrough works and the plan proceeds. If it is still dark, capture logcat + `dumpsys SurfaceFlinger --latency` and stop for diagnosis.**

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/probe/HdrProbeActivity.kt db-world-frontend/android/app/src/main/AndroidManifest.xml
git commit -m "test(android): Phase-0 bare SurfaceView HDR passthrough probe"
```

### Task 0.3: Confirm WebView stays alive + bridge delivers while hidden

**Files:**
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/probe/HdrProbeActivity.kt` (reuse) — **skip**; instead prove the in-`MainActivity` model:
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/probe/WebviewHiddenProbe.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/MainActivity.java`

**Interfaces:**
- Produces: proof that with the WebView `INVISIBLE` and a SurfaceView added to `MainActivity`'s content, (a) HDR video shows and (b) `evaluateJavascript`-delivered plugin events still run in the WebView.

- [ ] **Step 1: Write the in-Activity probe helper**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/probe/WebviewHiddenProbe.kt`:

```kotlin
package com.db.dbworld.player.probe

import android.app.Activity
import android.graphics.Color
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer

/**
 * PHASE-0 THROWAWAY. Hides the Capacitor WebView (INVISIBLE, still alive), adds a
 * SurfaceView playing a hardcoded HDR URL into MainActivity's content, and pings JS once
 * a second so we can confirm the bridge still delivers while the WebView is hidden.
 */
object WebviewHiddenProbe {
    private var player: ExoPlayer? = null

    fun start(activity: Activity, webView: WebView, url: String, ping: (Long) -> Unit) {
        val parent = webView.parent as ViewGroup
        val surface = SurfaceView(activity)
        parent.addView(surface, 0, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        parent.setBackgroundColor(Color.BLACK)
        webView.visibility = View.INVISIBLE   // alive, not drawn

        val p = ExoPlayer.Builder(activity).build().also { player = it }
        p.setVideoSurfaceView(surface)
        p.setMediaItem(MediaItem.fromUri(url))
        p.prepare(); p.playWhenReady = true

        val h = android.os.Handler(activity.mainLooper)
        var n = 0L
        val tick = object : Runnable { override fun run() { ping(n++); h.postDelayed(this, 1000) } }
        h.post(tick)
    }
}
```

- [ ] **Step 2: Wire a temporary trigger + JS ping in MainActivity**

In `MainActivity.java`, add a temporary method (remove after Phase 0) that JS can hit via `eval`, and have it call `WebviewHiddenProbe.start(...)` with `ping` doing `getBridge().eval("console.log('probe-tick ' + " + n + ")", null)`. Trigger it from the browser console: `window.dbworldProbe && window.dbworldProbe('<hdr-url>')` after exposing a JS hook, or simply call the Kotlin `start` from a debug button.

(Implementation detail: the exact trigger is throwaway; the requirement is only that `WebviewHiddenProbe.start` runs.)

- [ ] **Step 3: Verify on-device (user)**

Run: install, open the app, trigger the probe, then:
```bash
adb logcat -s chromium:I | grep probe-tick
```
Expected:
- HDR video visible & bright with the WebView hidden.
- `probe-tick 0,1,2,…` keeps logging (JS is alive and the bridge delivers while the WebView is `INVISIBLE`).

**Gate: both true → the Phase-1 architecture (native surface + hidden-but-alive WebView) is validated.**

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/probe/WebviewHiddenProbe.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/MainActivity.java
git commit -m "test(android): Phase-0 hidden-WebView + native SurfaceView bridge probe"
```

---

## Phase 1 — Player shell + bridge + JS orchestration preserved (feature-flagged)

**Outcome:** A `NativePlayerPlugin` plays the current title on a `SurfaceView` inside `MainActivity` with the WebView hidden, emits the events the existing JS expects, and JS resume/telemetry/watched/episode logic runs unchanged — all behind a feature flag, with the old TextureView path still shippable. No custom Compose controls yet (an empty Compose layer is mounted so the host is proven).

### Task 1.1: HDR decision logic (pure, unit-tested)

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/HdrSupport.kt`
- Test: `db-world-frontend/android/app/src/test/java/com/db/dbworld/player/HdrSupportTest.kt`

**Interfaces:**
- Produces: `HdrSupport.isHdrTransfer(colorTransfer: Int): Boolean`, `HdrSupport.needsToneMap(colorTransfer: Int, displaySupportedHdrTypes: IntArray): Boolean`.

- [ ] **Step 1: Write the failing test**

Create `db-world-frontend/android/app/src/test/java/com/db/dbworld/player/HdrSupportTest.kt`:

```kotlin
package com.db.dbworld.player

import android.view.Display.HdrCapabilities.HDR_TYPE_HDR10
import android.view.Display.HdrCapabilities.HDR_TYPE_HLG
import androidx.media3.common.C
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HdrSupportTest {
    @Test fun pqAndHlgAreHdr() {
        assertTrue(HdrSupport.isHdrTransfer(C.COLOR_TRANSFER_ST2084))
        assertTrue(HdrSupport.isHdrTransfer(C.COLOR_TRANSFER_HLG))
    }
    @Test fun sdrTransferIsNotHdr() {
        assertFalse(HdrSupport.isHdrTransfer(C.COLOR_TRANSFER_SDR))
    }
    @Test fun hdrContentOnSdrDisplayNeedsToneMap() {
        assertTrue(HdrSupport.needsToneMap(C.COLOR_TRANSFER_ST2084, IntArray(0)))
    }
    @Test fun hdrContentOnHdrDisplayDoesNotToneMap() {
        assertFalse(HdrSupport.needsToneMap(C.COLOR_TRANSFER_ST2084, intArrayOf(HDR_TYPE_HDR10)))
    }
    @Test fun sdrContentNeverToneMaps() {
        assertFalse(HdrSupport.needsToneMap(C.COLOR_TRANSFER_SDR, IntArray(0)))
    }
}
```

- [ ] **Step 2: Run the test — verify it fails (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:testDebugUnitTest --tests "com.db.dbworld.player.HdrSupportTest"`
Expected: FAIL — `HdrSupport` unresolved.

- [ ] **Step 3: Implement `HdrSupport`**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/HdrSupport.kt`:

```kotlin
package com.db.dbworld.player

import android.view.Display
import androidx.media3.common.C

/** Pure HDR decision helpers — no Android view state, so JVM-unit-testable. */
object HdrSupport {

    /** True for the two HDR transfer functions we passthrough/tone-map: PQ (HDR10/10+) and HLG. */
    fun isHdrTransfer(colorTransfer: Int): Boolean =
        colorTransfer == C.COLOR_TRANSFER_ST2084 || colorTransfer == C.COLOR_TRANSFER_HLG

    /**
     * Tone-map is needed only when the content is HDR AND the display does not advertise a
     * matching HDR type. PQ maps to HDR10/HDR10+; HLG maps to HLG.
     */
    fun needsToneMap(colorTransfer: Int, displaySupportedHdrTypes: IntArray): Boolean {
        if (!isHdrTransfer(colorTransfer)) return false
        val wanted = when (colorTransfer) {
            C.COLOR_TRANSFER_ST2084 -> intArrayOf(
                Display.HdrCapabilities.HDR_TYPE_HDR10,
                Display.HdrCapabilities.HDR_TYPE_HDR10_PLUS)
            else -> intArrayOf(Display.HdrCapabilities.HDR_TYPE_HLG)
        }
        return wanted.none { it in displaySupportedHdrTypes }
    }
}
```

- [ ] **Step 4: Run the test — verify it passes (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:testDebugUnitTest --tests "com.db.dbworld.player.HdrSupportTest"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/HdrSupport.kt db-world-frontend/android/app/src/test/java/com/db/dbworld/player/HdrSupportTest.kt
git commit -m "feat(android): HDR passthrough-vs-tonemap decision logic + tests"
```

### Task 1.2: `ExoPlayerFactory` — port the player build to Kotlin

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ExoPlayerFactory.kt`

**Interfaces:**
- Produces: `ExoPlayerFactory.build(context: Context, decoderMode: Int): ExoPlayer`.
- Consumes: nothing new (mirrors `HybridPlayerPlugin.buildPlayer`/`buildLoadControl`/`preferSelector`).

- [ ] **Step 1: Implement the factory (direct port)**

Port `buildPlayer()`, `buildLoadControl()`, and `preferSelector()` from `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/HybridPlayerPlugin.java:132-197` verbatim in behaviour into Kotlin. Create `ExoPlayerFactory.kt`:

```kotlin
package com.db.dbworld.player

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.LoadControl
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import androidx.media3.exoplayer.upstream.DefaultAllocator
import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.NextRenderersFactory

@UnstableApi
object ExoPlayerFactory {

    /** decoderMode: 0 auto · 1 hardware-first · 2 software-first. Mirrors HybridPlayerPlugin. */
    fun build(context: Context, decoderMode: Int): ExoPlayer {
        val rf = NextRenderersFactory(context)
            .setEnableDecoderFallback(true)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
        when (decoderMode) {
            1 -> rf.setMediaCodecSelector(preferSelector(true))
            2 -> rf.setMediaCodecSelector(preferSelector(false))
        }
        val player = ExoPlayer.Builder(context, rf)
            .setLoadControl(buildLoadControl(context))
            .build()
        player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
            .setPreferredAudioLanguage("hin")
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            .build()
        return player
    }

    private fun buildLoadControl(context: Context): LoadControl {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val lowRam = am.isLowRamDevice
        // Phase-5 tightens this via BufferTier; Phase-1 keeps parity with the current values,
        // only shrinking the byte ceiling on low-RAM devices to avoid OOM.
        val targetBytes = if (lowRam) 32 * 1024 * 1024 else 96 * 1024 * 1024
        return DefaultLoadControl.Builder()
            .setAllocator(DefaultAllocator(true, 64 * 1024))
            .setBufferDurationsMs(30_000, 120_000, 2_500, 7_000)
            .setTargetBufferBytes(targetBytes)
            .setPrioritizeTimeOverSizeThresholds(false)
            .setBackBuffer(30_000, true)
            .build()
    }

    private fun preferSelector(preferHardware: Boolean) = MediaCodecSelector { mime, secure, tunneling ->
        val infos = ArrayList(MediaCodecUtil.getDecoderInfos(mime, secure, tunneling))
        infos.sortWith(Comparator { a, b ->
            val aw = if (a.softwareOnly) 1 else 0
            val bw = if (b.softwareOnly) 1 else 0
            if (preferHardware) aw.compareTo(bw) else bw.compareTo(aw)
        })
        infos
    }
}
```

- [ ] **Step 2: Build (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ExoPlayerFactory.kt
git commit -m "feat(android): Kotlin ExoPlayerFactory (ported player/loadcontrol/decoder build)"
```

### Task 1.3: `PlayerSurfaceHost` — mount SurfaceView + Compose, hide WebView

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/PlayerSurfaceHost.kt`

**Interfaces:**
- Produces: `PlayerSurfaceHost(activity)`, methods `attach(): SurfaceView`, `mountCompose(content: @Composable () -> Unit)`, `detach()`.
- Consumes: the Capacitor `Bridge`'s WebView (`bridge.webView`).

- [ ] **Step 1: Implement the host**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/PlayerSurfaceHost.kt`:

```kotlin
package com.db.dbworld.player

import android.app.Activity
import android.graphics.Color
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.ComposeView

/**
 * Owns the on-screen player layers inside MainActivity: a SurfaceView (video) at the bottom
 * and a ComposeView (controls) on top, with the Capacitor WebView hidden-but-alive between
 * plays. Native-over-SurfaceView compositing is reliable (unlike a WebView over a SurfaceView),
 * which is the whole reason true HDR works here.
 */
class PlayerSurfaceHost(private val activity: Activity, private val webView: WebView) {

    private var surface: SurfaceView? = null
    private var compose: ComposeView? = null
    private val parent: ViewGroup get() = webView.parent as ViewGroup

    fun attach(): SurfaceView {
        if (surface == null) {
            surface = SurfaceView(activity).also {
                parent.addView(it, 0, ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
            compose = ComposeView(activity).also {
                parent.addView(it, ViewGroup.LayoutParams(   // above the surface
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
            parent.setBackgroundColor(Color.BLACK)   // black letterbox bars
            webView.setBackgroundColor(Color.TRANSPARENT)
            webView.visibility = View.INVISIBLE       // alive, not drawn
        }
        return surface!!
    }

    fun mountCompose(content: @Composable () -> Unit) {
        compose?.setContent(content)
    }

    fun detach() {
        compose?.let { parent.removeView(it) }; compose = null
        surface?.let { parent.removeView(it) }; surface = null
        parent.setBackgroundColor(Color.TRANSPARENT)
        webView.setBackgroundColor(Color.WHITE)
        webView.visibility = View.VISIBLE
    }
}
```

- [ ] **Step 2: Build (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/PlayerSurfaceHost.kt
git commit -m "feat(android): PlayerSurfaceHost — SurfaceView+Compose layers, hidden WebView"
```

### Task 1.4: `NativePlayerPlugin` — present/dismiss + event bridge + HDR branch

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/MainActivity.java`

**Interfaces:**
- Produces (JS-visible plugin `NativePlayer`): commands `present({url,startMs,decoderMode})`, `play()`, `pause()`, `seekTo({positionMs})`, `setRate({rate})`, `dismiss()`; events `playerTime`, `playerState`, `playerEnded`, `playerError`, `playerTracks`, `playerClosed`.
- Consumes: `ExoPlayerFactory.build`, `PlayerSurfaceHost`, `HdrSupport`.

- [ ] **Step 1: Implement the plugin (playback + HDR branch + event emission)**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt`:

```kotlin
package com.db.dbworld.player

import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@UnstableApi
@CapacitorPlugin(name = "NativePlayer")
class NativePlayerPlugin : Plugin() {

    private var player: ExoPlayer? = null
    private var host: PlayerSurfaceHost? = null
    private var decoderMode = 0
    private var toneMapApplied = false
    private val ui = Handler(Looper.getMainLooper())

    private val ticker = object : Runnable {
        override fun run() {
            val p = player ?: return
            val e = JSObject()
                .put("positionMs", maxOf(0, p.currentPosition))
                .put("durationMs", if (p.duration > 0) p.duration else 0)
                .put("bufferedMs", maxOf(0, p.bufferedPosition))
            notifyListeners("playerTime", e)
            ui.postDelayed(this, 250)
        }
    }

    @PluginMethod
    fun present(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrEmpty()) { call.reject("url required"); return }
        val startMs = call.getDouble("startMs")?.toLong() ?: 0L
        decoderMode = call.getInt("decoderMode", 0)!!
        activity.runOnUiThread {
            try {
                val h = host ?: PlayerSurfaceHost(activity, bridge.webView).also { host = it }
                val surface = h.attach()
                h.mountCompose { /* Phase 2+ controls mount here */ }
                val p = player ?: ExoPlayerFactory.build(context, decoderMode).also {
                    player = it; it.addListener(listener)
                }
                p.setVideoSurfaceView(surface)
                toneMapApplied = false
                p.setMediaItem(MediaItem.fromUri(url))
                p.prepare()
                if (startMs > 0) p.seekTo(startMs)
                p.playWhenReady = true
                ui.removeCallbacks(ticker); ui.post(ticker)
                call.resolve()
            } catch (t: Throwable) {
                call.reject("present failed: ${t.message}")
            }
        }
    }

    @PluginMethod fun play(call: PluginCall) { onPlayer { it.playWhenReady = true }; call.resolve() }
    @PluginMethod fun pause(call: PluginCall) { onPlayer { it.playWhenReady = false }; call.resolve() }
    @PluginMethod fun seekTo(call: PluginCall) {
        val ms = call.getDouble("positionMs")?.toLong() ?: 0L
        onPlayer { it.seekTo(ms) }; notifyListeners("playerSeek", JSObject().put("positionMs", ms)); call.resolve()
    }
    @PluginMethod fun setRate(call: PluginCall) {
        val r = call.getDouble("rate")?.toFloat() ?: 1f; onPlayer { it.setPlaybackSpeed(r) }; call.resolve()
    }

    @PluginMethod
    fun dismiss(call: PluginCall) {
        activity.runOnUiThread {
            ui.removeCallbacks(ticker)
            val pos = player?.currentPosition ?: 0L
            val dur = player?.duration?.coerceAtLeast(0) ?: 0L
            player?.release(); player = null
            host?.detach()
            notifyListeners("playerClosed", JSObject().put("positionMs", pos).put("durationMs", dur))
            call.resolve()
        }
    }

    private fun onPlayer(block: (ExoPlayer) -> Unit) =
        activity.runOnUiThread { player?.let(block) }

    /** Enable HDR→SDR tone-map only when content is HDR and the display can't show that HDR type. */
    private fun applyHdrBranch(tracks: Tracks) {
        if (toneMapApplied) return
        val display = activity.windowManager.defaultDisplay
        @Suppress("DEPRECATION")
        val supported = display.hdrCapabilities?.supportedHdrTypes ?: IntArray(0)
        for (g in tracks.groups) {
            if (g.type != C.TRACK_TYPE_VIDEO) continue
            val ci = g.mediaTrackGroup.getFormat(0).colorInfo ?: continue
            if (HdrSupport.needsToneMap(ci.colorTransfer, supported)) {
                try { player?.setVideoEffects(emptyList()); toneMapApplied = true } catch (_: Throwable) {}
            }
            return
        }
    }

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            notifyListeners("playerState", JSObject().put("playing", isPlaying))
        }
        override fun onPlaybackStateChanged(state: Int) {
            notifyListeners("playerState", JSObject().put("state", state))
            if (state == Player.STATE_ENDED) notifyListeners("playerEnded", JSObject())
        }
        override fun onTracksChanged(tracks: Tracks) {
            applyHdrBranch(tracks)
            // Phase-3 emits full playerTracks; Phase-1 emits a minimal presence signal.
            notifyListeners("playerTracks", JSObject())
        }
        override fun onPlayerError(error: PlaybackException) {
            notifyListeners("playerError", JSObject()
                .put("code", error.errorCode).put("message", error.message))
        }
    }

    override fun handleOnDestroy() {
        ui.removeCallbacks(ticker)
        player?.release(); player = null
        super.handleOnDestroy()
    }
}
```

- [ ] **Step 2: Register the plugin in MainActivity**

In `db-world-frontend/android/app/src/main/java/com/db/dbworld/MainActivity.java`, add the import and the registration line beside the others:

```java
import com.db.dbworld.player.NativePlayerPlugin;
```
```java
        registerPlugin(NativePlayerPlugin.class);
```

- [ ] **Step 3: Build (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/MainActivity.java
git commit -m "feat(android): NativePlayer plugin — present/dismiss, event bridge, HDR branch"
```

### Task 1.5: JS feature flag + native controller (preserve resume/telemetry)

**Files:**
- Create: `db-world-frontend/src/features/cinema/player/hybrid/nativePlayerFlag.js`
- Modify: `db-world-frontend/src/features/cinema/player/hybrid/playerAdapter.js`

**Why NOT `DbWorldVideoPlayer.jsx` (scope correction from on-file inspection):** the original plan proposed making `DbWorldVideoPlayer` "headless." That is unnecessary and risky for Phase 1. When the native player runs, `PlayerSurfaceHost` sets the Capacitor WebView `INVISIBLE`, so the entire React overlay is already inert. And the regression-critical logic — `usePlayerReporting` (line 277), `onProgress`/`handleProgress` (resume/timestamp), and the `appStateChange` progress-save (line 548) — runs at the component's top level, driven by adapter events, **independent of the visible JSX**. The `<video>` element is web-only (`{!isNative && …}`, line 1016). So `createPlayerAdapter` transparently returning the native controller is enough: the native player plays + hides the WebView, and the untouched hooks keep firing resume/telemetry. Leaving the 1970-line component untouched is the lowest-regression-risk path. (The "don't even render the dead overlay" perf optimization is deferred to Phase 2, once real native controls exist.)

**Interfaces:**
- Consumes (native plugin `NativePlayer`): `present`, `play`, `pause`, `seekTo`, `setRate`, `dismiss`, events `playerTime/playerState/playerEnded/playerError/playerClosed`.
- Produces: `isNativePlayerEnabled(): boolean`; a native adapter branch whose `on('time'|'state'|'ended'|'error', cb)` feeds the **existing** `usePlayerReporting`/`handleProgress` unchanged.

- [ ] **Step 1: Add the flag**

Create `db-world-frontend/src/features/cinema/player/hybrid/nativePlayerFlag.js`:

```js
// Feature flag for the native (SurfaceView+Compose) Android player. While it's being built,
// default OFF so the shipping TextureView path is unchanged. Flip via localStorage
// (dbworld.nativePlayer = '1') for on-device testing; hard-enable here when parity passes.
import { Capacitor } from '@capacitor/core';

export function isNativePlayerEnabled() {
  if (Capacitor.getPlatform() !== 'android') return false;
  try { return localStorage.getItem('dbworld.nativePlayer') === '1'; } catch { return false; }
}
```

- [ ] **Step 2: Add the native controller adapter**

In `db-world-frontend/src/features/cinema/player/hybrid/playerAdapter.js`, register the new plugin and add a controller factory that maps `present` + events onto the existing adapter interface. Add near the top:

```js
const NativePlayer = registerPlugin('NativePlayer');

const NATIVE_EVENT_MAP = { time: 'playerTime', state: 'playerState', ended: 'playerEnded', error: 'playerError', closed: 'playerClosed', tracks: 'playerTracks', seek: 'playerSeek' };

function createNativeControllerAdapter() {
  return {
    kind: 'native-controller',
    load:    (url, startMs = 0) => NativePlayer.present({ url, startMs: Math.max(0, Math.round(startMs)) }),
    play:    () => NativePlayer.play(),
    pause:   () => NativePlayer.pause(),
    seekTo:  (ms) => NativePlayer.seekTo({ positionMs: Math.max(0, Math.round(ms)) }),
    setRate: (rate) => NativePlayer.setRate({ rate }),
    setVolume: () => {},          // Phase-2: native gesture owns volume
    getVolume: () => Promise.resolve({ value: 1 }),
    setBrightness: () => {},      // Phase-2
    setZoom: () => {},            // Phase-2
    selectAudioTrack: () => {},   // Phase-3
    selectTextTrack: () => {},    // Phase-3
    setDecoderMode: () => {},     // Phase-3 (plugin has no setDecoderMode yet)
    setOrientation: () => {},     // Phase-2
    enterPip: () => {},           // Phase-2 (plugin has no enterPip yet)
    release: () => NativePlayer.dismiss(),
    on: (event, cb) => {
      const name = NATIVE_EVENT_MAP[event];
      if (!name) return () => {};   // ignore events the Phase-1 plugin doesn't emit (info/volume/pip)
      let handle;
      NativePlayer.addListener(name, cb).then(h => { handle = h; });
      return () => handle?.remove?.();
    },
  };
}
```

Stubbing `setDecoderMode`/`enterPip`/etc. as no-ops (rather than optionally calling not-yet-implemented plugin methods) avoids unhandled promise rejections; they're wired for real in Phases 2–3. The `on()` guard prevents `addListener(undefined, …)` for events the component subscribes to but the Phase-1 plugin doesn't emit.

Then update the factory at the bottom:

```js
export function createPlayerAdapter(getVideo) {
  if (isNativePlayerEnabled()) return createNativeControllerAdapter();
  return Capacitor.getPlatform() === 'android' ? createNativeAdapter() : createWebAdapter(getVideo);
}
```

Add the import at the top: `import { isNativePlayerEnabled } from './nativePlayerFlag';`

- [ ] **Step 3: Lint the two files (runnable here — pure JS)**

Run: `cd db-world-frontend && npx eslint src/features/cinema/player/hybrid/nativePlayerFlag.js src/features/cinema/player/hybrid/playerAdapter.js`
Expected: no errors. (Fix any before committing. Unlike the Android tasks, this JS lint runs in the implementation environment.)

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/src/features/cinema/player/hybrid/nativePlayerFlag.js db-world-frontend/src/features/cinema/player/hybrid/playerAdapter.js
git commit -m "feat(player): flag-gated native controller adapter; JS orchestration preserved"
```

- [ ] **Step 5: On-device verify (user) — the regression-safety gate for Phase 1**

Build + install, set `localStorage['dbworld.nativePlayer']='1'`, play a title, then check:
- Video plays on the native SurfaceView; **HDR title is bright** on the S24 FE.
- Close/reopen the title → **resume position is correct** (`GET /api/cinema/progress`).
- Network/`adb logcat` shows `saveWatchProgress` PUTs and `STREAM_START/TICK/STOP` to `/api/track/events` with `clientApp=APP`.
- Finish a movie/last episode → it drops out of Continue-Watching (`addWatched` fired).
- **Known Phase-1 limitation:** the native player has **no on-screen controls yet** (empty Compose layer — controls arrive in Phase 2), so there is no in-player pause/seek/close. Exit by backing out / killing the app; progress is saved periodically so resume still works. This is expected, not a bug.

Expected: all true → JS orchestration is preserved with the native surface.

---

## Phases 2–6 — Roadmap (expand into their own plans after Phase 0/1 on-device sign-off)

These phases are deliberately **not** expanded to full code yet: their detail depends on what Phase 0/1 reveal on-device (surface z-order behaviour, HDR window mode, bridge cadence under load), and nothing can be compiled between now and then, so speculative code would churn. Each will be turned into its own detailed plan (same TDD/bite-sized format) when reached. Task-level breakdown:

### Phase 2 — Transport, gestures, lifecycle, zoom
- `ui/PlayerControls.kt` — Compose transport (play/pause, seek bar with buffered fill, time), auto-hide, driven by `playerTime`/`playerState` piped from the plugin into Compose state.
- `ui/GestureLayer.kt` — tap-toggle, double-tap ±10 s, left-swipe brightness (window attr), right-swipe volume (system `STREAM_MUSIC` + observer, ported from `HybridPlayerPlugin`), pinch-zoom, lock.
- **Zoom/aspect rework** — SurfaceView can't `setTransform`; use a Media3 `AspectRatioFrameLayout`/`resizeMode` (or scale the SurfaceView container) for fit + pinch-zoom.
- **Audio focus + becoming-noisy** — `setAudioAttributes(..., handleAudioFocus=true)`, `setHandleAudioBecomingNoisy(true)`.
- **Lifecycle** — pause on background (except PiP), save progress on pause/background, clean release.
- On-device checks: gestures, brightness/volume sync with hardware keys, no leak on rotate, auto-pause on call/unplug.

### Phase 3 — Track menus, speed, decoder, subtitles
- `ui/TrackMenus.kt` — audio/subtitle selection (lang/codec/channels labels, ported from `HybridPlayerPlugin.emitTracks`/`langName`/`codecName`); `NativePlayer.selectAudioTrack/selectTextTrack`; full `playerTracks` payload emitted for JS pref persistence.
- Speed 0.25–2×; decoder HW/SW/Auto (live recreate, ported); subtitle rendering via Media3 `SubtitleView` in an `AndroidView` (or a Compose cue layer), honoring system caption style.
- On-device checks: switch audio/subs mid-play, decoder fallback, PGS/ASS/SRT/VTT render.

### Phase 4 — Episodes, next-episode, quality
- `ui/EpisodePanel.kt` (seasons/eps, current highlighted) + `ui/NextEpisodeCard.kt` (10 s autoplay, cancellable) fed by `media.episodes`.
- Episode tap → emit `playerSelectEpisode{mediaFileId}` → **existing JS `selectEpisode`** resolves the lazy URL → `NativePlayer.loadResolved({url,startMs,…})`; per-episode telemetry re-arm preserved.
- Quality switch uses the already-resolved `variants[]` URLs (no bridge round-trip), preserving position + audio/sub language.
- On-device checks: episode switch resumes correct point, next-ep autoplay carries language, quality switch is seamless.

### Phase 5 — Settings sheet, storyboard scrub, PiP, low-end, errors
- `ui/SettingsSheet.kt` (quality/audio/subs/speed/decoder/autoplay) — pref changes → `playerPrefChanged` → JS persists.
- `ui/StoryboardScrub.kt` — sprite tiles from `media.storyboard` on seek-bar drag.
- **PiP** — port `enterPip`/`buildPipParams`/receiver from `HybridPlayerPlugin`; MainActivity already forwards `onPictureInPictureModeChanged`.
- **Low-end bundle:** `AutoQuality.kt` (+ test) — pick highest variant ≤ display height and ≤ `MediaCodecList` decode ceiling; `BufferTier.kt` (+ test) — buffer sizing by `isLowRamDevice`; fps/refresh-rate matching; `SeekParameters.CLOSEST_SYNC` fast scrub.
- `ui/ErrorOverlay.kt` — retry-able error UI (`playerError`), transient-retry policy.
- On-device checks: smooth on a weak device at auto-quality; scrub thumbnails; PiP; error→retry.

### Phase 6 — Parity sign-off + remove old path
- Run the full **parity checklist** (spec §9) on-device.
- Flip `isNativePlayerEnabled` to default-on; after a soak, delete `HybridPlayerPlugin.java`, the `HybridPlayer` plugin registration, and the TextureView adapter branch; delete Phase-0 probes and `ComposeSmoke.kt`.
- Update memory/spec status to "shipped".

---

## Self-Review (against the spec)

- **HDR passthrough + per-display branch** → Task 0.2 (proof), Task 1.1 (logic + tests), Task 1.4 (`applyHdrBranch`). ✅
- **SurfaceView + native Compose in MainActivity, WebView hidden-but-alive** → Task 0.3 (proof), Task 1.3 (`PlayerSurfaceHost`). ✅
- **JS orchestration preserved (resume/telemetry/watched/episodes)** → Task 1.5 + Phase 4 (`selectEpisode` bridge). ✅
- **HW-first + FFmpeg SW fallback + HW/SW/Auto** → Task 1.2 (`ExoPlayerFactory`, NextRenderersFactory), Phase 3 (toggle). ✅
- **Low-end bundle** → Task 1.2 (low-RAM buffer shrink now) + Phase 5 (auto-quality, fps match, fast scrub). ✅
- **Production robustness (audio focus, lifecycle, errors)** → Phase 2 + Phase 5. ✅
- **Feature flag + parity gate** → Task 1.5 (flag), Phase 6 (checklist + removal). ✅
- **Kotlin/Compose bootstrap (versions verbatim)** → Task 0.1. ✅
- **Web unchanged** → `createWebAdapter` untouched; flag only affects Android. ✅
- **Full-code Compose UI** for Phases 2–5 is intentionally roadmapped (not placeholder) pending Phase 0/1 device findings — see rationale above.
