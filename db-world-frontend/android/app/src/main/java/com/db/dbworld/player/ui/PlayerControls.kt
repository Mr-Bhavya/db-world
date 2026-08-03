package com.db.dbworld.player.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Audiotrack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PictureInPictureAlt
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlaylistPlay
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.ScreenRotation
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.delay

private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f)   // matches the web player

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

    var sheet by remember { mutableStateOf<String?>(null) }

    // Tell the gesture layer (which sits under the modal) to stand down while a sheet is open,
    // so scrolling a list doesn't leak into brightness/volume swipes.
    LaunchedEffect(sheet) { state.sheetOpen = sheet != null }
    DisposableEffect(Unit) { onDispose { state.sheetOpen = false } }

    // Auto-hide after a few seconds of no interaction — whether playing OR paused (paused just
    // idles a touch longer, then reveals the pause info card). Held open while a sheet is open
    // or after playback ended (the next-episode card owns the screen then).
    LaunchedEffect(state.controlsVisible, state.isPlaying, sheet, state.ended) {
        if (state.controlsVisible && sheet == null && !state.ended) {
            delay(if (state.isPlaying) 3000 else 3600); state.controlsVisible = false
        }
    }

    val curIdx = state.episodes.indexOfFirst { it.fileId == state.currentFileId }
    val epLabel = if (curIdx >= 0) state.episodes[curIdx].label else null
    val nextEp = if (curIdx >= 0 && curIdx + 1 < state.episodes.size) state.episodes[curIdx + 1] else null
    val vis = state.controlsVisible
    val centerAlpha by animateFloatAsState(if (state.scrubbing) 0f else 1f, label = "centerAlpha")

    Box(Modifier.fillMaxSize()) {
        // Gradient scrims — stronger at the bottom for the taller control bar. Fades with controls.
        AnimatedVisibility(vis, modifier = Modifier.fillMaxSize(), enter = fadeIn(), exit = fadeOut()) {
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(
                        0f to Color(0x99000000), 0.2f to Color.Transparent,
                        0.58f to Color.Transparent, 1f to Color(0xE0000000),
                    ),
                ),
            )
        }

        // Top bar: close + title/episode (left); pip/rotate/lock (right). Slides up on hide.
        AnimatedVisibility(
            vis, modifier = Modifier.align(Alignment.TopStart).fillMaxWidth(),
            enter = fadeIn() + slideInVertically { -it }, exit = fadeOut() + slideOutVertically { -it },
        ) {
            Row(
                Modifier.fillMaxWidth().padding(14.dp),
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
        }

        // Center transport cluster — fades with controls, and dims out while scrubbing so the
        // storyboard preview owns the screen.
        AnimatedVisibility(vis, modifier = Modifier.align(Alignment.Center), enter = fadeIn(), exit = fadeOut()) {
            Row(
                Modifier.alpha(centerAlpha),
                horizontalArrangement = Arrangement.spacedBy(40.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { onSeekBy(-10_000) }) {
                    Icon(Icons.Filled.Replay10, "Rewind 10 seconds", tint = Color.White, modifier = Modifier.size(36.dp))
                }
                // While buffering/seeking the play button is hidden — the centered spinner
                // (BufferingSpinner) shows in its place, so you never tap a stale control.
                Box(Modifier.size(72.dp), contentAlignment = Alignment.Center) {
                    AnimatedVisibility(visible = !state.buffering && !state.scrubbing, enter = fadeIn(), exit = fadeOut()) {
                        IconButton(onClick = onPlayPause, modifier = Modifier.size(72.dp)) {
                            Crossfade(targetState = state.isPlaying, label = "playpause") { playing ->
                                Icon(
                                    if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                    if (playing) "Pause" else "Play",
                                    tint = Color.White, modifier = Modifier.size(52.dp),
                                )
                            }
                        }
                    }
                }
                IconButton(onClick = { onSeekBy(10_000) }) {
                    Icon(Icons.Filled.Forward10, "Forward 10 seconds", tint = Color.White, modifier = Modifier.size(36.dp))
                }
            }
        }

        // Bottom bar (modern order): content controls on top, then the scrubber + time as the
        // primary anchor at the very bottom. Slides down on hide.
        AnimatedVisibility(
            vis, modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth(),
            enter = fadeIn() + slideInVertically { it }, exit = fadeOut() + slideOutVertically { it },
        ) {
            Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 12.dp)) {
                FlowRow(
                    Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CtrlBtn(Icons.Filled.Audiotrack, "Audio & Subtitles", sheet == "audio") { sheet = "audio" }
                    if (state.episodes.size > 1) CtrlBtn(Icons.Filled.PlaylistPlay, "Episodes", sheet == "episodes") { sheet = "episodes" }
                    if (nextEp != null) CtrlBtn(Icons.Filled.SkipNext, "Next episode", false) { onSelectEpisode(nextEp.fileId) }
                    CtrlBtn(Icons.Filled.Speed, "${trimSpeed(state.speed)}×", state.speed != 1f) { sheet = "speed" }
                    if (state.variants.isNotEmpty()) CtrlBtn(Icons.Filled.HighQuality, "Quality", sheet == "quality") { sheet = "quality" }
                    CtrlBtn(Icons.Filled.Info, "Info", sheet == "info") { sheet = "info" }
                }
                Seekbar(state, onSeek)
                Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(fmt(state.positionMs), color = PlayerTheme.Text, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    Text(fmt(state.durationMs), color = PlayerTheme.TextDim, fontSize = 12.sp)
                }
            }
        }

        // "Next episode" pill auto-surfaces near the end of a series episode (independent of the
        // control bar's visibility, like Netflix).
        val remainingMs = state.durationMs - state.positionMs
        // Only when the control bar is hidden (its own row already has a Next button).
        val showNextPill = nextEp != null && !vis && state.durationMs > 0 && !state.ended && remainingMs in 1L..40_000L
        AnimatedVisibility(
            visible = showNextPill,
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 20.dp, bottom = 24.dp),
            enter = fadeIn() + slideInHorizontally { it }, exit = fadeOut() + slideOutHorizontally { it },
        ) {
            Row(
                Modifier.clip(RoundedCornerShape(50)).background(Color.White)
                    .clickable { nextEp?.let { onSelectEpisode(it.fileId) } }
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.SkipNext, contentDescription = null, tint = Color(0xFF0B1112), modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Next episode", color = Color(0xFF0B1112), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        // Bottom-sheet modals.
        when (sheet) {
            "speed" -> SpeedSheet(SPEEDS, state.speed, onSelect = { onSetSpeed(it) }, onDismiss = { sheet = null })
            "audio" -> AudioSubtitleSheet(
                state = state,
                onSelectAudio = { onSelectAudio(it) },     // stay open so both can be picked
                onSelectSubtitle = { onSelectSubtitle(it) },
                onDismiss = { sheet = null },
            )
            "episodes" -> EpisodeSheet(
                state = state,
                onSelect = { onSelectEpisode(it); sheet = null },
                onDismiss = { sheet = null },
            )
            "quality" -> PlayerSheet("Quality", { sheet = null }) {
                state.variants.forEach { v -> SheetRow(v.label, false) { onSelectQuality(v.url); sheet = null } }
            }
            "info" -> InfoSheet(state = state, onDismiss = { sheet = null })
        }
    }
}

