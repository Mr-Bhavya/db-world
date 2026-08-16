package com.db.dbworld.player.ui

import androidx.compose.ui.graphics.Color

/**
 * Palette matched to the React player (DbWorldVideoPlayer.jsx) so the native Compose UI
 * looks like the web one: teal accent, translucent-dark surfaces, white-alpha tracks.
 */
internal object PlayerTheme {
    val Teal = Color(0xFF14B8A6)              // played fill + selected accent (#14b8a6)
    val Track = Color(0x38FFFFFF)             // progress track  rgba(255,255,255,0.22)
    val Buffered = Color(0x80FFFFFF)          // buffered fill   rgba(255,255,255,0.5)
    val SheetBg = Color(0xFA0E0E0E)           // sheet surface   rgba(14,14,14,0.98)
    val SheetBorder = Color(0x1FFFFFFF)       // rgba(255,255,255,0.12)
    val RowActive = Color(0x24FFFFFF)         // pressed row     rgba(255,255,255,0.14)
    val CurrentEp = Color(0x2413A092)         // current episode rgba(13,148,136,0.14)
    val HudBg = Color(0x99000000)             // brightness/volume HUD  rgba(0,0,0,0.6)
    val HudTrack = Color(0x4DFFFFFF)          // HUD bar track   rgba(255,255,255,0.3)
    val Text = Color(0xFFFFFFFF)
    val TextDim = Color(0xFFCCCCCC)
    val TextMuted = Color(0xFFBBBBBB)
}
