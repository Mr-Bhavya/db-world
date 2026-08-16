# True-HDR Native Player — Phase 4 Plan (episodes, next-episode, quality)

> Expansion of the Phase 4 roadmap. **Android can't be built/run in the agent environment** — every `./gradlew`/`adb` step + all behavior checks are the USER's on-device job. Branch `feat/true-hdr-native-player`. Base: `cbea099e`.

**Goal:** Native episode panel + next-episode autoplay + quality switching, wired to the existing JS episode-resolve logic so nothing about resume/telemetry/watched changes.

**Bridge design (safe + additive):** JS keeps owning episode objects and the resolve/select flow. Native only receives a flat `{fileId,label}` list + `{url,label}` variants for display, and — on an episode tap — emits `playerSelectEpisode {fileId}`. The **small** `HybridPlayerPage.jsx` (186 lines, not the 1970-line `DbWorldVideoPlayer`) subscribes to that event and calls its existing `selectEpisode(ep)`, which already resolves the lazy URL → `setCur` → the adapter reloads the native player. Both new JS effects are **flag-guarded** (`isNativePlayerEnabled()`) so the web/existing paths are byte-unaffected. **Quality** switching is fully native (variants already carry resolved URLs → `doReload(url, pos)`), no bridge round-trip.

## Global Constraints (inherited)
- Kotlin 1.9.20 / Compose BOM 2023.10.01 / Java 21.
- JS episode/resolve/telemetry logic stays in JS, unchanged; new JS is additive + flag-guarded; `DbWorldVideoPlayer.jsx` stays UNTOUCHED.
- Commits: stage only files each task names; no `Co-Authored-By: Claude` trailer; don't push; don't commit `.superpowers/*`/`.claude/*`.

## File Structure (Phase 4)
- Modify `.../player/TrackLabels.kt` — `PlayerEpisode`/`PlayerVariant` data classes.
- Modify `.../player/ui/PlayerUiState.kt` — `episodes`/`variants`/`currentFileId`/`ended`.
- Modify `.../player/NativePlayerPlugin.kt` — `setPlaylist`, `requestEpisode`, `selectQuality`, `nextEpisodeFileId`, `ended` handling; restructure the mount into a Box holding controls + next-ep card.
- Create `.../player/ui/EpisodePanel.kt` — episodes + quality sheet.
- Create `.../player/ui/NextEpisodeCard.kt` — end-of-episode autoplay countdown.
- Modify `.../player/ui/PlayerControls.kt` — episodes button + panel.
- Modify `db-world-frontend/src/features/cinema/player/hybrid/HybridPlayerPage.jsx` — guarded `setPlaylist` + `playerSelectEpisode` bridge.

---

## Task 4.1: Playlist state + plugin methods

**Files:** Modify `TrackLabels.kt`, `ui/PlayerUiState.kt`, `NativePlayerPlugin.kt`.

**Interfaces:** `PlayerEpisode(fileId,label)`, `PlayerVariant(url,label)`; `PlayerUiState.episodes/variants/currentFileId/ended`; plugin `@PluginMethod setPlaylist`, `requestEpisode(fileId)`, `selectQuality(url)`, `private fun nextEpisodeFileId()`.

- [ ] **Step 1: Models** — append to `TrackLabels.kt`:

```kotlin
/** A selectable episode for the native panel (JS owns the full object; native shows label). */
data class PlayerEpisode(val fileId: String, val label: String)

/** A quality variant (URL already resolved by JS). */
data class PlayerVariant(val url: String, val label: String)
```

- [ ] **Step 2: State** — add to `PlayerUiState` (import `PlayerEpisode`/`PlayerVariant` fully-qualified):

```kotlin
    var episodes by mutableStateOf<List<com.db.dbworld.player.PlayerEpisode>>(emptyList())
    var variants by mutableStateOf<List<com.db.dbworld.player.PlayerVariant>>(emptyList())
    var currentFileId by mutableStateOf("")
    var ended by mutableStateOf(false)
```

- [ ] **Step 3: Plugin methods + ended handling** — in `NativePlayerPlugin.kt`:

