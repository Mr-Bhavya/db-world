package com.db.dbworld.player.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.Forward10
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
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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

/** Centered buffering spinner, shown while the player is BUFFERING (and not errored). */
@Composable
fun BufferingSpinner(state: PlayerUiState) {
    if (!state.buffering || state.errorMessage != null) return
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        androidx.compose.material3.CircularProgressIndicator(
            color = PlayerTheme.Teal, strokeWidth = 3.dp,
        )
    }
}

/** Brief "10s" flash with a rewind/forward icon after a double-tap seek. */
@Composable
fun SeekFlash(state: PlayerUiState) {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(state.seekTick) {
        if (state.seekTick == 0L) return@LaunchedEffect
        shown = true
        delay(550)
        shown = false
    }
    Box(Modifier.fillMaxSize()) {
        AnimatedVisibility(
            visible = shown,
            // Just OUTSIDE the center transport cluster (which spans ~±112dp) — near the seek
            // buttons but not overlapping them.
            modifier = Modifier
                .align(Alignment.Center)
                .offset(x = if (state.seekForward) 168.dp else (-168).dp),
            enter = scaleIn(initialScale = 0.6f) + fadeIn(),
            exit = fadeOut(),
        ) {
            Column(
                Modifier.clip(CircleShape).background(Color(0x59000000)).padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(
                    if (state.seekForward) Icons.Filled.Forward10 else Icons.Filled.Replay10,
                    contentDescription = null, tint = Color.White, modifier = Modifier.size(40.dp),
                )
                Text("10s", color = Color.White, fontSize = 13.sp)
            }
        }
    }
}

/** Brief centered "Fit to screen" / "Fill screen" pill shown after a pinch-zoom mode change. */
@Composable
fun ZoomFlash(state: PlayerUiState) {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(state.zoomTick) {
        if (state.zoomTick == 0L) return@LaunchedEffect
        shown = true
        delay(800)
        shown = false
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        AnimatedVisibility(visible = shown, enter = fadeIn(), exit = fadeOut()) {
            Text(
                state.zoomLabel,
                color = Color.White, fontSize = 14.sp,
                modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(Color(0xB3000000))
                    .padding(horizontal = 18.dp, vertical = 10.dp),
            )
        }
    }
}
