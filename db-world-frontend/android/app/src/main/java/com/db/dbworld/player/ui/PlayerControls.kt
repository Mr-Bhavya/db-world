package com.db.dbworld.player.ui

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Audiotrack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PictureInPictureAlt
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlaylistPlay
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.ScreenRotation
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)
private val DECODERS = listOf(0 to "Auto", 1 to "Hardware", 2 to "Software")

private fun fmt(ms: Long): String {
    val t = (ms / 1000).coerceAtLeast(0)
    val h = t / 3600; val m = (t % 3600) / 60; val s = t % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/** "1", "0.5", "1.25" — drop a trailing .0. */
private fun trimSpeed(s: Float): String = if (s % 1f == 0f) s.toInt().toString() else s.toString()

/**
 * Transport overlay matched to the React player: gradient scrims, a top bar (close + title;
 * pip/rotate/lock), a center Replay10 · Play/Pause · Forward10 cluster, and a bottom bar with
 * a teal progress bar, time, and a labelled control row that opens bottom-sheet modals.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PlayerControls(
    state: PlayerUiState,
    onPlayPause: () -> Unit,
    onSeek: (Long) -> Unit,
    onSeekBy: (Long) -> Unit,
    onClose: () -> Unit,
    onEnterPip: () -> Unit,
    onRotate: () -> Unit,
    onToggleLock: () -> Unit,
    onSelectAudio: (Int) -> Unit,
    onSelectSubtitle: (Int) -> Unit,
    onSetSpeed: (Float) -> Unit,
    onSetDecoder: (Int) -> Unit,
    onSelectEpisode: (String) -> Unit,
    onSelectQuality: (String) -> Unit,
) {
    // Locked: a tap reveals only an unlock button; all other controls stay hidden.
    if (state.locked) {
        if (state.controlsVisible) {
            Box(Modifier.fillMaxSize()) {
                IconButton(onClick = onToggleLock, modifier = Modifier.align(Alignment.TopStart).padding(14.dp)) {
                    Icon(Icons.Filled.Lock, contentDescription = "Unlock", tint = Color.White)
                }
            }
        }
        return
    }
    if (!state.controlsVisible) return

    var sheet by remember { mutableStateOf<String?>(null) }

    // Auto-hide after 3s while playing — paused whenever a sheet is open.
    LaunchedEffect(state.controlsVisible, state.isPlaying, sheet) {
        if (state.controlsVisible && state.isPlaying && sheet == null) {
            delay(3000); state.controlsVisible = false
        }
    }

    val epLabel = state.episodes.firstOrNull { it.fileId == state.currentFileId }?.label

    Box(Modifier.fillMaxSize()) {
        // Gradient scrims — stronger at the bottom for the taller control bar.
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    0f to Color(0x99000000), 0.2f to Color.Transparent,
                    0.58f to Color.Transparent, 1f to Color(0xE0000000),
                ),
            ),
        )

        // Top bar: close + title/episode (left); pip/rotate/lock (right).
        Row(
            Modifier.align(Alignment.TopStart).fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onClose) { Icon(Icons.Filled.Close, "Close", tint = Color.White) }
                Column(Modifier.padding(start = 4.dp)) {
                    if (state.title.isNotEmpty()) {
                        Text(state.title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    if (epLabel != null) {
                        Text(epLabel, color = PlayerTheme.TextMuted, fontSize = 13.sp,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onEnterPip) { Icon(Icons.Filled.PictureInPictureAlt, "Picture in picture", tint = Color.White) }
                IconButton(onClick = onRotate) { Icon(Icons.Filled.ScreenRotation, "Rotate", tint = Color.White) }
                IconButton(onClick = onToggleLock) { Icon(Icons.Filled.LockOpen, "Lock", tint = Color.White) }
            }
        }

        // Center transport cluster.
        Row(
            Modifier.align(Alignment.Center),
            horizontalArrangement = Arrangement.spacedBy(40.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { onSeekBy(-10_000) }) {
                Icon(Icons.Filled.Replay10, "Rewind 10 seconds", tint = Color.White, modifier = Modifier.size(36.dp))
            }
            IconButton(onClick = onPlayPause, modifier = Modifier.size(72.dp)) {
                Crossfade(targetState = state.isPlaying, label = "playpause") { playing ->
                    Icon(
                        if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        if (playing) "Pause" else "Play",
                        tint = Color.White, modifier = Modifier.size(52.dp),
                    )
                }
            }
            IconButton(onClick = { onSeekBy(10_000) }) {
                Icon(Icons.Filled.Forward10, "Forward 10 seconds", tint = Color.White, modifier = Modifier.size(36.dp))
            }
        }

        // Bottom bar: progress → time → labelled control row.
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(start = 24.dp, end = 24.dp, bottom = 10.dp)) {
            Seekbar(state, onSeek)
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(fmt(state.positionMs), color = PlayerTheme.TextDim, fontSize = 12.sp)
                Text(fmt(state.durationMs), color = PlayerTheme.TextDim, fontSize = 12.sp)
            }
            FlowRow(
                Modifier.fillMaxWidth().padding(top = 14.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                CtrlBtn(Icons.Filled.Speed, "${trimSpeed(state.speed)}×", state.speed != 1f) { sheet = "speed" }
                CtrlBtn(Icons.Filled.Audiotrack, "Audio & Subtitles", sheet == "audio") { sheet = "audio" }
                if (state.episodes.size > 1) CtrlBtn(Icons.Filled.PlaylistPlay, "Episodes", sheet == "episodes") { sheet = "episodes" }
                if (state.variants.isNotEmpty()) CtrlBtn(Icons.Filled.HighQuality, "Quality", sheet == "quality") { sheet = "quality" }
            }
        }

        // Bottom-sheet modals.
        when (sheet) {
            "speed" -> PlayerSheet("Playback speed", { sheet = null }) {
                SPEEDS.forEach { s -> SheetRow(if (s == 1f) "Normal" else "${trimSpeed(s)}×", s == state.speed) { onSetSpeed(s); sheet = null } }
            }
            "audio" -> PlayerSheet("Audio & Subtitles", { sheet = null }) {
                if (state.audioTracks.isNotEmpty()) {
                    SheetSection("Audio")
                    state.audioTracks.forEach { t -> SheetRow(t.label, t.id == state.selectedAudioId) { onSelectAudio(t.id); sheet = null } }
                }
                SheetSection("Subtitles")
                SheetRow("Off", state.selectedSubtitleId < 0) { onSelectSubtitle(-1); sheet = null }
                state.subtitleTracks.forEach { t -> SheetRow(t.label, t.id == state.selectedSubtitleId) { onSelectSubtitle(t.id); sheet = null } }
                SheetSection("Decoder")
                DECODERS.forEach { (m, name) -> SheetRow(name, m == state.decoderMode) { onSetDecoder(m); sheet = null } }
            }
            "episodes" -> PlayerSheet("Episodes", { sheet = null }) {
                state.episodes.forEach { ep -> SheetRow(ep.label, ep.fileId == state.currentFileId) { onSelectEpisode(ep.fileId); sheet = null } }
            }
            "quality" -> PlayerSheet("Quality", { sheet = null }) {
                state.variants.forEach { v -> SheetRow(v.label, false) { onSelectQuality(v.url); sheet = null } }
            }
        }
    }
}

/** Teal progress bar: track → buffered → played fill, with a draggable thumb and tap-to-seek. */
@Composable
private fun Seekbar(state: PlayerUiState, onSeek: (Long) -> Unit) {
    val dur = state.durationMs.coerceAtLeast(1)
    var dragFrac by remember { mutableStateOf<Float?>(null) }
    val frac = (dragFrac ?: (state.positionMs.toFloat() / dur)).coerceIn(0f, 1f)
    val bufFrac = (state.bufferedMs.toFloat() / dur).coerceIn(0f, 1f)
    BoxWithConstraints(
        Modifier.fillMaxWidth().height(24.dp)
            .pointerInput(dur) {
                detectHorizontalDragGestures(
                    onDragStart = { off -> dragFrac = (off.x / size.width).coerceIn(0f, 1f) },
                    onHorizontalDrag = { change, _ -> dragFrac = (change.position.x / size.width).coerceIn(0f, 1f) },
                    onDragEnd = { dragFrac?.let { onSeek((it * dur).toLong()) }; dragFrac = null },
                    onDragCancel = { dragFrac = null },
                )
            }
            .pointerInput(dur) {
                detectTapGestures { off -> onSeek(((off.x / size.width).coerceIn(0f, 1f) * dur).toLong()) }
            },
    ) {
        Box(
            Modifier.align(Alignment.CenterStart).fillMaxWidth().height(5.dp)
                .clip(RoundedCornerShape(999.dp)).background(PlayerTheme.Track),
        ) {
            Box(Modifier.fillMaxHeight().fillMaxWidth(bufFrac).background(PlayerTheme.Buffered))
            Box(Modifier.fillMaxHeight().fillMaxWidth(frac).background(PlayerTheme.Teal))
        }
        Box(
            Modifier.align(Alignment.CenterStart).offset(x = maxWidth * frac - 6.dp)
                .size(13.dp).clip(CircleShape).background(PlayerTheme.Teal),
        )
    }
}

/** Icon-over-label control-row button; teal when active. */
@Composable
private fun CtrlBtn(icon: ImageVector, label: String, active: Boolean, onClick: () -> Unit) {
    Column(
        Modifier.clip(RoundedCornerShape(10.dp)).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = label, tint = if (active) PlayerTheme.Teal else Color.White)
        Text(label, color = if (active) PlayerTheme.Teal else PlayerTheme.TextDim, fontSize = 11.sp,
            modifier = Modifier.padding(top = 2.dp))
    }
}
