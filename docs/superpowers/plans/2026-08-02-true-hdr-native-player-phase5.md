# True-HDR Native Player — Phase 5 Plan (playback tuning, error recovery, PiP)

> Expansion of the Phase 5 roadmap, **scoped to the highest-value production items**. **Android can't be built/run in the agent environment** — every `./gradlew`/`adb` step + behavior checks are the USER's on-device job. Branch `feat/true-hdr-native-player`. Base: `29cbb089`.

**Goal:** Make the native player robust and low-end-friendly: fast keyframe scrubbing, automatic software-decoder fallback on decode errors, a retry-able error overlay, and Picture-in-Picture.

**Deferred (documented, not built) — on-device polish for a later pass:** storyboard scrub thumbnails (complex sprite pipeline), device-cap auto-quality (JS already picks the initial variant), display refresh-rate/fps matching, and the autoplay-next settings toggle. The low-end buffer tiering is already in `ExoPlayerFactory` (32 MB on `isLowRamDevice`). Track/subtitle/speed/decoder/quality/episode menus already exist (Phases 3–4), so the "settings sheet" goal is effectively met.

## Global Constraints (inherited)
- Kotlin 1.9.20 / Compose BOM 2023.10.01 / Java 21.
- Robustness logic ported from `HybridPlayerPlugin.java` where it exists (decoder fallback, PiP).
- Commits: stage only files each task names; no `Co-Authored-By: Claude` trailer; don't push; don't commit `.superpowers/*`/`.claude/*`.

## File Structure (Phase 5)
- Modify `.../player/ExoPlayerFactory.kt` — fast-scrub seek parameters.
- Modify `.../player/ui/PlayerUiState.kt` — `errorMessage`.
- Modify `.../player/NativePlayerPlugin.kt` — decoder auto-fallback + error state; PiP (enterPip, params, inPip guard, videoW/H); mount the error overlay.
- Create `.../player/ui/ErrorOverlay.kt` — retry-able error UI.
- Modify `.../player/ui/PlayerControls.kt` — PiP button.
- Modify `.../MainActivity.java` — forward `onPictureInPictureModeChanged` to `NativePlayer`.

---

## Task 5.1: Fast scrub + decoder auto-fallback + error overlay

**Files:** Modify `ExoPlayerFactory.kt`, `ui/PlayerUiState.kt`, `NativePlayerPlugin.kt`; Create `ui/ErrorOverlay.kt`.

- [ ] **Step 1: Fast keyframe scrubbing** — in `ExoPlayerFactory.build(...)`, after the `player.setHandleAudioBecomingNoisy(true)` line (Task 2.1), add:

```kotlin
        // Keyframe (fast) seeking — big win on low-end HEVC/AV1 where exact seek decodes
        // from the previous keyframe and can take seconds.
        player.setSeekParameters(androidx.media3.exoplayer.SeekParameters.CLOSEST_SYNC)
```

- [ ] **Step 2: Error state** — add to `PlayerUiState`: `var errorMessage by mutableStateOf<String?>(null)`.

- [ ] **Step 3: Decoder auto-fallback + error surfacing** — in `NativePlayerPlugin.kt`:

Add the ported decoder-error detector:

```kotlin
    private fun isDecoderError(e: androidx.media3.common.PlaybackException): Boolean {
        val c = e.errorCode
        return c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
               c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED ||
               c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODING_FAILED ||
               c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED ||
               c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES
    }
```

Replace the existing `onPlayerError` body with (auto-fallback to software once, else surface a retry-able error):

```kotlin
        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
            // A hardware/decoder failure retries once with software decoders (ported from HybridPlayerPlugin).
            if (isDecoderError(error) && decoderMode != 2 && currentUrl != null) {
                val pos = player?.currentPosition ?: 0L
                val url = currentUrl!!
                decoderMode = 2; uiState.decoderMode = 2
                player?.release(); player = null
                doReload(url, pos)
                return
            }
            uiState.errorMessage = error.message ?: "Playback error"
            notifyListeners("playerError", JSObject().put("code", error.errorCode).put("message", error.message))
        }
```

Add a retry method and clear-on-reload:

```kotlin
    fun retryPlayback() = activity.runOnUiThread {
        val url = currentUrl ?: return@runOnUiThread
        val pos = player?.currentPosition ?: 0L
        player?.release(); player = null
        doReload(url, pos)
    }
```

In `doReload`, add `uiState.errorMessage = null` next to the `uiState.ended = false` line.

- [ ] **Step 4: `ErrorOverlay.kt`**

```kotlin
package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Full-screen retry-able error, shown when [PlayerUiState.errorMessage] is non-null. */
@Composable
fun ErrorOverlay(state: PlayerUiState, onRetry: () -> Unit, onClose: () -> Unit) {
    val msg = state.errorMessage ?: return
    Box(Modifier.fillMaxSize().background(Color(0xEE000000))) {
        Column(
            Modifier.align(Alignment.Center).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Couldn't play this video", color = Color.White, fontSize = 18.sp)
            Text(msg, color = Color(0xFF9AA0A6), fontSize = 13.sp, textAlign = TextAlign.Center)
            Button(onClick = onRetry) { Text("Retry") }
            TextButton(onClick = onClose) { Text("Close", color = Color.White) }
        }
    }
}
```

