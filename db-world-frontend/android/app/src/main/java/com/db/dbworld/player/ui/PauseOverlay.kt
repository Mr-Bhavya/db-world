package com.db.dbworld.player.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
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
    val show = !state.isPlaying && !state.controlsVisible && !state.inPip && !state.seekActive &&
        !state.ended && !state.buffering && state.errorMessage == null
    val ep = state.episodes.firstOrNull { it.fileId == state.currentFileId }
    val epLine = ep?.let { if (it.name.isNotEmpty()) "${it.label} · ${it.name}" else it.label }

    // Drop shadow on every line so the text stays readable even over a bright frame.
    val shadow = TextStyle(shadow = Shadow(Color.Black, Offset(0f, 2f), blurRadius = 12f))

    // Ease in slowly for a calm, gradual reveal (not a snap).
    AnimatedVisibility(visible = show, enter = fadeIn(tween(700)), exit = fadeOut(tween(300))) {
        Box(
            Modifier.fillMaxSize().background(
                // Darker and reaching further right, so the whole text column sits on a dark base.
                Brush.horizontalGradient(
                    0f to Color(0xE6000000), 0.5f to Color(0xA6000000), 0.85f to Color.Transparent,
                ),
            ),
        ) {
            Column(
                Modifier.align(Alignment.CenterStart)
                    .padding(start = 40.dp, end = 24.dp).widthIn(max = 460.dp),
            ) {
                Text("You're watching", color = PlayerTheme.TextDim, fontSize = 13.sp, style = shadow)
                Text(
                    state.title.ifEmpty { "Now playing" },
                    color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold,
                    maxLines = 2, overflow = TextOverflow.Ellipsis, style = shadow,
                    modifier = Modifier.padding(top = 4.dp),
                )
                if (epLine != null) {
                    Text(epLine, color = PlayerTheme.Teal, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, style = shadow,
                        modifier = Modifier.padding(top = 6.dp))
                }
                val synopsis = ep?.overview?.ifEmpty { state.overview } ?: state.overview
                if (synopsis.isNotEmpty()) {
                    Text(synopsis, color = Color(0xFFE8E8E8), fontSize = 14.sp,
                        maxLines = 4, overflow = TextOverflow.Ellipsis, style = shadow,
                        modifier = Modifier.padding(top = 12.dp))
                }
            }
        }
    }
}
