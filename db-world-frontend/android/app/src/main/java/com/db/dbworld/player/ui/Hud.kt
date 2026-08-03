package com.db.dbworld.player.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrightnessHigh
import androidx.compose.material.icons.filled.FitScreen
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * Brightness (left) / volume (right) swipe HUD — icon + vertical bar, matching the React
 * player. Rendered only while [PlayerUiState.hudKind] is set (during a vertical drag).
 */
@Composable
fun HudOverlay(state: PlayerUiState) {
    val kind = state.hudKind ?: return
    val onLeft = kind == "brightness"
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.align(if (onLeft) Alignment.CenterStart else Alignment.CenterEnd)
                .padding(horizontal = 24.dp)
                .clip(RoundedCornerShape(22.dp)).background(PlayerTheme.HudBg)
                .padding(horizontal = 12.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(
                if (onLeft) Icons.Filled.BrightnessHigh else Icons.Filled.VolumeUp,
                contentDescription = null, tint = Color.White,
            )
            Box(
                Modifier.padding(top = 12.dp).width(6.dp).height(130.dp)
                    .clip(RoundedCornerShape(3.dp)).background(PlayerTheme.HudTrack),
                contentAlignment = Alignment.BottomCenter,
            ) {
                Box(
                    Modifier.fillMaxWidth().fillMaxHeight(state.hudValue.coerceIn(0f, 1f))
                        .clip(RoundedCornerShape(3.dp)).background(PlayerTheme.Teal),
                )
            }
        }
    }
}

/** Centered buffering spinner (sits where the play button is, which hides while buffering). */
@Composable
fun BufferingSpinner(state: PlayerUiState) {
    if (!state.buffering || state.errorMessage != null) return
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        androidx.compose.material3.CircularProgressIndicator(
            color = PlayerTheme.Teal, strokeWidth = 3.5.dp, modifier = Modifier.size(52.dp),
        )
    }
}

/**
 * Netflix-style double-tap seek ripple: a translucent half-screen overlay on the tapped side,
 * its center-facing edge rounded into a semicircle, with a ±10s icon + label. Quick fade in/out.
 */
@Composable
fun SeekFlash(state: PlayerUiState) {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(state.seekTick) {
        if (state.seekTick == 0L) return@LaunchedEffect
        state.seekActive = true
        shown = true
        delay(800)          // each tap re-arms this, so the badge stays while you keep tapping
        shown = false
        state.seekActive = false
    }
    val forward = state.seekForward
    val shadow = TextStyle(shadow = Shadow(Color.Black, Offset(0f, 2f), blurRadius = 8f))
    Box(Modifier.fillMaxSize()) {
        // Centered in the tapped HALF (≈¼ of the screen) — off-center, clear of the seek buttons.
        Box(
            Modifier.align(if (forward) Alignment.CenterEnd else Alignment.CenterStart)
                .fillMaxWidth(0.5f).fillMaxHeight(),
            contentAlignment = Alignment.Center,
        ) {
            AnimatedVisibility(
                visible = shown,
                enter = fadeIn(tween(100)) + scaleIn(initialScale = 0.7f),
                exit = fadeOut(tween(250)),
            ) {
                // YouTube-style: a soft dark circle (no solid pill) behind chevrons + label.
                Box(contentAlignment = Alignment.Center) {
                    Spacer(Modifier.size(180.dp).clip(CircleShape).background(Color(0x40000000)))
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        val transition = rememberInfiniteTransition(label = "seekArrows")
                        Row {
                            repeat(3) { i ->
                                val phaseIdx = if (forward) i else 2 - i
                                val a by transition.animateFloat(
                                    initialValue = 0.25f, targetValue = 1f,
                                    animationSpec = infiniteRepeatable(
                                        animation = tween(420),
                                        repeatMode = RepeatMode.Reverse,
                                        initialStartOffset = StartOffset(phaseIdx * 130),
                                    ),
                                    label = "arrow$i",
                                )
                                Icon(
                                    Icons.Filled.PlayArrow, contentDescription = null,
                                    tint = Color.White.copy(alpha = a),
                                    modifier = Modifier.size(26.dp)
                                        .then(if (forward) Modifier else Modifier.scale(scaleX = -1f, scaleY = 1f)),
                                )
                            }
                        }
                        Text("${state.seekSeconds} seconds", color = Color.White, fontSize = 14.sp,
                            fontWeight = FontWeight.Medium, style = shadow, modifier = Modifier.padding(top = 6.dp))
                    }
                }
            }
        }
    }
}
