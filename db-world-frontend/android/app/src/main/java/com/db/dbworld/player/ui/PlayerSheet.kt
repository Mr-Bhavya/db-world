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
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
                Modifier.fillMaxWidth().heightIn(max = 440.dp)
                    .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                    .background(PlayerTheme.SheetBg)
                    // Swallow taps so tapping inside the card doesn't reach the scrim's dismiss.
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
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
                    IconButton(onClick = onDismiss, modifier = Modifier.size(30.dp)) {
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
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(label, color = if (selected) PlayerTheme.Teal else PlayerTheme.Text, fontSize = 15.sp,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
            if (subtitle != null) Text(subtitle, color = PlayerTheme.TextMuted, fontSize = 12.sp)
        }
        if (selected) Icon(Icons.Filled.Check, contentDescription = null, tint = PlayerTheme.Teal)
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
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                    .background(PlayerTheme.SheetBg)
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
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
                Text("Audio & Subtitles", color = PlayerTheme.Text, fontSize = 16.sp,
                    fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))
                Row(Modifier.fillMaxWidth().heightIn(max = 220.dp)) {
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                        SheetSection("Audio")
                        if (state.audioTracks.isEmpty()) {
                            Text("None", color = PlayerTheme.TextMuted, fontSize = 14.sp, modifier = Modifier.padding(8.dp))
                        }
                        state.audioTracks.forEach { t -> SheetRow(t.label, t.id == state.selectedAudioId) { onSelectAudio(t.id) } }
                    }
                    Box(Modifier.width(1.dp).fillMaxHeight().padding(vertical = 4.dp).background(Color(0x1FFFFFFF)))
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                        SheetSection("Subtitles")
                        SheetRow("Off", state.selectedSubtitleId < 0) { onSelectSubtitle(-1) }
                        state.subtitleTracks.forEach { t -> SheetRow(t.label, t.id == state.selectedSubtitleId) { onSelectSubtitle(t.id) } }
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
        Row(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            speeds.forEach { s ->
                val sel = s == current
                Box(
                    Modifier.weight(1f).clip(RoundedCornerShape(10.dp))
                        .background(if (sel) PlayerTheme.Teal else Color(0x1FFFFFFF))
                        .clickable { onSelect(s) }.padding(vertical = 13.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (s == 1f) "1×" else "${if (s % 1f == 0f) s.toInt().toString() else s.toString()}×",
                        color = if (sel) Color(0xFF06201D) else PlayerTheme.Text,
                        fontSize = 14.sp, fontWeight = if (sel) FontWeight.Bold else FontWeight.Normal,
                    )
                }
            }
        }
        Text("1× is normal speed", color = PlayerTheme.TextMuted, fontSize = 12.sp,
            modifier = Modifier.padding(top = 6.dp, start = 2.dp))
    }
}

/**
 * Read-only media details as TWO columns (like the Audio & Subtitles sheet): Video + Playback on
 * the LEFT, Audio + Subtitles on the RIGHT, split by a vertical divider, with horizontal dividers
 * between sections. Handles multiple audio/subtitle tracks.
 */
@Composable
fun InfoSheet(state: PlayerUiState, onDismiss: () -> Unit) {
    PlayerSheet("Media info", onDismiss) {
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).padding(top = 4.dp)) {
            Column(Modifier.weight(1f)) {
                SheetSection("Video")
                InfoLine("Resolution", if (state.videoWidth > 0) "${state.videoWidth} × ${state.videoHeight}" else "—")
                InfoLine("Codec", state.videoCodec.ifEmpty { "—" })
                InfoLine("Dynamic range", state.dynamicRange.ifEmpty { "—" })
                InfoLine("Frame rate", fpsText(state.frameRate))
                InfoDivider()
                SheetSection("Playback")
                InfoLine("Speed", "${if (state.speed % 1f == 0f) state.speed.toInt().toString() else state.speed.toString()}×")
                InfoLine("Decoder", when (state.decoderMode) { 1 -> "Hardware"; 2 -> "Software (FFmpeg)"; else -> "Auto (HW → SW)" })
            }
            Box(Modifier.width(1.dp).fillMaxHeight().padding(vertical = 6.dp).background(Color(0x1FFFFFFF)))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
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
