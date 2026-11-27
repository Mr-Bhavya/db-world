package com.db.dbworld.player.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Bottom-sheet modal matching the React player's Sheet: dim scrim + a rounded dark card that
 * slides up, with a drag handle and title.
 */
@Composable
fun PlayerSheet(title: String, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    // Card slides up on open.
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onDismiss)) {
        AnimatedVisibility(
            visibleState = visible,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
        ) {
            Column(
                Modifier.fillMaxWidth(0.62f).widthIn(max = 720.dp).heightIn(max = 400.dp)
                    .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                    .background(PlayerTheme.SheetBg)
                    // Swallow taps so tapping inside the card doesn't reach the scrim's dismiss.
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Tappable grab handle — a tap on it dismisses, like a real bottom sheet.
                Box(
                    Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onDismiss)
                        .padding(horizontal = 22.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(Modifier.width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x59FFFFFF)))
                }
                Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(title, color = PlayerTheme.Text, fontSize = 16.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismiss, modifier = Modifier.size(44.dp)) {
                        Icon(Icons.Filled.Close, contentDescription = "Close", tint = PlayerTheme.TextDim,
                            modifier = Modifier.size(20.dp))
                    }
                }
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                    content()
                }
            }
        }
    }
}

/** A small muted section header inside a sheet. */
@Composable
fun SheetSection(label: String) {
    Text(label, color = PlayerTheme.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 12.dp, bottom = 2.dp))
}

/** A selectable sheet row: label (+ optional subtitle) left, teal check when selected. */
@Composable
fun SheetRow(label: String, selected: Boolean, subtitle: String? = null, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp).clip(RoundedCornerShape(12.dp))
            .background(if (selected) Color(0x0D14B8A6) else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.width(3.dp).height(30.dp).clip(RoundedCornerShape(2.dp))
                .background(if (selected) PlayerTheme.Teal else Color.Transparent),
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = if (selected) PlayerTheme.Teal else PlayerTheme.Text, fontSize = 15.sp,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
            if (subtitle != null) Text(
                subtitle, color = PlayerTheme.TextMuted, fontSize = 11.5.sp,
                overflow = TextOverflow.Clip,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        if (selected) Icon(Icons.Filled.Check, contentDescription = "Selected", tint = PlayerTheme.Teal,
            modifier = Modifier.size(18.dp))
    }
}

/** Netflix-style Audio & Subtitles panel: two side-by-side columns. */
@Composable
fun AudioSubtitleSheet(
    state: PlayerUiState,
    onSelectAudio: (Int) -> Unit,
    onSelectSubtitle: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onDismiss)) {
        AnimatedVisibility(
            visibleState = visible,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
        ) {
            Column(
                Modifier.fillMaxWidth(0.64f).widthIn(max = 760.dp)
                    .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                    .background(PlayerTheme.SheetBg)
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onDismiss)
                        .padding(horizontal = 22.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(Modifier.width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x59FFFFFF)))
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Audio & Subtitles", color = PlayerTheme.Text, fontSize = 17.sp,
                        fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismiss, modifier = Modifier.size(44.dp)) {
                        Icon(Icons.Filled.Close, contentDescription = "Close", tint = PlayerTheme.TextDim)
                    }
                }
                Text(
                    if (state.subtitleTracks.isEmpty()) "No embedded subtitles detected"
                    else "${state.subtitleTracks.size} selectable caption track${if (state.subtitleTracks.size == 1) "" else "s"}",
                    color = PlayerTheme.TextMuted, fontSize = 12.sp,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
                Row(Modifier.fillMaxWidth().heightIn(max = 190.dp)) {
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                        SheetSection("Audio")
                        if (state.audioTracks.isEmpty()) {
                            Text("None", color = PlayerTheme.TextMuted, fontSize = 14.sp, modifier = Modifier.padding(8.dp))
                        }
                        state.audioTracks.forEach { t -> SheetRow(t.label, t.id == state.selectedAudioId, t.detail.ifEmpty { null }) { onSelectAudio(t.id) } }
                    }
                    Box(Modifier.width(1.dp).fillMaxHeight().padding(vertical = 4.dp).background(Color(0x1FFFFFFF)))
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                        SheetSection("Subtitles")
                        SheetRow("Off", state.selectedSubtitleId < 0) { onSelectSubtitle(-1) }
                        state.subtitleTracks.forEach { t -> SheetRow(t.label, t.id == state.selectedSubtitleId, t.detail.ifEmpty { null }) { onSelectSubtitle(t.id) } }
                    }
                }
            }
        }
    }
}

/** Playback-speed picker: a horizontal segmented control (web-player style), 1× highlighted. */
@Composable
fun SpeedSheet(speeds: List<Float>, current: Float, onSelect: (Float) -> Unit, onDismiss: () -> Unit) {
    PlayerSheet("Playback speed", onDismiss) {
        Row(
            Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 6.dp)
                .clip(RoundedCornerShape(14.dp)).background(Color(0x0FFFFFFF)).padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            speeds.forEach { s ->
                val sel = s == current
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(11.dp))
                        .background(if (sel) Color(0x2414B8A6) else Color.Transparent)
                        .clickable { onSelect(s) }.padding(vertical = 10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        if (s == 1f) "1×" else "${if (s % 1f == 0f) s.toInt().toString() else s.toString()}×",
                        color = if (sel) PlayerTheme.Teal else PlayerTheme.TextDim,
                        fontSize = 15.sp, fontWeight = if (sel) FontWeight.Bold else FontWeight.Medium,
                    )
                    Box(
                        Modifier.padding(top = 5.dp).width(18.dp).height(2.dp)
                            .clip(RoundedCornerShape(1.dp))
                            .background(if (sel) PlayerTheme.Teal else Color.Transparent),
                    )
                }
            }
        }
        Text("1× is normal speed", color = PlayerTheme.TextMuted, fontSize = 12.sp,
            modifier = Modifier.padding(top = 6.dp, start = 2.dp))
    }
}

