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