- [ ] **Step 5: Mount the overlay** — in `doReload`'s `Box(Modifier.fillMaxSize()) { … }`, add a third sibling after `NextEpisodeCard(...)`:

```kotlin
                            com.db.dbworld.player.ui.ErrorOverlay(
                                state = uiState,
                                onRetry = { retryPlayback() },
                                onClose = { dismissInternal() },
                            )
```

- [ ] **Step 6: Build (user)** — `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 7: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ExoPlayerFactory.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerUiState.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/ErrorOverlay.kt
git commit -m "feat(android): fast keyframe scrub + software-decoder auto-fallback + retry-able error overlay"
```

---

## Task 5.2: Picture-in-Picture

**Files:** Modify `NativePlayerPlugin.kt`, `ui/PlayerControls.kt`, `MainActivity.java`.

**Interfaces:** `enterPip()`, `handlePipModeChanged(isInPip)`, an `inPip` guard so background-pause doesn't fire in PiP.

- [ ] **Step 1: Video size + PiP in the plugin** — in `NativePlayerPlugin.kt`:

Add fields:

```kotlin
    private var inPip = false
    private var videoW = 0
    private var videoH = 0
```

In the listener's `onVideoSizeChanged` (added in Task 2.5), also store the size (add these two lines before/after the existing `host?.setAspectRatio(...)`):

```kotlin
            videoW = size.width; videoH = size.height
```

Guard the background-pause (Task 2.1's `handleOnPause`) so PiP keeps playing:

```kotlin
    override fun handleOnPause() {
        if (!inPip) player?.pause()
        super.handleOnPause()
    }
```

Add PiP enter + the mode-change callback:

```kotlin
    fun enterPip() = activity.runOnUiThread {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@runOnUiThread
        uiState.controlsVisible = false
        val w = if (videoW > 0) videoW else 16
        val h = if (videoH > 0) videoH else 9
        // Android rejects extreme ratios (~0.42..2.39) — clamp.
        val ratio = (w.toDouble() / h).coerceIn(0.42, 2.38)
        val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational((ratio * 1000).toInt(), 1000))
            .build()
        try { activity.enterPictureInPictureMode(params) } catch (e: Exception) {}
    }

    /** Called by MainActivity.onPictureInPictureModeChanged. */
    fun handlePipModeChanged(isInPip: Boolean) {
        inPip = isInPip
    }
```

Add imports: `android.app.PictureInPictureParams`, `android.os.Build`, `android.util.Rational`.

- [ ] **Step 2: PiP button in controls** — in `PlayerControls.kt`, add param `onEnterPip: () -> Unit`, and inside the root `Box` add a button (bottom-left, above the scrubber row) — e.g. near the back button add:

```kotlin
        IconButton(onClick = onEnterPip, modifier = Modifier.align(Alignment.TopStart).padding(start = 56.dp, top = 8.dp)) {
            Icon(Icons.Filled.PictureInPictureAlt, contentDescription = "Picture in picture", tint = Color.White)
        }
```

Add import `androidx.compose.material.icons.filled.PictureInPictureAlt`. Wire it in `doReload`'s `PlayerControls(...)` call: `onEnterPip = { enterPip() }`.

- [ ] **Step 3: Forward the mode change from MainActivity** — in `MainActivity.java`'s existing `onPictureInPictureModeChanged`, after the existing HybridPlayer forwarding block, add a NativePlayer forwarding block:

```java
        try {
            com.getcapacitor.PluginHandle nh = getBridge().getPlugin("NativePlayer");
            if (nh != null && nh.getInstance() instanceof com.db.dbworld.player.NativePlayerPlugin) {
                ((com.db.dbworld.player.NativePlayerPlugin) nh.getInstance()).handlePipModeChanged(isInPictureInPictureMode);
            }
        } catch (Exception ignored) {}
```

- [ ] **Step 4: Build (user)** — `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerControls.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/MainActivity.java
git commit -m "feat(android): Picture-in-Picture (enter + aspect + background-pause guard)"
```

---

## Phase 5 on-device verification (user)
- Scrubbing is snappy even on a weak device / high-bitrate file.
- Force a decode failure (unsupported codec) → it silently retries with software; a hard error shows the **retry-able overlay**.
- The PiP button shrinks playback into a floating window that keeps playing; returning restores the player. `AndroidManifest` already declares `android:supportsPictureInPicture="true"` on MainActivity.

## Self-Review (against Phase 5 scope)
- Fast scrub → 5.1. ✅  Decoder auto-fallback + retry error UI → 5.1. ✅  PiP → 5.2. ✅
- Deferred (documented): storyboard scrub, auto-quality, fps matching, autoplay-next toggle.
