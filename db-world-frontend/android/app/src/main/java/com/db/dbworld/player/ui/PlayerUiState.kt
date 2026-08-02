package com.db.dbworld.player.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Observable snapshot of playback that the Compose control layer renders from.
 * All fields are written on the main (UI) thread by NativePlayerPlugin, so Compose
 * recomposes safely without extra synchronization.
 */
class PlayerUiState {
    var positionMs by mutableLongStateOf(0L)
    var durationMs by mutableLongStateOf(0L)
    var bufferedMs by mutableLongStateOf(0L)
    var isPlaying by mutableStateOf(false)
    var controlsVisible by mutableStateOf(true)
}
