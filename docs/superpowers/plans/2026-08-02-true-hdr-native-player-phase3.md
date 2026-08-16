# True-HDR Native Player — Phase 3 Plan (track menus, speed, decoder, subtitles)

> Expansion of the Phase 3 roadmap. Same conventions: **Android can't be built/run in the agent environment** — every `./gradlew`/`adb` step and all visual/behavior checks are the USER's on-device job. Branch `feat/true-hdr-native-player`. Base: `79e2544d`.

**Goal:** Audio/subtitle track selection (with proper labels), subtitle rendering, playback speed, and the HW/SW/Auto decoder toggle — all native, mostly ported from the existing `HybridPlayerPlugin.java`.

## Global Constraints (inherited)
- Kotlin 1.9.20 / Compose compiler 1.5.4 / Compose BOM 2023.10.01 / Java 21 / minSdk 23.
- Track/decoder/speed logic must match `HybridPlayerPlugin.java` semantics (ported, not reinvented).
- JS keeps resume/telemetry ownership; native handles only playback + UI.
- Commits: stage only files each task names; no `Co-Authored-By: Claude` trailer; don't push; don't commit `.superpowers/*`/`.claude/*`.

## File Structure (Phase 3)
- Create `.../player/TrackLabels.kt` — `PlayerTrack` data class + `langName()` / `codecName()` (ported).
- Modify `.../player/ui/PlayerUiState.kt` — track lists, selections, speed, decoderMode.
- Modify `.../player/NativePlayerPlugin.kt` — build tracks in `onTracksChanged`; `selectAudio`/`selectSubtitle`/`setSpeedNative`/`setDecoderModeNative`; `onCues` → subtitle view.
- Modify `.../player/PlayerSurfaceHost.kt` — a `SubtitleView` layer + `setCues()`.
- Create `.../player/ui/TrackMenus.kt` — Compose selection sheet (audio/subtitles/speed/decoder).
- Modify `.../player/ui/PlayerControls.kt` — a "tracks/settings" button that opens the sheet.

---

## Task 3.1: Track model + labels + build tracks

**Files:**
- Create: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/TrackLabels.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerUiState.kt`
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt`

**Interfaces:**
- Produces: `PlayerTrack(id, label)`; `langName(code)`, `codecName(mime)`; `PlayerUiState.audioTracks/subtitleTracks/selectedAudioId/selectedSubtitleId/speed/decoderMode`; the plugin populates these + keeps `audioGroups`/`textGroups`.

- [ ] **Step 1: Create `TrackLabels.kt`** (ported from `HybridPlayerPlugin.langName`/`codecName`)

```kotlin
package com.db.dbworld.player

import java.util.Locale

/** A selectable track for the Compose menus. */
data class PlayerTrack(val id: Int, val label: String)

/** Human language name from an ISO code (ported from HybridPlayerPlugin.langName). */
fun langName(code: String?): String {
    if (code.isNullOrEmpty()) return "Unknown"
    return when (code.lowercase()) {
        "hin", "hi" -> "Hindi"
        "eng", "en" -> "English"
        "tam", "ta" -> "Tamil"
        "tel", "te" -> "Telugu"
        "mal", "ml" -> "Malayalam"
        "kan", "kn" -> "Kannada"
        "ben", "bn" -> "Bengali"
        "mar", "mr" -> "Marathi"
        "pan", "pa" -> "Punjabi"
        "guj", "gu" -> "Gujarati"
        "urd", "ur" -> "Urdu"
        "spa", "es" -> "Spanish"
        "fra", "fre", "fr" -> "French"
        "deu", "ger", "de" -> "German"
        "jpn", "ja" -> "Japanese"
        "kor", "ko" -> "Korean"
        "zho", "chi", "zh" -> "Chinese"
        else -> try { Locale(code).displayLanguage } catch (e: Exception) { code }
    }
}

/** Short codec display name from a sampleMimeType (ported from HybridPlayerPlugin.codecName). */
fun codecName(mime: String?): String? {
    if (mime == null) return null
    val m = mime.lowercase()
    return when {
        m.contains("eac3") || m.contains("e-ac3") -> "E-AC3"
        m.contains("ac4") -> "AC4"
        m.contains("ac3") -> "AC3"
        m.contains("truehd") || m.contains("true-hd") -> "TrueHD"
        m.contains("dts") -> "DTS"
        m.contains("mp4a") || m.contains("aac") -> "AAC"
        m.contains("opus") -> "Opus"
        m.contains("flac") -> "FLAC"
        m.contains("mpeg") || m.contains("mp3") -> "MP3"
        m.contains("vorbis") -> "Vorbis"
        m.contains("raw") || m.contains("pcm") -> "PCM"
        else -> mime.substringAfter('/', mime).uppercase()
    }
}

/** Builds the audio-track label: "Hindi · E-AC3 · 5.1" style, skipping unknown parts. */
fun audioLabel(language: String?, codec: String?, channels: Int, title: String?): String {
    val parts = ArrayList<String>()
    (if (!language.isNullOrEmpty()) langName(language) else title)?.let { parts.add(it) }
    codec?.let { parts.add(it) }
    if (channels >= 6) parts.add("5.1") else if (channels == 2) parts.add("Stereo")
    return if (parts.isEmpty()) "Audio" else parts.joinToString(" · ")
}

/** Builds the subtitle-track label. */
fun subtitleLabel(language: String?, title: String?): String =
    if (!language.isNullOrEmpty()) langName(language) else (title ?: "Subtitle")
```

