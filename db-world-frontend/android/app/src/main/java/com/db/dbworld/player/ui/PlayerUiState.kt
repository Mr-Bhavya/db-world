package com.db.dbworld.player.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
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
    var audioTracks by mutableStateOf<List<com.db.dbworld.player.PlayerTrack>>(emptyList())
    var subtitleTracks by mutableStateOf<List<com.db.dbworld.player.PlayerTrack>>(emptyList())
    var selectedAudioId by mutableIntStateOf(-1)
    var selectedSubtitleId by mutableIntStateOf(-1)
    var speed by mutableFloatStateOf(1f)
    var decoderMode by mutableIntStateOf(0)   // 0 auto · 1 hardware · 2 software
}