Add the JSON parsers + methods:

```kotlin
    private fun parseEpisodes(arr: com.getcapacitor.JSArray?): List<PlayerEpisode> {
        val out = ArrayList<PlayerEpisode>()
        if (arr == null) return out
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(PlayerEpisode(o.optString("fileId"), o.optString("label")))
        }
        return out
    }

    private fun parseVariants(arr: com.getcapacitor.JSArray?): List<PlayerVariant> {
        val out = ArrayList<PlayerVariant>()
        if (arr == null) return out
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(PlayerVariant(o.optString("url"), o.optString("label")))
        }
        return out
    }

    @PluginMethod
    fun setPlaylist(call: PluginCall) {
        val eps = call.getArray("episodes"); val vars = call.getArray("variants")
        val cur = call.getString("currentFileId") ?: ""
        activity.runOnUiThread {
            uiState.episodes = parseEpisodes(eps)
            uiState.variants = parseVariants(vars)
            uiState.currentFileId = cur
        }
        call.resolve()
    }

    /** Ask JS to switch episode (JS owns resolve + telemetry re-arm). */
    fun requestEpisode(fileId: String) {
        notifyListeners("playerSelectEpisode", JSObject().put("fileId", fileId))
    }

    /** Native quality switch — variants already carry resolved URLs, so just reload at pos. */
    fun selectQuality(url: String) = activity.runOnUiThread {
        val pos = player?.currentPosition ?: 0L
        doReload(url, pos)
    }

    /** fileId of the episode after the current one, or null. */
    private fun nextEpisodeFileId(): String? {
        val eps = uiState.episodes
        val idx = eps.indexOfFirst { it.fileId == uiState.currentFileId }
        return if (idx >= 0 && idx + 1 < eps.size) eps[idx + 1].fileId else null
    }
```

In `doReload`, add `uiState.ended = false` (near the `toneMapApplied = false` line). In the listener's `onPlaybackStateChanged`, set `uiState.ended = (state == Player.STATE_ENDED)` (alongside the existing `if (state == Player.STATE_ENDED) notifyListeners("playerEnded", …)`).

- [ ] **Step 4: Build (user)** — `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/TrackLabels.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerUiState.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): playlist/variant state + setPlaylist/requestEpisode/selectQuality + ended flag"
```

---

## Task 4.2: EpisodePanel + episodes button

**Files:** Create `ui/EpisodePanel.kt`; Modify `ui/PlayerControls.kt`; Modify `NativePlayerPlugin.kt` (mount wiring).

- [ ] **Step 1: `EpisodePanel.kt`**

```kotlin
package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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

/** Right-side drawer: episode list (current highlighted) + quality options. Scrim dismiss. */
@Composable
fun EpisodePanel(
    state: PlayerUiState,
    onSelectEpisode: (String) -> Unit,
    onSelectQuality: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onDismiss)) {
        Column(
            Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(320.dp)
                .background(Color(0xF21B1B1F)).padding(16.dp).verticalScroll(rememberScrollState()),
        ) {
            if (state.episodes.isNotEmpty()) {
                Text("Episodes", color = Color(0xFF9AA0A6), fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 6.dp))
                state.episodes.forEach { ep ->
                    val sel = ep.fileId == state.currentFileId
                    Text(
                        ep.label,
                        color = if (sel) Color(0xFF14B8A6) else Color.White,
                        fontSize = 15.sp,
                        fontWeight = if (sel) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.fillMaxWidth().clickable { onSelectEpisode(ep.fileId) }.padding(vertical = 10.dp),
                    )
                }
            }
            if (state.variants.isNotEmpty()) {
                Text("Quality", color = Color(0xFF9AA0A6), fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
                state.variants.forEach { v ->
                    Text(v.label, color = Color.White, fontSize = 15.sp,
                        modifier = Modifier.fillMaxWidth().clickable { onSelectQuality(v.url) }.padding(vertical = 10.dp))
                }
            }
        }
    }
}
```

- [ ] **Step 2: Episodes button in `PlayerControls`**