- [ ] **Step 2: Extend `PlayerUiState`**

Add to `PlayerUiState` (imports: `mutableIntStateOf`, `mutableFloatStateOf`, and `com.db.dbworld.player.PlayerTrack`):

```kotlin
    var audioTracks by mutableStateOf<List<com.db.dbworld.player.PlayerTrack>>(emptyList())
    var subtitleTracks by mutableStateOf<List<com.db.dbworld.player.PlayerTrack>>(emptyList())
    var selectedAudioId by mutableIntStateOf(-1)
    var selectedSubtitleId by mutableIntStateOf(-1)
    var speed by mutableFloatStateOf(1f)
    var decoderMode by mutableIntStateOf(0)   // 0 auto · 1 hardware · 2 software
```

- [ ] **Step 3: Build tracks in the plugin's `onTracksChanged`**

In `NativePlayerPlugin.kt`: add fields `private val audioGroups = ArrayList<androidx.media3.common.TrackGroup>()` and `private val textGroups = ArrayList<androidx.media3.common.TrackGroup>()`. Add a `private fun emitTracks(tracks: Tracks)` (ported from `HybridPlayerPlugin.emitTracks`, writing to `uiState` instead of JS):

```kotlin
    private fun emitTracks(tracks: androidx.media3.common.Tracks) {
        audioGroups.clear(); textGroups.clear()
        val audio = ArrayList<PlayerTrack>()
        val text = ArrayList<PlayerTrack>()
        var selAudio = -1; var selText = -1
        for (g in tracks.groups) {
            when (g.type) {
                androidx.media3.common.C.TRACK_TYPE_AUDIO -> {
                    val id = audioGroups.size
                    val tg = g.mediaTrackGroup
                    val f = tg.getFormat(0)
                    audio.add(PlayerTrack(id, audioLabel(f.language, codecName(f.sampleMimeType), f.channelCount, f.label)))
                    if (g.isSelected) selAudio = id
                    audioGroups.add(tg)
                }
                androidx.media3.common.C.TRACK_TYPE_TEXT -> {
                    val id = textGroups.size
                    val tg = g.mediaTrackGroup
                    val f = tg.getFormat(0)
                    text.add(PlayerTrack(id, subtitleLabel(f.language, f.label)))
                    if (g.isSelected) selText = id
                    textGroups.add(tg)
                }
            }
        }
        uiState.audioTracks = audio
        uiState.subtitleTracks = text
        uiState.selectedAudioId = selAudio
        uiState.selectedSubtitleId = selText
    }
```

Then, in the existing `onTracksChanged(tracks)` listener method, call `emitTracks(tracks)` (in addition to `applyHdrBranch(tracks)`; keep the existing `notifyListeners("playerTracks", JSObject())`).

- [ ] **Step 4: Build (user)** — `cd db-world-frontend/android && ./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/TrackLabels.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerUiState.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): track model + labels + build audio/subtitle tracks into PlayerUiState"
```

---

## Task 3.2: Track selection, speed, decoder mode (plugin)

**Files:**
- Modify: `db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt`

**Interfaces:**
- Produces: `selectAudio(id)`, `selectSubtitle(id)` (id<0 = off), `setSpeedNative(rate)`, `setDecoderModeNative(mode)`.

