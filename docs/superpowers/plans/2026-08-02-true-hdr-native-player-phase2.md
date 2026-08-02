# True-HDR Native Player — Phase 2 Plan (transport, gestures, lifecycle, aspect)

> Expansion of the Phase 2 roadmap in `2026-08-02-true-hdr-native-player.md`. Same conventions: bite-sized TDD-ish steps; **Android can't be built/run in the agent environment**, so every `./gradlew`/`adb` step and all visual/behavioral verification is the USER's on-device job. Branch `feat/true-hdr-native-player`. Base: `939bf9b7`.

**Goal:** Give the native player a working control surface + gestures, make it robust (audio focus, becoming-noisy, background-pause), and fix aspect-fit for the SurfaceView — so a title is fully watchable natively with correct letterboxing.

**Scope note:** this is a *functional* first cut of the Compose UI (transport + gestures), not final pixel-parity with the React "Prime" player — visual polish (spacing, animations, exact styling) is iterated on-device in a later pass. Freeform pinch-zoom, the lock toggle, PiP, storyboard scrub, and the settings/episode sheets remain in Phases 3–5.

## Global Constraints (inherited)
- Kotlin 1.9.20 / Compose compiler 1.5.4 / Compose BOM 2023.10.01 / Java 21 / minSdk 23.
- Native player lives in `MainActivity` (video SurfaceView + Compose controls over it; WebView hidden). JS keeps resume/telemetry ownership — do NOT move backend logic into native.
- Brightness/volume are handled NATIVELY here (the gesture layer calls the plugin directly), mirroring the values `HybridPlayerPlugin.java` used.
- Commits: stage only files each task names; no `Co-Authored-By: Claude` trailer; do not push; don't commit `.superpowers/*` or `.claude/*`.

---

## File Structure (Phase 2)
- Modify `.../player/ExoPlayerFactory.kt` — audio attributes (focus) + becoming-noisy.
- Modify `.../player/NativePlayerPlugin.kt` — background-pause, UI-state updates, brightness/volume helpers, mount real controls, aspect wiring.
- Create `.../player/ui/PlayerUiState.kt` — observable playback snapshot for Compose.
- Create `.../player/ui/PlayerControls.kt` — Compose transport overlay.
- Create `.../player/ui/GestureLayer.kt` — tap/double-tap/swipe gestures.
- Modify `.../player/PlayerSurfaceHost.kt` — wrap SurfaceView in `AspectRatioFrameLayout`; expose `setAspectRatio` + `toggleZoom`.
- Modify `android/app/build.gradle` — add `androidx.compose.material:material-icons-core`.

---

## Task 2.1: Audio focus, becoming-noisy, background-pause

**Files:**
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ExoPlayerFactory.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt`

**Interfaces:**
- Produces: player auto-pauses on audio-focus loss / headphone unplug / app background.

- [ ] **Step 1: Audio attributes (focus) + becoming-noisy in the factory**

In `ExoPlayerFactory.kt`, inside `build(...)`, immediately after `.build()` creates `player` and before returning, add:

```kotlin
        // Auto-pause on transient focus loss (calls, other media) and duck appropriately;
        // pause when headphones are unplugged.
        player.setAudioAttributes(androidx.media3.common.AudioAttributes.DEFAULT, /* handleAudioFocus= */ true)
        player.setHandleAudioBecomingNoisy(true)
```

(Place these two lines after the `player.trackSelectionParameters = ...` block, before `return player`.)

- [ ] **Step 2: Pause playback when the app goes to background**

In `NativePlayerPlugin.kt`, add this override (Capacitor `Plugin` calls it on activity pause):

```kotlin
    override fun handleOnPause() {
        // Don't keep audio playing when the app is backgrounded. (PiP, added in Phase 5,
        // will guard this.) The resulting state change is reported to JS as usual.
        player?.pause()
        super.handleOnPause()
    }
```

- [ ] **Step 3: Build (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ExoPlayerFactory.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): audio focus + becoming-noisy + background-pause for native player"
```

---

## Task 2.2: `PlayerUiState` + plugin state updates

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerUiState.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt`

**Interfaces:**
- Produces: `PlayerUiState` (Compose-observable: `positionMs`, `durationMs`, `bufferedMs`, `isPlaying`, `controlsVisible`), a single instance owned by the plugin and updated on the main thread.

- [ ] **Step 1: Create the state holder**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerUiState.kt`:

```kotlin
package com.db.dbworld.player.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Observable snapshot of playback that the Compose control layer renders from.
 * All fields are written on the main (UI) thread by NativePlayerPlugin, so Compose
 * recomposes safely without extra synchronization.
 */
class PlayerUiState {
    var positionMs by mutableLongStateOf(0L)
    var durationMs by mutableLongStateOf(0L)
    var bufferedMs by mutableLongStateOf(0L)
    var isPlaying by mutableStateOf(false)
    var controlsVisible by mutableStateOf(true)
}
```

- [ ] **Step 2: Own and update it in the plugin**

In `NativePlayerPlugin.kt`:
1. Add a field near `toneMapApplied`: `private val uiState = com.db.dbworld.player.ui.PlayerUiState()`.
2. In the `ticker` runnable, after computing the JSObject, also update the state:

```kotlin
            uiState.positionMs = maxOf(0, p.currentPosition)
            uiState.durationMs = if (p.duration > 0) p.duration else 0
            uiState.bufferedMs = maxOf(0, p.bufferedPosition)
```

3. In the listener's `onIsPlayingChanged`, add `uiState.isPlaying = isPlaying` (alongside the existing `notifyListeners`).

- [ ] **Step 3: Build (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerUiState.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): PlayerUiState observable + plugin state updates"
```

---

## Task 2.3: `PlayerControls` Compose overlay + mount

**Files:**
- Modify: `db-world-frontend/android/app/build.gradle` (add material-icons-core)
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerControls.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt` (mount + callbacks)

**Interfaces:**
- Consumes: `PlayerUiState` (Task 2.2).
- Produces: `@Composable PlayerControls(state, onPlayPause, onSeek, onClose)` and a mounted control layer driven by real playback.

- [ ] **Step 1: Add the material icons dependency**

In `db-world-frontend/android/app/build.gradle`, in the Compose dependency block, add (version comes from the BOM):

```groovy
    implementation 'androidx.compose.material:material-icons-core'
```

