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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
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
                Box(
                    Modifier.padding(bottom = 10.dp).width(36.dp).height(4.dp)
                        .clip(RoundedCornerShape(2.dp)).background(Color(0x40FFFFFF)),
                )
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                    Text(title, color = PlayerTheme.Text, fontSize = 16.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 6.dp))
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

/** Netflix-style Audio & Subtitles panel: two side-by-side columns + a decoder segmented row. */
@Composable
fun AudioSubtitleSheet(
    state: PlayerUiState,
    onSelectAudio: (Int) -> Unit,
    onSelectSubtitle: (Int) -> Unit,
    onSetDecoder: (Int) -> Unit,
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
                    Modifier.padding(bottom = 10.dp).width(36.dp).height(4.dp)
                        .clip(RoundedCornerShape(2.dp)).background(Color(0x40FFFFFF)),
                )
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
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                        SheetSection("Subtitles")
                        SheetRow("Off", state.selectedSubtitleId < 0) { onSelectSubtitle(-1) }
                        state.subtitleTracks.forEach { t -> SheetRow(t.label, t.id == state.selectedSubtitleId) { onSelectSubtitle(t.id) } }
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(0 to "Auto", 1 to "Hardware", 2 to "Software").forEach { (m, name) ->
                        val sel = m == state.decoderMode
                        Box(
                            Modifier.weight(1f).clip(RoundedCornerShape(8.dp))
                                .background(if (sel) PlayerTheme.Teal.copy(alpha = 0.22f) else Color(0x14FFFFFF))
                                .clickable { onSetDecoder(m) }.padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(name, color = if (sel) PlayerTheme.Teal else PlayerTheme.Text, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}

/** Read-only media details. */
@Composable
fun InfoSheet(state: PlayerUiState, onDismiss: () -> Unit) {
    PlayerSheet("Media info", onDismiss) {
        InfoRow("Title", state.title.ifEmpty { "—" })
        if (state.videoWidth > 0) InfoRow("Resolution", "${state.videoWidth} × ${state.videoHeight}")
        InfoRow("Audio", state.audioTracks.firstOrNull { it.id == state.selectedAudioId }?.label ?: "—")
        InfoRow(
            "Subtitles",
            if (state.selectedSubtitleId < 0) "Off"
            else state.subtitleTracks.firstOrNull { it.id == state.selectedSubtitleId }?.label ?: "—",
        )
        InfoRow("Speed", "${if (state.speed % 1f == 0f) state.speed.toInt().toString() else state.speed.toString()}×")
        InfoRow("Decoder", when (state.decoderMode) { 1 -> "Hardware"; 2 -> "Software"; else -> "Auto" })
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = PlayerTheme.TextMuted, fontSize = 14.sp)
        Text(value, color = PlayerTheme.Text, fontSize = 14.sp)
    }
}
