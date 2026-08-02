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
            Text(
                if (next.name.isNotEmpty()) "${next.label} · ${next.name}" else next.label,
                color = Color.White, fontSize = 16.sp, modifier = Modifier.padding(vertical = 4.dp),
            )
            Text("Playing in $secs", color = Color(0xFF9AA0A6), fontSize = 13.sp)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss) { Text("Cancel", color = Color.White) }
                Button(onClick = { onPlayNext(next.fileId) }) { Text("Watch now") }
            }
        }
    }
}