- [ ] **Step 1: Add the methods** (ported from `HybridPlayerPlugin.selectAudioTrack`/`selectTextTrack`/`setRate`/`setDecoderMode`)

```kotlin
    fun selectAudio(id: Int) = activity.runOnUiThread {
        val p = player ?: return@runOnUiThread
        if (id in audioGroups.indices) {
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setOverrideForType(androidx.media3.common.TrackSelectionOverride(audioGroups[id], 0))
                .build()
            uiState.selectedAudioId = id
        }
    }

    fun selectSubtitle(id: Int) = activity.runOnUiThread {
        val p = player ?: return@runOnUiThread
        p.trackSelectionParameters = if (id < 0) {
            p.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(androidx.media3.common.C.TRACK_TYPE_TEXT, true).build()
        } else if (id in textGroups.indices) {
            p.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(androidx.media3.common.C.TRACK_TYPE_TEXT, false)
                .setOverrideForType(androidx.media3.common.TrackSelectionOverride(textGroups[id], 0)).build()
        } else return@runOnUiThread
        uiState.selectedSubtitleId = id
    }

    fun setSpeedNative(rate: Float) = activity.runOnUiThread {
        player?.setPlaybackSpeed(rate); uiState.speed = rate
    }

    /** Live-recreate the player with a different decoder preference (ported from HybridPlayerPlugin). */
    fun setDecoderModeNative(mode: Int) = activity.runOnUiThread {
        if (mode == decoderMode || currentUrl == null) return@runOnUiThread
        decoderMode = mode
        uiState.decoderMode = mode
        val pos = player?.currentPosition ?: 0L
        val url = currentUrl!!
        player?.release(); player = null
        doReload(url, pos)
    }
```

- [ ] **Step 2: Support the recreate** — `present()` currently inlines load. Extract the "build player + set surface + set item + prepare + play + arm ticker" into a private `doReload(url: String, startMs: Long)` and have both `present()` and `setDecoderModeNative` call it. Add a `private var currentUrl: String? = null` field set in `doReload`. (Mirror `HybridPlayerPlugin.doLoad`.) Keep the `toneMapApplied = false` reset and the `uiState` wiring inside `doReload`.

- [ ] **Step 3: Build (user)** — `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): audio/subtitle selection + speed + live decoder-mode switch (ported)"
```

---

## Task 3.3: Subtitle rendering

**Files:**
- Modify: `db-front.../player/PlayerSurfaceHost.kt`
- Modify: `db-front.../player/NativePlayerPlugin.kt`

**Interfaces:**
- Produces: `PlayerSurfaceHost.setCues(cues)`; a `SubtitleView` between the video frame and the Compose controls; plugin `onCues` feeds it.

- [ ] **Step 1: Add a SubtitleView layer to the host** (ported from `HybridPlayerPlugin`)

In `PlayerSurfaceHost.kt` add a field `private var subtitles: androidx.media3.ui.SubtitleView? = null`. In `attach()`, after adding the video `frame` (index 0) and BEFORE adding the `ComposeView`, insert:

```kotlin
            subtitles = androidx.media3.ui.SubtitleView(activity).apply {
                setUserDefaultStyle(); setUserDefaultTextSize()
            }
            parent.addView(subtitles, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
```

(So z-order is: frame [0] < subtitles < ComposeView.) Add a setter and update `detach()` to remove it:

```kotlin
    fun setCues(cues: List<androidx.media3.common.text.Cue>) { subtitles?.setCues(cues) }
```

In `detach()`, remove `subtitles` alongside the others and null it.

- [ ] **Step 2: Feed cues from the plugin**

In `NativePlayerPlugin.kt`'s `Player.Listener`, add:

```kotlin
        override fun onCues(cueGroup: androidx.media3.common.text.CueGroup) {
            host?.setCues(cueGroup.cues)
        }
```

- [ ] **Step 3: Build (user)** — `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/PlayerSurfaceHost.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): subtitle rendering via SubtitleView layer + onCues"
```

---

## Task 3.4: TrackMenus Compose sheet + open button

**Files:**
- Create: `db-front.../player/ui/TrackMenus.kt`
- Modify: `db-front.../player/ui/PlayerControls.kt`
- Modify: `db-front.../player/NativePlayerPlugin.kt` (wire callbacks in the mount)

**Interfaces:**
- Consumes: `PlayerUiState`.
- Produces: `@Composable TrackMenus(state, onSelectAudio, onSelectSubtitle, onSetSpeed, onSetDecoder, onDismiss)`; a controls button that opens it.

