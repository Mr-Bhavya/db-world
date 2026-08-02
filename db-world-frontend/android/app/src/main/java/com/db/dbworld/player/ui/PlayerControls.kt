package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/** Formats ms as H:MM:SS or M:SS. */
private fun fmt(ms: Long): String {
    val t = (ms / 1000).coerceAtLeast(0)
    val h = t / 3600; val m = (t % 3600) / 60; val s = t % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/**
 * Transport overlay over the video SurfaceView. Reads live [state]; the parent (gesture layer)
 * toggles [PlayerUiState.controlsVisible]. Auto-hides 3s after the last interaction while playing.
 */
@Composable
fun PlayerControls(
    state: PlayerUiState,
    onPlayPause: () -> Unit,
    onSeek: (Long) -> Unit,
    onClose: () -> Unit,
) {
    if (!state.controlsVisible) return

    // Auto-hide while playing. NOTE: keys are only controlsVisible + isPlaying — do NOT add
    // positionMs, which the ~4Hz ticker mutates and would restart the delay every 250ms so it
    // could never complete (controls would never hide). Toggling controls re-arms the timer.
    LaunchedEffect(state.controlsVisible, state.isPlaying) {
        if (state.controlsVisible && state.isPlaying) {
            delay(3000)
            state.controlsVisible = false
        }
    }

    Box(Modifier.fillMaxSize().background(Color(0x66000000))) {
        // Top bar: back.
        IconButton(onClick = onClose, modifier = Modifier.align(Alignment.TopStart).padding(8.dp)) {
            Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
        }
        // Center play/pause.
        IconButton(onClick = onPlayPause, modifier = Modifier.align(Alignment.Center).size(72.dp)) {
            Icon(
                if (state.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                contentDescription = if (state.isPlaying) "Pause" else "Play",
                tint = Color.White,
                modifier = Modifier.size(56.dp),
            )
        }
        // Bottom scrubber + times.
        Row(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(fmt(state.positionMs), color = Color.White, fontSize = 12.sp)
            var dragging by remember { mutableStateOf(false) }
            var dragValue by remember { mutableStateOf(0f) }
            val dur = state.durationMs.coerceAtLeast(1)
            Slider(
                value = if (dragging) dragValue else state.positionMs.toFloat() / dur,
                onValueChange = { dragging = true; dragValue = it },
                onValueChangeFinished = { dragging = false; onSeek((dragValue * dur).toLong()) },
                modifier = Modifier.weight(1f),
            )
            Text(fmt(state.durationMs), color = Color.White, fontSize = 12.sp)
        }
    }
}
