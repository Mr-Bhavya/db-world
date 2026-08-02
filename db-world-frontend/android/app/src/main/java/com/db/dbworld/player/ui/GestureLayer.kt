package com.db.dbworld.player.ui

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput

/**
 * Full-screen gesture surface UNDER the controls:
 *  - single tap  -> toggle controls
 *  - double tap  -> seek -10s (left half) / +10s (right half)
 *  - vertical drag on the RIGHT half -> volume; on the LEFT half -> brightness
 *    (delta is a fraction of the screen height, negative = up = increase)
 */
@Composable
fun GestureLayer(
    onTapToggle: () -> Unit,
    onDoubleSeek: (forward: Boolean) -> Unit,
    onBrightnessDelta: (Float) -> Unit,
    onVolumeDelta: (Float) -> Unit,
    content: @Composable () -> Unit,
) {
    // `size` (IntSize) comes from the PointerInputScope receiver — left/right half split.
    Box(
        Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTapToggle() },
                    onDoubleTap = { pos: Offset -> onDoubleSeek(pos.x > size.width / 2f) },
                )
            }
            .pointerInput(Unit) {
                var onRight = false
                detectVerticalDragGestures(
                    onDragStart = { pos -> onRight = pos.x > size.width / 2f },
                    onVerticalDrag = { change, dragAmount ->
                        change.consume()
                        val frac = dragAmount / size.height        // down = +, up = -
                        if (onRight) onVolumeDelta(-frac) else onBrightnessDelta(-frac)
                    },
                )
            }
    ) { content() }
}