Add two params to `PlayerControls`: `onSelectEpisode: (String) -> Unit`, `onSelectQuality: (String) -> Unit`. Inside the root `Box`, after the Settings button, add (only when there is a playlist):

```kotlin
        var episodesOpen by remember { mutableStateOf(false) }
        if (state.episodes.isNotEmpty() || state.variants.isNotEmpty()) {
            IconButton(onClick = { episodesOpen = true },
                modifier = Modifier.align(Alignment.TopEnd).padding(end = 56.dp, top = 8.dp)) {
                Icon(Icons.Filled.List, contentDescription = "Episodes & quality", tint = Color.White)
            }
        }
        if (episodesOpen) {
            EpisodePanel(state,
                onSelectEpisode = { onSelectEpisode(it); episodesOpen = false },
                onSelectQuality = { onSelectQuality(it); episodesOpen = false },
                onDismiss = { episodesOpen = false })
        }
```

Add import `androidx.compose.material.icons.filled.List`.

- [ ] **Step 3: Wire in the mount** — in `NativePlayerPlugin.doReload`'s `PlayerControls(...)` call add:

```kotlin
                            onSelectEpisode = { requestEpisode(it) },
                            onSelectQuality = { selectQuality(it) },
```

- [ ] **Step 4: Build (user)** — `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/EpisodePanel.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/PlayerControls.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): episode + quality panel with open button"
```

---

## Task 4.3: NextEpisodeCard + autoplay

**Files:** Create `ui/NextEpisodeCard.kt`; Modify `NativePlayerPlugin.kt` (restructure mount into a Box).

- [ ] **Step 1: `NextEpisodeCard.kt`**

```kotlin
package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * Shown when playback ends and a next episode exists. 10s countdown → onPlayNext.
 * The next episode is derived from [state.episodes] + [state.currentFileId] here.
 */
@Composable
fun NextEpisodeCard(
    state: PlayerUiState,
    onPlayNext: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (!state.ended) return
    val idx = state.episodes.indexOfFirst { it.fileId == state.currentFileId }
    val next = if (idx >= 0 && idx + 1 < state.episodes.size) state.episodes[idx + 1] else null
    if (next == null) return

    var secs by remember(next.fileId) { mutableIntStateOf(10) }
    LaunchedEffect(next.fileId) {
        secs = 10
        while (secs > 0) { delay(1000); secs -= 1 }
        onPlayNext(next.fileId)
    }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.align(Alignment.BottomEnd).padding(24.dp)
                .clip(RoundedCornerShape(12.dp)).background(Color(0xF21B1B1F)).padding(16.dp),
        ) {
            Text("Up next", color = Color(0xFF9AA0A6), fontSize = 12.sp)
            Text(next.label, color = Color.White, fontSize = 16.sp, modifier = Modifier.padding(vertical = 4.dp))
            Text("Playing in $secs", color = Color(0xFF9AA0A6), fontSize = 13.sp)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss) { Text("Cancel", color = Color.White) }
                Button(onClick = { onPlayNext(next.fileId) }) { Text("Watch now") }
            }
        }
    }
}
```

- [ ] **Step 2: Restructure the mount into a Box.** First add these three imports at the top of `NativePlayerPlugin.kt`:

```kotlin
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
```

Then in `doReload`, change the GestureLayer content (currently just the `PlayerControls(...)` call) into a `Box` holding both the controls and the next-episode card:

```kotlin
                    ) {
                        Box(Modifier.fillMaxSize()) {
                            com.db.dbworld.player.ui.PlayerControls(
                                state = uiState,
                                onPlayPause = { player?.let { it.playWhenReady = !it.playWhenReady } },
                                onSeek = { ms -> player?.seekTo(ms) },
                                onClose = { dismissInternal() },
                                onSelectAudio = { selectAudio(it) },
                                onSelectSubtitle = { selectSubtitle(it) },
                                onSetSpeed = { setSpeedNative(it) },
                                onSetDecoder = { setDecoderModeNative(it) },
                                onSelectEpisode = { requestEpisode(it) },
                                onSelectQuality = { selectQuality(it) },
                            )
                            com.db.dbworld.player.ui.NextEpisodeCard(
                                state = uiState,
                                onPlayNext = { uiState.ended = false; requestEpisode(it) },
                                onDismiss = { uiState.ended = false },
                            )
                        }
                    }
```