- [ ] **Step 2: Create the controls Composable**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerControls.kt`:

```kotlin
package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/** Formats ms as H:MM:SS or M:SS. */
private fun fmt(ms: Long): String {
    val t = (ms / 1000).coerceAtLeast(0)
    val h = t / 3600; val m = (t % 3600) / 60; val s = t % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/**
 * Transport overlay over the video SurfaceView. Reads live [state]; the parent (gesture layer)
 * toggles [PlayerUiState.controlsVisible]. Auto-hides 3s after the last interaction while playing.
 */
@Composable
fun PlayerControls(
    state: PlayerUiState,
    onPlayPause: () -> Unit,
    onSeek: (Long) -> Unit,
    onClose: () -> Unit,
) {
    if (!state.controlsVisible) return

    // Auto-hide while playing. Keys are only controlsVisible + isPlaying — do NOT add positionMs
    // (the ~4Hz ticker mutates it and would restart the delay every 250ms → never hides).
    LaunchedEffect(state.controlsVisible, state.isPlaying) {
        if (state.controlsVisible && state.isPlaying) {
            delay(3000)
            state.controlsVisible = false
        }
    }

    Box(Modifier.fillMaxSize().background(Color(0x66000000))) {
        // Top bar: back.
        IconButton(onClick = onClose, modifier = Modifier.align(Alignment.TopStart).padding(8.dp)) {
            Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
        }
        // Center play/pause.
        IconButton(onClick = onPlayPause, modifier = Modifier.align(Alignment.Center).size(72.dp)) {
            Icon(
                if (state.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                contentDescription = if (state.isPlaying) "Pause" else "Play",
                tint = Color.White,
                modifier = Modifier.size(56.dp),
            )
        }
        // Bottom scrubber + times.
        Row(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(fmt(state.positionMs), color = Color.White, fontSize = 12.sp)
            var dragging by remember { mutableStateOf(false) }
            var dragValue by remember { mutableStateOf(0f) }
            val dur = state.durationMs.coerceAtLeast(1)
            Slider(
                value = if (dragging) dragValue else state.positionMs.toFloat() / dur,
                onValueChange = { dragging = true; dragValue = it },
                onValueChangeFinished = { dragging = false; onSeek((dragValue * dur).toLong()) },
                modifier = Modifier.weight(1f),
            )
            Text(fmt(state.durationMs), color = Color.White, fontSize = 12.sp)
        }
    }
}
```

- [ ] **Step 3: Mount the controls in `present()` and add callbacks**

In `NativePlayerPlugin.kt`, replace the empty `h.mountCompose { /* Phase 2+ controls mount here */ }` with:

```kotlin
                h.mountCompose {
                    com.db.dbworld.player.ui.PlayerControls(
                        state = uiState,
                        onPlayPause = { player?.let { it.playWhenReady = !it.playWhenReady } },
                        onSeek = { ms -> player?.seekTo(ms) },
                        onClose = { dismissInternal() },
                    )
                }
```

Add a private helper `dismissInternal()` that runs the same teardown as the `dismiss(call)` method body (extract the existing teardown into `private fun dismissInternal()` and have the `@PluginMethod fun dismiss(call)` call it then `call.resolve()`), so the Compose back button and the JS `dismiss()` share one path.

- [ ] **Step 4: Build (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/build.gradle db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerControls.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): Compose transport controls (play/pause, scrubber, back) mounted over the video"
```

---

## Task 2.4: `GestureLayer` + native brightness/volume

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/GestureLayer.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt`

**Interfaces:**
- Consumes: `PlayerUiState`.
- Produces: `@Composable GestureLayer(state, onTapToggle, onDoubleSeek, onBrightnessDelta, onVolumeDelta, content)`; native `adjustBrightness(delta)` / `adjustVolume(delta)` in the plugin.

- [ ] **Step 1: Create the gesture layer**

Create `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/GestureLayer.kt`:

```kotlin
package com.db.dbworld.player.ui

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput

/**
 * Full-screen gesture surface UNDER the controls:
 *  - single tap  -> toggle controls
 *  - double tap  -> seek -10s (left half) / +10s (right half)
 *  - vertical drag on the RIGHT half -> volume; on the LEFT half -> brightness
 *    (delta is a fraction of the screen height, negative = up = increase)
 */
@Composable
fun GestureLayer(
    onTapToggle: () -> Unit,
    onDoubleSeek: (forward: Boolean) -> Unit,
    onBrightnessDelta: (Float) -> Unit,
    onVolumeDelta: (Float) -> Unit,
    content: @Composable () -> Unit,
) {
    // `size` (IntSize) comes from the PointerInputScope receiver — left/right half split.
    Box(
        Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTapToggle() },
                    onDoubleTap = { pos: Offset -> onDoubleSeek(pos.x > size.width / 2f) },
                )
            }
            .pointerInput(Unit) {
                var onRight = false
                detectVerticalDragGestures(
                    onDragStart = { pos -> onRight = pos.x > size.width / 2f },
                    onVerticalDrag = { change, dragAmount ->
                        change.consume()
                        val frac = dragAmount / size.height        // down = +, up = -
                        if (onRight) onVolumeDelta(-frac) else onBrightnessDelta(-frac)
                    },
                )
            }
    ) { content() }
}
```

- [ ] **Step 2: Native brightness/volume helpers in the plugin**

In `NativePlayerPlugin.kt`, add (mirrors `HybridPlayerPlugin.java` brightness/volume semantics — window brightness attribute, system STREAM_MUSIC volume):

```kotlin
    private val audioManager by lazy {
        context.getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager
    }

    /** delta in [-1,1] as a fraction of full range; positive = brighter. */
    fun adjustBrightness(delta: Float) = activity.runOnUiThread {
        val w = activity.window
        val lp = w.attributes
        val cur = if (lp.screenBrightness in 0f..1f) lp.screenBrightness else 0.5f
        lp.screenBrightness = (cur + delta).coerceIn(0.01f, 1f)
        w.attributes = lp
    }

    /** delta in [-1,1] as a fraction of full range; positive = louder. STREAM_MUSIC (system bar stays in sync). */
    fun adjustVolume(delta: Float) = activity.runOnUiThread {
        val max = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
        val cur = audioManager.getStreamVolume(android.media.AudioManager.STREAM_MUSIC)
        val next = (cur + Math.round(delta * max)).coerceIn(0, max)
        audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, next, 0)
    }
```

- [ ] **Step 3: Wrap the controls with the gesture layer in `present()`**

Update the `mountCompose { … }` block from Task 2.3 to nest the controls inside the gesture layer:

```kotlin
                h.mountCompose {
                    com.db.dbworld.player.ui.GestureLayer(
                        onTapToggle = { uiState.controlsVisible = !uiState.controlsVisible },
                        onDoubleSeek = { fwd ->
                            player?.let { it.seekTo((it.currentPosition + if (fwd) 10_000 else -10_000).coerceAtLeast(0)) }
                        },
                        onBrightnessDelta = { adjustBrightness(it) },
                        onVolumeDelta = { adjustVolume(it) },
                    ) {
                        com.db.dbworld.player.ui.PlayerControls(
                            state = uiState,
                            onPlayPause = { player?.let { it.playWhenReady = !it.playWhenReady } },
                            onSeek = { ms -> player?.seekTo(ms) },
                            onClose = { dismissInternal() },
                        )
                    }
                }