- [ ] **Step 1: Create `TrackMenus.kt`**

```kotlin
package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)
private val DECODERS = listOf(0 to "Auto", 1 to "Hardware", 2 to "Software")

@Composable
private fun sectionTitle(t: String) =
    Text(t, color = Color(0xFF9AA0A6), fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))

@Composable
private fun row(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(if (selected) "●" else "○", color = if (selected) Color(0xFF14B8A6) else Color(0x88FFFFFF), fontSize = 14.sp)
        Text(label, color = Color.White, fontSize = 15.sp)
    }
}

/** Bottom sheet listing audio, subtitles, speed, and decoder. Tapping the scrim dismisses. */
@Composable
fun TrackMenus(
    state: PlayerUiState,
    onSelectAudio: (Int) -> Unit,
    onSelectSubtitle: (Int) -> Unit,
    onSetSpeed: (Float) -> Unit,
    onSetDecoder: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onDismiss)) {
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                .background(Color(0xF21B1B1F)).padding(horizontal = 20.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            if (state.audioTracks.isNotEmpty()) {
                sectionTitle("Audio")
                state.audioTracks.forEach { t -> row(t.label, t.id == state.selectedAudioId) { onSelectAudio(t.id) } }
            }
            sectionTitle("Subtitles")
            row("Off", state.selectedSubtitleId < 0) { onSelectSubtitle(-1) }
            state.subtitleTracks.forEach { t -> row(t.label, t.id == state.selectedSubtitleId) { onSelectSubtitle(t.id) } }
            sectionTitle("Speed")
            SPEEDS.forEach { s -> row(if (s == 1f) "Normal" else "${s}x", s == state.speed) { onSetSpeed(s) } }
            sectionTitle("Decoder")
            DECODERS.forEach { (m, name) -> row(name, m == state.decoderMode) { onSetDecoder(m) } }
        }
    }
}
```

- [ ] **Step 2: Add a menu button + open state to `PlayerControls`**

In `PlayerControls.kt`: add a `menuOpen` state and a top-right settings icon button; when open, render `TrackMenus`. Change the `PlayerControls` signature to also accept the four selection callbacks. Concretely, add params `onSelectAudio`, `onSelectSubtitle`, `onSetSpeed`, `onSetDecoder`, and inside the root `Box` add:

```kotlin
        var menuOpen by remember { mutableStateOf(false) }
        IconButton(onClick = { menuOpen = true }, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)) {
            Icon(Icons.Filled.Settings, contentDescription = "Tracks & settings", tint = Color.White)
        }
        if (menuOpen) {
            TrackMenus(
                state = state,
                onSelectAudio = { onSelectAudio(it); menuOpen = false },
                onSelectSubtitle = { onSelectSubtitle(it); menuOpen = false },
                onSetSpeed = { onSetSpeed(it); menuOpen = false },
                onSetDecoder = { onSetDecoder(it); menuOpen = false },
                onDismiss = { menuOpen = false },
            )
        }
```

Add the import `androidx.compose.material.icons.filled.Settings`. (The `menuOpen` guard means the auto-hide LaunchedEffect can stay as-is; the menu sits above the controls.)

- [ ] **Step 3: Wire the callbacks in the plugin mount**

In `NativePlayerPlugin.present()`'s `mountCompose { GestureLayer(...) { PlayerControls(...) } }`, extend the `PlayerControls(...)` call with:

```kotlin
                            onSelectAudio = { selectAudio(it) },
                            onSelectSubtitle = { selectSubtitle(it) },
                            onSetSpeed = { setSpeedNative(it) },
                            onSetDecoder = { setDecoderModeNative(it) },
```

- [ ] **Step 4: Build (user)** — `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/TrackMenus.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerControls.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): tracks/speed/decoder selection sheet + open button"
```

---

## Phase 3 on-device verification (user)
With the flag on, play a multi-audio / subtitled title:
- Settings (gear) opens the sheet; **audio** switch changes language; **subtitles** on/off + language render correctly; **speed** changes; **decoder** HW/SW/Auto switches (software forces a reload).
- Labels read correctly (e.g., "Hindi · E-AC3 · 5.1", "English").

## Self-Review (against Phase 3 goal)
- Track model + labels + build → 3.1. ✅
- Selection + speed + decoder switch → 3.2. ✅
- Subtitle rendering → 3.3. ✅
- Menu UI + wiring → 3.4. ✅
