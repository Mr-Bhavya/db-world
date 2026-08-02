package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrightnessHigh
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

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
