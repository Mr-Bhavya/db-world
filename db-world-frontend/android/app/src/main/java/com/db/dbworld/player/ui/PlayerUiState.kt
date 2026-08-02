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
    var episodes by mutableStateOf<List<com.db.dbworld.player.PlayerEpisode>>(emptyList())
    var variants by mutableStateOf<List<com.db.dbworld.player.PlayerVariant>>(emptyList())
    var currentFileId by mutableStateOf("")
    var ended by mutableStateOf(false)
    var buffering by mutableStateOf(false)        // player is BUFFERING (show a spinner)
    var errorMessage by mutableStateOf<String?>(null)
    var title by mutableStateOf("")               // show/movie title for the top bar
    var locked by mutableStateOf(false)           // controls locked (tap does nothing but unlock)
    // Brightness/volume swipe HUD: kind = "brightness" | "volume" | null (hidden); value 0..1.
    var hudKind by mutableStateOf<String?>(null)
    var hudValue by mutableFloatStateOf(0f)
    // Double-tap seek flash: seekTick is bumped (to now-ms) on each ±10s seek to trigger the overlay.
    var seekTick by mutableLongStateOf(0L)
    var seekForward by mutableStateOf(false)
}