/** Rows the sheet already prints live from ExoPlayer — the decoder is the authority on these. */
private val LIVE_VIDEO_ROWS = setOf("Resolution", "Codec", "Frame rate")

/**
 * Read-only media details as TWO independently-scrolling columns (like the Audio & Subtitles
 * sheet): Video and File on the LEFT; Audio, Subtitles, and Playback on the RIGHT, split by a
 * vertical divider. Multiple audio/subtitle tracks each render name + detail; empty subtitles
 * show "None". The rows ExoPlayer can't report are pushed from JS as videoSpecs/fileSpecs.
 */
@Composable
fun InfoSheet(state: PlayerUiState, onDismiss: () -> Unit) {
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onDismiss)) {
        AnimatedVisibility(
            visibleState = visible,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
        ) {
            Column(
                Modifier.fillMaxWidth(0.66f).widthIn(max = 820.dp)
                    .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                    .background(PlayerTheme.SheetBg)
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onDismiss)
                        .padding(horizontal = 22.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(Modifier.width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x59FFFFFF)))
                }
                Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Media info", color = PlayerTheme.Text, fontSize = 16.sp,
                        fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismiss, modifier = Modifier.size(44.dp)) {
                        Icon(Icons.Filled.Close, contentDescription = "Close", tint = PlayerTheme.TextDim,
                            modifier = Modifier.size(20.dp))
                    }
                }
                Row(Modifier.fillMaxWidth().heightIn(max = 260.dp)) {
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                        SheetSection("Video")
                        InfoLine("Resolution", if (state.videoWidth > 0) "${state.videoWidth} × ${state.videoHeight}" else "—")
                        InfoLine("Codec", state.videoCodec.ifEmpty { "—" })
                        InfoLine("Dynamic range", state.dynamicRange.ifEmpty { "—" })
                        InfoLine("Frame rate", fpsText(state.frameRate))
                        // Everything the decoder can't tell us — profile, bit depth, colour,
                        // bitrate, HDR format — comes pre-formatted from the API MediaInfo.
                        state.videoSpecs
                            .filter { it.name !in LIVE_VIDEO_ROWS }
                            .forEach { InfoLine(it.name, it.detail) }
                        if (state.fileSpecs.isNotEmpty()) {
                            InfoDivider()
                            SheetSection("File")
                            state.fileSpecs.forEach { InfoLine(it.name, it.detail) }
                        }
                        InfoDivider()
                        SheetSection("Playback")
                        InfoLine("Speed", "${if (state.speed % 1f == 0f) state.speed.toInt().toString() else state.speed.toString()}×")
                        InfoLine("Decoder", when (state.decoderMode) { 1 -> "Hardware"; 2 -> "Software (FFmpeg)"; else -> "Auto (HW → SW)" })
                    }
                    Box(Modifier.width(1.dp).fillMaxHeight().padding(vertical = 4.dp).background(Color(0x1FFFFFFF)))
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                        SheetSection("Audio")
                        when {
                            state.audioInfo.isNotEmpty() -> state.audioInfo.forEach { a -> InfoTrack(a.name, a.detail) }
                            state.audioTracks.isNotEmpty() -> state.audioTracks.forEach { t -> InfoTrack(t.label, "") }
                            else -> InfoTrack("None", "")
                        }
                        InfoDivider()
                        SheetSection("Subtitles")
                        if (state.subtitleTracks.isEmpty()) InfoTrack("None", "")
                        else state.subtitleTracks.forEach { t -> InfoTrack(t.label, "") }
                    }
                }
            }
        }
    }
}

private fun fpsText(fps: Float): String = when {
    fps <= 0f -> "—"
    fps % 1f == 0f -> "${fps.toInt()} fps"
    else -> "%.3f".format(fps).trimEnd('0').trimEnd('.') + " fps"
}

/** KV detail row: label left, value right (muted). */
@Composable
private fun InfoLine(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = PlayerTheme.TextMuted, fontSize = 13.sp, modifier = Modifier.weight(1f))
        if (value.isNotEmpty()) {
            Text(value, color = PlayerTheme.Text, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                textAlign = TextAlign.End, modifier = Modifier.padding(start = 8.dp))
        }
    }
}

/** A track row (name over its detail) for the multi-track Audio / Subtitles columns. */
@Composable
private fun InfoTrack(name: String, detail: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 7.dp)) {
        Text(name, color = PlayerTheme.Text, fontSize = 14.sp, fontWeight = FontWeight.Medium,
            maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (detail.isNotEmpty()) {
            Text(detail, color = PlayerTheme.TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

/** Horizontal hairline between sections within a column. */
@Composable
private fun InfoDivider() {
    Box(Modifier.fillMaxWidth().padding(vertical = 6.dp).height(0.5.dp).background(Color(0x1FFFFFFF)))
}
