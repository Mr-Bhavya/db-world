package com.db.dbworld.player.ui

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
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
 *  - 1-finger vertical drag: LEFT half -> brightness, RIGHT half -> volume; [onDragEnd] hides the HUD
 *  - pinch: out -> fill (crop), in -> fit (letterbox) via [onZoom]
 * When [locked] is true only the single tap works (to reveal the unlock button).
 */
@Composable
fun GestureLayer(
    locked: Boolean,
    onTapToggle: () -> Unit,
    onDoubleSeek: (forward: Boolean) -> Unit,
    onBrightnessDelta: (Float) -> Unit,
    onVolumeDelta: (Float) -> Unit,
    onZoom: (fill: Boolean) -> Unit,
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
            }
            .pointerInput(locked) {
                if (locked) return@pointerInput
                detectTransformGestures(panZoomLock = true) { _, _, zoom, _ ->
                    if (zoom > 1.015f) onZoom(true) else if (zoom < 0.985f) onZoom(false)
                }
            },
    ) { content() }
}
