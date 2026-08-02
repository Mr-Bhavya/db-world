package com.db.dbworld.player.ui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import kotlin.math.abs

/**
 * Full-screen gesture surface UNDER the controls. One custom detector cleanly separates a
 * 1-finger vertical drag (LEFT half = brightness, RIGHT half = volume; [onDragEnd] hides the HUD)
 * from a 2-finger pinch (out = fill, in = fit via [onZoom]); a second detector handles tap
 * (toggle controls) and double-tap (±10s seek). When [locked] only the tap works.
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
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val onRight = down.position.x > size.width / 2f
                    var lastY = down.position.y
                    var prevDist = -1f
                    var mode = 0 // 0 undecided · 1 vertical drag · 2 pinch
                    while (true) {
                        val ev = awaitPointerEvent()
                        val pressed = ev.changes.filter { it.pressed }
                        if (pressed.isEmpty()) break
                        if (pressed.size >= 2) {
                            mode = 2
                            val d = (pressed[0].position - pressed[1].position).getDistance()
                            if (prevDist > 0f) {
                                if (d > prevDist * 1.04f) { onZoom(true); prevDist = d }
                                else if (d < prevDist * 0.96f) { onZoom(false); prevDist = d }
                            } else prevDist = d
                            pressed.forEach { it.consume() }
                        } else if (mode != 2) {
                            val c = pressed[0]
                            if (mode == 1 || abs(c.position.y - down.position.y) > 14f) {
                                mode = 1
                                val frac = (c.position.y - lastY) / size.height
                                if (onRight) onVolumeDelta(-frac) else onBrightnessDelta(-frac)
                                c.consume()
                            }
                            lastY = c.position.y
                        }
                    }
                    if (mode != 0) onDragEnd()
                }
            },
    ) { content() }
}