/** Teal progress bar: track → buffered → played fill, with a draggable thumb and tap-to-seek. */
@Composable
private fun Seekbar(state: PlayerUiState, onSeek: (Long) -> Unit) {
    // Until the real duration is known, show an empty bar — otherwise a resume position over
    // duration 0 reads as 100% for a frame, then snaps back.
    val hasDur = state.durationMs > 0
    val dur = state.durationMs.coerceAtLeast(1)
    var dragFrac by remember { mutableStateOf<Float?>(null) }
    val frac = (dragFrac ?: (if (hasDur) state.positionMs.toFloat() / dur else 0f)).coerceIn(0f, 1f)
    val bufFrac = (if (hasDur) state.bufferedMs.toFloat() / dur else 0f).coerceIn(0f, 1f)
    val dragging = dragFrac != null
    val trackH by animateDpAsState(if (dragging) 6.dp else 4.dp, label = "seekTrackH")
    val thumbSize by animateDpAsState(if (dragging) 18.dp else 12.dp, label = "seekThumb")
    val ringSize by animateDpAsState(if (dragging) 32.dp else 0.dp, label = "seekRing")
    BoxWithConstraints(
        Modifier.fillMaxWidth().height(28.dp)
            .pointerInput(dur) {
                detectHorizontalDragGestures(
                    onDragStart = { off -> state.scrubbing = true; dragFrac = (off.x / size.width).coerceIn(0f, 1f) },
                    onHorizontalDrag = { change, _ -> dragFrac = (change.position.x / size.width).coerceIn(0f, 1f) },
                    onDragEnd = { dragFrac?.let { onSeek((it * dur).toLong()) }; dragFrac = null; state.scrubbing = false },
                    onDragCancel = { dragFrac = null; state.scrubbing = false },
                )
            }
            .pointerInput(dur) {
                detectTapGestures { off -> onSeek(((off.x / size.width).coerceIn(0f, 1f) * dur).toLong()) }
            },
    ) {
        val sb = state.storyboard
        // Scrub preview: storyboard thumbnail (if any) + time, above the thumb while dragging.
        if (dragFrac != null && hasDur) {
            val previewMs = (frac * dur).toLong()
            val thumbW = if (sb != null) 148.dp else 66.dp
            val bubbleX = (maxWidth * frac - thumbW / 2).coerceIn(0.dp, (maxWidth - thumbW).coerceAtLeast(0.dp))
            val bubbleUp = if (sb != null) 120.dp else 34.dp
            Column(
                Modifier.align(Alignment.TopStart).offset(x = bubbleX, y = -bubbleUp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (sb != null && sb.tileW > 0 && sb.tileH > 0) {
                    StoryboardThumb(
                        sb, previewMs,
                        Modifier.width(thumbW).aspectRatio(sb.tileW.toFloat() / sb.tileH)
                            .clip(RoundedCornerShape(8.dp)).background(Color.Black),
                    )
                }
                Text(
                    fmt(previewMs), color = Color.White, fontSize = 12.sp,
                    modifier = Modifier.padding(top = 4.dp).clip(RoundedCornerShape(6.dp))
                        .background(Color(0xCC000000)).padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
        }
        Box(
            Modifier.align(Alignment.CenterStart).fillMaxWidth().height(trackH)
                .clip(RoundedCornerShape(999.dp)).background(PlayerTheme.Track),
        ) {
            Box(Modifier.fillMaxHeight().fillMaxWidth(bufFrac).clip(RoundedCornerShape(999.dp)).background(PlayerTheme.Buffered))
            Box(
                Modifier.fillMaxHeight().fillMaxWidth(frac).clip(RoundedCornerShape(999.dp))
                    .background(Brush.horizontalGradient(listOf(PlayerTheme.Teal, Color(0xFF34E0C8)))),
            )
        }
        // Soft glow ring blooms under the thumb while scrubbing.
        if (ringSize > 0.dp) {
            Box(
                Modifier.align(Alignment.CenterStart).offset(x = maxWidth * frac - ringSize / 2)
                    .size(ringSize).clip(CircleShape).background(PlayerTheme.Teal.copy(alpha = 0.22f)),
            )
        }
        Box(
            Modifier.align(Alignment.CenterStart).offset(x = maxWidth * frac - thumbSize / 2)
                .size(thumbSize).clip(CircleShape).background(PlayerTheme.Teal),
        )
    }
}

/** Draws one storyboard tile (cropped from the sprite sheet) for the position being scrubbed to. */
@Composable
private fun StoryboardThumb(sb: com.db.dbworld.player.PlayerStoryboard, posMs: Long, modifier: Modifier) {
    val context = LocalContext.current
    var image by remember(sb.url) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(sb.url) {
        try {
            val req = ImageRequest.Builder(context).data(sb.url).allowHardware(false).build()
            val res = context.imageLoader.execute(req)
            (res as? SuccessResult)?.drawable
                ?.let { it as? android.graphics.drawable.BitmapDrawable }?.bitmap
                ?.let { image = it.asImageBitmap() }
        } catch (_: Throwable) { /* time-only preview if the sprite can't load */ }
    }
    val img = image
    val cols = sb.cols.coerceAtLeast(1)
    val idx = if (sb.intervalMs > 0) (posMs / sb.intervalMs).toInt().coerceIn(0, (sb.count - 1).coerceAtLeast(0)) else 0
    val col = idx % cols
    val row = idx / cols
    Canvas(modifier) {
        if (img != null) {
            drawImage(
                image = img,
                srcOffset = IntOffset(col * sb.tileW, row * sb.tileH),
                srcSize = IntSize(sb.tileW, sb.tileH),
                dstSize = IntSize(size.width.toInt(), size.height.toInt()),
                filterQuality = FilterQuality.Low,
            )
        }
    }
}

/** Pill control-row button: icon then label on a subtle chip; teal when active. */
@Composable
private fun CtrlBtn(icon: ImageVector, label: String, active: Boolean, onClick: () -> Unit) {
    val tint = if (active) PlayerTheme.Teal else Color.White
    Row(
        Modifier.clip(RoundedCornerShape(20.dp))
            .background(if (active) PlayerTheme.Teal.copy(alpha = 0.16f) else Color(0x1FFFFFFF))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(7.dp))
        Text(label, color = tint, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}