```

- [ ] **Step 4: Build (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/GestureLayer.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): gesture layer (tap/double-tap seek, swipe brightness/volume) + native controls wiring"
```

---

## Task 2.5: Aspect-fit via `AspectRatioFrameLayout`

**Files:**
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/PlayerSurfaceHost.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt`

**Interfaces:**
- Produces: `PlayerSurfaceHost.setAspectRatio(ratio: Float)` and `PlayerSurfaceHost.toggleZoom()`; correct letterboxing driven by the real video size.

- [ ] **Step 1: Wrap the SurfaceView in an AspectRatioFrameLayout**

In `PlayerSurfaceHost.kt`, change `attach()` so the SurfaceView is a child of a media3 `AspectRatioFrameLayout` (which sizes it to the video aspect), and keep that frame at index 0. Add the field and helpers:

```kotlin
    private var frame: androidx.media3.ui.AspectRatioFrameLayout? = null
```

Replace the SurfaceView-add block in `attach()` with:

```kotlin
        if (surface == null) {
            val f = androidx.media3.ui.AspectRatioFrameLayout(activity).apply {
                setResizeMode(androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT)
            }
            val sv = SurfaceView(activity)
            f.addView(sv, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            parent.addView(f, 0, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            surface = sv
            frame = f
            compose = ComposeView(activity).also {
                parent.addView(it, ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
            parent.setBackgroundColor(Color.BLACK)
            webView.setBackgroundColor(Color.TRANSPARENT)
            webView.visibility = View.INVISIBLE
        }
        return surface!!
```

Add helpers and update `detach()` to also remove/clear `frame`:

```kotlin
    fun setAspectRatio(ratio: Float) {
        if (ratio > 0f) frame?.setAspectRatio(ratio)
    }

    /** Toggle FIT (letterbox) <-> ZOOM (fill, crop). */
    fun toggleZoom() {
        val f = frame ?: return
        f.resizeMode = if (f.resizeMode == androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT)
            androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
        else androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
    }
```

In `detach()`, remove the `frame` (its SurfaceView child goes with it) instead of removing the bare surface, and null `frame`:

```kotlin
        compose?.let { parent.removeView(it) }; compose = null
        frame?.let { parent.removeView(it) }; frame = null; surface = null
        parent.setBackgroundColor(Color.TRANSPARENT)
        webView.setBackgroundColor(Color.WHITE)
        webView.visibility = View.VISIBLE
```

- [ ] **Step 2: Drive the aspect ratio from the real video size**

In `NativePlayerPlugin.kt`, add to the `Player.Listener`:

```kotlin
        override fun onVideoSizeChanged(size: androidx.media3.common.VideoSize) {
            val par = if (size.pixelWidthHeightRatio > 0f) size.pixelWidthHeightRatio else 1f
            if (size.height > 0) host?.setAspectRatio(size.width * par / size.height)
        }
```

- [ ] **Step 3: Build (user)**

Run: `cd db-world-frontend/android && ./gradlew :app:assembleDebug`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/PlayerSurfaceHost.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): aspect-fit via AspectRatioFrameLayout + zoom toggle, driven by video size"
```

---

## Phase 2 on-device verification (user)
Set `localStorage['dbworld.nativePlayer']='1'`, play a title, then confirm:
- **Aspect** correct (no stretch; black letterbox bars for non-16:9).
- **Tap** shows/hides controls; controls auto-hide after 3s while playing.
- **Play/pause** button + **scrubber** work; time labels correct; **back** exits.
- **Double-tap** left/right seeks ∓10s; **swipe** left-half = brightness, right-half = volume (system bar moves).
- **Robustness:** incoming call / another app's audio pauses playback; unplugging headphones pauses; backgrounding the app pauses.

## Self-Review (against Phase 2 goal)
- Audio focus / becoming-noisy / background-pause → Task 2.1. ✅
- Live control state → Task 2.2. ✅
- Transport UI (play/pause, scrubber, time, auto-hide, back) → Task 2.3. ✅
- Gestures (tap, double-tap seek, swipe brightness/volume) + native brightness/volume → Task 2.4. ✅
- Aspect-fit + zoom toggle → Task 2.5. ✅
- Deferred by design (documented): freeform pinch-zoom, lock, PiP, storyboard scrub, orientation control, settings/episode sheets → Phases 3–5; visual pixel-polish → on-device pass.
