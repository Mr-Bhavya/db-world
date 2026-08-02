package com.db.dbworld.player.ui

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput

/**
 * Full-screen gesture surface UNDER the controls:
 *  - single tap  -> toggle controls
 *  - double tap  -> seek -10s (left half) / +10s (right half)
 *  - vertical drag on the LEFT half -> brightness, RIGHT half -> volume (delta = fraction of
 *    screen height, negative = up = increase); [onDragEnd] fires when the drag ends so the HUD
 *    can hide.
 * When [locked] is true only the single tap works (to reveal the unlock button).
 */
@Composable
fun GestureLayer(
    locked: Boolean,
    onTapToggle: () -> Unit,
    onDoubleSeek: (forward: Boolean) -> Unit,
    onBrightnessDelta: (Float) -> Unit,
    onVolumeDelta: (Float) -> Unit,
    onDragEnd: () -> Unit,
    content: @Composable () -> Unit,
) {
    Box(
        Modifier
            .fillMaxSize()
            .pointerInput(locked) {
                detectTapGestures(
                    onTap = { onTapToggle() },
                    onDoubleTap = { pos -> if (!locked) onDoubleSeek(pos.x > size.width / 2f) },
                )
            }
            .pointerInput(locked) {
                if (locked) return@pointerInput
                var onRight = false
                detectVerticalDragGestures(
                    onDragStart = { pos -> onRight = pos.x > size.width / 2f },
                    onVerticalDrag = { change, dragAmount ->
                        change.consume()
                        val frac = dragAmount / size.height        // down = +, up = -
                        if (onRight) onVolumeDelta(-frac) else onBrightnessDelta(-frac)
                    },
                    onDragEnd = { onDragEnd() },
                    onDragCancel = { onDragEnd() },
                )
            },
    ) { content() }
}
