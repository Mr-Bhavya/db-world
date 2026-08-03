package com.db.dbworld.player.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Netflix-style pause card: once the controls idle-hide while paused, reveal the show/episode
 * title + synopsis over a soft left-side scrim for a clean screen. Any tap re-shows the controls
 * (which hides this). Never shown while playing / buffering / ended / errored.
 */
@Composable
fun PauseOverlay(state: PlayerUiState) {
    val show = !state.isPlaying && !state.controlsVisible && !state.inPip &&
        !state.ended && !state.buffering && state.errorMessage == null
    val ep = state.episodes.firstOrNull { it.fileId == state.currentFileId }
    val epLine = ep?.let { if (it.name.isNotEmpty()) "${it.label} · ${it.name}" else it.label }

    AnimatedVisibility(visible = show, enter = fadeIn(), exit = fadeOut()) {
        Box(
            Modifier.fillMaxSize().background(
                Brush.horizontalGradient(0f to Color(0xC0000000), 0.55f to Color.Transparent),
            ),
        ) {
            Column(
                Modifier.align(Alignment.CenterStart)
                    .padding(start = 40.dp, end = 24.dp).widthIn(max = 560.dp),
            ) {
                Text("You're watching", color = PlayerTheme.TextMuted, fontSize = 13.sp)
                Text(
                    state.title.ifEmpty { "Now playing" },
                    color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold,
                    maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
                if (epLine != null) {
                    Text(epLine, color = PlayerTheme.Teal, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                }
                val synopsis = ep?.overview?.ifEmpty { state.overview } ?: state.overview
                if (synopsis.isNotEmpty()) {
                    Text(synopsis, color = PlayerTheme.TextDim, fontSize = 14.sp,
                        maxLines = 4, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 12.dp))
                }
            }
        }
    }
}