(The `onSelectEpisode`/`onSelectQuality` args on `PlayerControls` were already added in Task 4.2 Step 3 — shown here for the full picture.)

- [ ] **Step 3: Build (user)** — `./gradlew :app:assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add db-world-frontend/android/app/src/main/java/com/db/dbworld/player/ui/NextEpisodeCard.kt db-world-frontend/android/app/src/main/java/com/db/dbworld/player/NativePlayerPlugin.kt
git commit -m "feat(android): next-episode autoplay card + mount restructure"
```

---

## Task 4.4: JS episode bridge (HybridPlayerPage — additive + guarded)

**Files:** Modify `db-world-frontend/src/features/cinema/player/hybrid/HybridPlayerPage.jsx`.

- [ ] **Step 1: Add the guarded bridge effects**

At the top of `HybridPlayerPage.jsx`, add imports:

```js
import { registerPlugin } from '@capacitor/core';
import { isNativePlayerEnabled } from './nativePlayerFlag';
const NativePlayer = registerPlugin('NativePlayer');
```

Inside the `HybridPlayerPage` component, AFTER `cur` and `selectEpisode` are defined, add two effects (both no-op unless the native flag is on, so web/existing untouched):

```js
  // Native player: hand it a flat episode + variant list to display, and route its
  // episode-tap events back into the existing selectEpisode() (which resolves + reloads).
  useEffect(() => {
    if (!isNativePlayerEnabled() || !cur) return;
    const eps = (episodes || []).map((e) => ({
      fileId: String(e.fileId),
      label: e.name ? `${e.label} · ${e.name}` : e.label,
    }));
    const variants = (media?.variants || []).map((v) => ({ url: v.url, label: v.label }));
    NativePlayer.setPlaylist({ episodes: eps, variants, currentFileId: String(cur.fileId) }).catch(() => {});
  }, [episodes, cur, media]);

  useEffect(() => {
    if (!isNativePlayerEnabled()) return undefined;
    let handle;
    NativePlayer.addListener('playerSelectEpisode', ({ fileId }) => {
      const ep = (episodes || []).find((e) => String(e.fileId) === String(fileId));
      if (ep) selectEpisode(ep);
    }).then((h) => { handle = h; });
    return () => handle?.remove?.();
  }, [episodes, selectEpisode]);
```

Ensure `useEffect` is imported (it already is). Do NOT change any existing logic/JSX — these are pure additions.

- [ ] **Step 2: Lint (runnable here)** — `cd db-world-frontend && npx eslint src/features/cinema/player/hybrid/HybridPlayerPage.jsx` → no errors.

- [ ] **Step 3: Commit**

```bash
git add db-world-frontend/src/features/cinema/player/hybrid/HybridPlayerPage.jsx
git commit -m "feat(player): guarded native episode bridge (setPlaylist + playerSelectEpisode)"
```

---

## Phase 4 on-device verification (user)
With the flag on, play a **series** title:
- The episodes button (list icon) opens a panel; current episode highlighted; tapping another **switches** to it (resumes its own position); **quality** list switches resolution at the same position.
- On an episode ending, an **"Up next"** card counts down 10s then autoplays the next episode; **Cancel** dismisses, **Watch now** jumps immediately.
- **No regression:** resume, `saveWatchProgress`, `STREAM_*` telemetry, and auto-mark-Watched (last episode) all still fire; the WEB player is unchanged (flag off).

## Self-Review (against Phase 4 goal)
- Playlist state + methods + ended → 4.1. ✅
- Episode + quality panel → 4.2. ✅
- Next-episode autoplay → 4.3. ✅
- Guarded JS bridge (setPlaylist + event→selectEpisode) → 4.4. ✅
