package com.db.dbworld.player.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Two icons that are NOT in androidx.compose.material:material-icons-core (Pause and
 * PictureInPictureAlt live only in the huge -extended artifact). Drawn inline as 24dp
 * vectors so we don't pull -extended (which, with minify off, would bloat the APK).
 * These are rendered through Icon(), which tints them, so the fill colour here is
 * irrelevant — only the shape matters.
 */

/** Two vertical bars — the standard "pause" glyph. */
val PauseIcon: ImageVector = ImageVector.Builder(
    name = "Pause", defaultWidth = 24.dp, defaultHeight = 24.dp,
    viewportWidth = 24f, viewportHeight = 24f,
).apply {
    path(fill = SolidColor(Color.White)) {
        moveTo(6f, 5f); lineTo(10f, 5f); lineTo(10f, 19f); lineTo(6f, 19f); close()
        moveTo(14f, 5f); lineTo(18f, 5f); lineTo(18f, 19f); lineTo(14f, 19f); close()
    }
}.build()

/** An outlined frame with a small solid inset — the "picture-in-picture" glyph. */
val PipIcon: ImageVector = ImageVector.Builder(
    name = "Pip", defaultWidth = 24.dp, defaultHeight = 24.dp,
    viewportWidth = 24f, viewportHeight = 24f,
).apply {
    // Outer frame drawn as (big rect − inner rect) via even-odd, leaving a ~2px border.
    path(fill = SolidColor(Color.White), pathFillType = PathFillType.EvenOdd) {
        moveTo(2f, 4f); lineTo(22f, 4f); lineTo(22f, 20f); lineTo(2f, 20f); close()
        moveTo(4f, 6f); lineTo(20f, 6f); lineTo(20f, 18f); lineTo(4f, 18f); close()
    }
    // Small inset "picture" in the lower-right.
    path(fill = SolidColor(Color.White)) {
        moveTo(12f, 11f); lineTo(19f, 11f); lineTo(19f, 17f); lineTo(12f, 17f); close()
    }
}.build()
