package com.db.dbworld.player

import android.app.PictureInPictureParams
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Rational
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@UnstableApi
@CapacitorPlugin(name = "NativePlayer")
class NativePlayerPlugin : Plugin() {

    private var player: ExoPlayer? = null
    private var host: PlayerSurfaceHost? = null
    private var decoderMode = 0
    private var toneMapApplied = false
    private var currentUrl: String? = null
    private var inPip = false
    private var videoW = 0
    private var videoH = 0
    private var fillMode = true   // true = crop-to-fill (full screen), false = letterbox-fit
    private val uiState = com.db.dbworld.player.ui.PlayerUiState()
    private val ui = Handler(Looper.getMainLooper())
    private val audioGroups = ArrayList<androidx.media3.common.TrackGroup>()
    private val textGroups = ArrayList<androidx.media3.common.TrackGroup>()

    private val ticker = object : Runnable {
        override fun run() {
            val p = player ?: return
            val e = JSObject()
                .put("positionMs", maxOf(0, p.currentPosition))
                .put("durationMs", if (p.duration > 0) p.duration else 0)
                .put("bufferedMs", maxOf(0, p.bufferedPosition))
            notifyListeners("playerTime", e)
            uiState.positionMs = maxOf(0, p.currentPosition)
            uiState.durationMs = if (p.duration > 0) p.duration else 0
            uiState.bufferedMs = maxOf(0, p.bufferedPosition)
            ui.postDelayed(this, 250)
        }
    }

    @PluginMethod
    fun present(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrEmpty()) { call.reject("url required"); return }
        val startMs = call.getDouble("startMs")?.toLong() ?: 0L
        decoderMode = call.getInt("decoderMode", 0)!!
        activity.runOnUiThread {
            try {
                // Open in landscape full-screen (like a video player should).
                activity.requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                // Draw edge-to-edge INTO the display cutout, else the video is pushed off the
                // notch edge leaving a black bar on one side.
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    val lp = activity.window.attributes
                    lp.layoutInDisplayCutoutMode =
                        android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                    activity.window.attributes = lp
                }
                doReload(url, startMs)
                call.resolve()
            } catch (t: Throwable) {
                call.reject("present failed: ${t.message}")
            }
        }
    }

    private fun doReload(url: String, startMs: Long) {
        val h = host ?: PlayerSurfaceHost(activity, bridge.webView).also { host = it }
        val surface = h.attach()
        h.mountCompose {
            com.db.dbworld.player.ui.GestureLayer(
                locked = uiState.locked,
                sheetOpen = uiState.sheetOpen,
                onTapToggle = { uiState.controlsVisible = !uiState.controlsVisible },
                onDoubleSeek = { fwd ->
                    player?.let { it.seekTo((it.currentPosition + if (fwd) 10_000 else -10_000).coerceAtLeast(0)) }
                    uiState.seekForward = fwd; uiState.seekTick = System.currentTimeMillis()
                },
                onBrightnessDelta = { adjustBrightness(it) },
                onVolumeDelta = { adjustVolume(it) },
                onZoom = { fill -> fillMode = fill; applyScaling() },
                onDragEnd = { clearHud() },
            ) {
                Box(Modifier.fillMaxSize()) {
                    com.db.dbworld.player.ui.PlayerControls(
                        state = uiState,
                        onPlayPause = { player?.let { it.playWhenReady = !it.playWhenReady } },
                        onSeek = { ms -> player?.seekTo(ms) },
                        onSeekBy = { d -> player?.let { it.seekTo((it.currentPosition + d).coerceAtLeast(0)) } },
                        onClose = { dismissInternal() },
                        onEnterPip = { enterPip() },
                        onRotate = { rotate() },
                        onToggleLock = { uiState.locked = !uiState.locked },
                        onSelectAudio = { selectAudio(it) },
                        onSelectSubtitle = { selectSubtitle(it) },
                        onSetSpeed = { setSpeedNative(it) },
                        onSetDecoder = { setDecoderModeNative(it) },
                        onSelectEpisode = { requestEpisode(it) },
                        onSelectQuality = { selectQuality(it) },
                    )
                    com.db.dbworld.player.ui.NextEpisodeCard(
                        state = uiState,
                        onPlayNext = { uiState.ended = false; requestEpisode(it) },
                        onDismiss = { uiState.ended = false },
                    )
                    com.db.dbworld.player.ui.ErrorOverlay(
                        state = uiState,
                        onRetry = { retryPlayback() },
                        onClose = { dismissInternal() },
                    )
                    com.db.dbworld.player.ui.HudOverlay(state = uiState)
                    com.db.dbworld.player.ui.SeekFlash(state = uiState)
                    com.db.dbworld.player.ui.BufferingSpinner(state = uiState)
                }
            }
        }
        val p = player ?: ExoPlayerFactory.build(context, decoderMode).also {
            player = it; it.addListener(listener)
        }
        p.setVideoSurfaceView(surface)
        applyScaling()
        toneMapApplied = false
        uiState.ended = false
        uiState.errorMessage = null
        currentUrl = url
        p.setMediaItem(MediaItem.fromUri(url))
        p.prepare()
        if (startMs > 0) p.seekTo(startMs)
        p.playWhenReady = true
        ui.removeCallbacks(ticker); ui.post(ticker)
    }

    @PluginMethod fun play(call: PluginCall) { onPlayer { it.playWhenReady = true }; call.resolve() }
    @PluginMethod fun pause(call: PluginCall) { onPlayer { it.playWhenReady = false }; call.resolve() }
    @PluginMethod fun seekTo(call: PluginCall) {
        val ms = call.getDouble("positionMs")?.toLong() ?: 0L
        onPlayer { it.seekTo(ms) }; notifyListeners("playerSeek", JSObject().put("positionMs", ms)); call.resolve()
    }
    @PluginMethod fun setRate(call: PluginCall) {
        val r = call.getDouble("rate")?.toFloat() ?: 1f; onPlayer { it.setPlaybackSpeed(r) }; call.resolve()
    }

    private fun parseEpisodes(arr: com.getcapacitor.JSArray?): List<PlayerEpisode> {
        val out = ArrayList<PlayerEpisode>()
        if (arr == null) return out
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(PlayerEpisode(
                fileId = o.optString("fileId"),
                label = o.optString("label"),
                name = o.optString("name"),
                overview = o.optString("overview"),
                still = o.optString("still"),
                runtime = o.optString("runtime"),
            ))
        }
        return out
    }

    private fun parseVariants(arr: com.getcapacitor.JSArray?): List<PlayerVariant> {
        val out = ArrayList<PlayerVariant>()
        if (arr == null) return out
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(PlayerVariant(o.optString("url"), o.optString("label")))
        }
        return out
    }

    @PluginMethod
    fun setPlaylist(call: PluginCall) {
        val eps = call.getArray("episodes"); val vars = call.getArray("variants")
        val cur = call.getString("currentFileId") ?: ""
        val playlistTitle = call.getString("title") ?: ""
        activity.runOnUiThread {
            uiState.episodes = parseEpisodes(eps)
            uiState.variants = parseVariants(vars)
            uiState.currentFileId = cur
            uiState.title = playlistTitle
        }
        call.resolve()
    }

    /** Ask JS to switch episode (JS owns resolve + telemetry re-arm). */
    fun requestEpisode(fileId: String) {
        notifyListeners("playerSelectEpisode", JSObject().put("fileId", fileId))
    }

    /** Native quality switch — variants already carry resolved URLs, so just reload at pos. */
    fun selectQuality(url: String) = activity.runOnUiThread {
        val pos = player?.currentPosition ?: 0L
        doReload(url, pos)
    }

    fun selectAudio(id: Int) = activity.runOnUiThread {
        val p = player ?: return@runOnUiThread
        if (id in audioGroups.indices) {
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setOverrideForType(androidx.media3.common.TrackSelectionOverride(audioGroups[id], 0))
                .build()
            uiState.selectedAudioId = id
        }
    }

    fun selectSubtitle(id: Int) = activity.runOnUiThread {
        val p = player ?: return@runOnUiThread
        p.trackSelectionParameters = if (id < 0) {
            p.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(androidx.media3.common.C.TRACK_TYPE_TEXT, true).build()
        } else if (id in textGroups.indices) {
            p.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(androidx.media3.common.C.TRACK_TYPE_TEXT, false)
                .setOverrideForType(androidx.media3.common.TrackSelectionOverride(textGroups[id], 0)).build()
        } else return@runOnUiThread
        uiState.selectedSubtitleId = id
    }

    fun setSpeedNative(rate: Float) = activity.runOnUiThread {
        player?.setPlaybackSpeed(rate); uiState.speed = rate
    }

    /** Live-recreate the player with a different decoder preference (ported from HybridPlayerPlugin). */
    fun setDecoderModeNative(mode: Int) = activity.runOnUiThread {
        if (mode == decoderMode || currentUrl == null) return@runOnUiThread
        decoderMode = mode
        uiState.decoderMode = mode
        val pos = player?.currentPosition ?: 0L
        val url = currentUrl!!
        player?.release(); player = null
        doReload(url, pos)
    }

    fun retryPlayback() = activity.runOnUiThread {
        val url = currentUrl ?: return@runOnUiThread
        val pos = player?.currentPosition ?: 0L
        player?.release(); player = null
        doReload(url, pos)
    }

    @PluginMethod
    fun dismiss(call: PluginCall) {
        activity.runOnUiThread { dismissInternal() }
        call.resolve()
    }

    private fun dismissInternal() {
        ui.removeCallbacks(ticker)
        activity.requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            val lp = activity.window.attributes
            lp.layoutInDisplayCutoutMode =
                android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT
            activity.window.attributes = lp
        }
        val pos = player?.currentPosition ?: 0L
        val dur = player?.duration?.coerceAtLeast(0) ?: 0L
        player?.release(); player = null
        host?.detach()
        notifyListeners("playerClosed", JSObject().put("positionMs", pos).put("durationMs", dur))
    }

    private fun onPlayer(block: (ExoPlayer) -> Unit) =
        activity.runOnUiThread { player?.let(block) }

    /** Enable HDR→SDR tone-map only when content is HDR and the display can't show that HDR type. */
    @Suppress("DEPRECATION")  // defaultDisplay + hdrCapabilities are deprecated but work across minSdk 23..35
    private fun applyHdrBranch(tracks: Tracks) {
        if (toneMapApplied) return
        val display = activity.windowManager.defaultDisplay
        val supported = display.hdrCapabilities?.supportedHdrTypes ?: IntArray(0)
        for (g in tracks.groups) {
            if (g.type != C.TRACK_TYPE_VIDEO) continue
            val ci = g.mediaTrackGroup.getFormat(0).colorInfo ?: continue
            if (HdrSupport.needsToneMap(ci.colorTransfer, supported)) {
                try { player?.setVideoEffects(emptyList()); toneMapApplied = true } catch (_: Throwable) {}
            }
            return
        }
    }

    private fun emitTracks(tracks: androidx.media3.common.Tracks) {
        audioGroups.clear(); textGroups.clear()
        val audio = ArrayList<PlayerTrack>()
        val text = ArrayList<PlayerTrack>()
        var selAudio = -1; var selText = -1
        for (g in tracks.groups) {
            when (g.type) {
                androidx.media3.common.C.TRACK_TYPE_AUDIO -> {
                    val id = audioGroups.size
                    val tg = g.mediaTrackGroup
                    val f = tg.getFormat(0)
                    audio.add(PlayerTrack(id, audioLabel(f.language, codecName(f.sampleMimeType), f.channelCount, f.label)))
                    if (g.isSelected) selAudio = id
                    audioGroups.add(tg)
                }
                androidx.media3.common.C.TRACK_TYPE_TEXT -> {
                    val id = textGroups.size
                    val tg = g.mediaTrackGroup
                    val f = tg.getFormat(0)
                    text.add(PlayerTrack(id, subtitleLabel(f.language, f.label)))
                    if (g.isSelected) selText = id
                    textGroups.add(tg)
                }
            }
        }
        uiState.audioTracks = audio
        uiState.subtitleTracks = text
        uiState.selectedAudioId = selAudio
        uiState.selectedSubtitleId = selText
    }

    private val audioManager by lazy {
        context.getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager
    }

    /** delta in [-1,1] as a fraction of full range; positive = brighter. Updates the HUD. */
    fun adjustBrightness(delta: Float) = activity.runOnUiThread {
        val w = activity.window
        val lp = w.attributes
        val cur = if (lp.screenBrightness in 0f..1f) lp.screenBrightness else 0.5f
        val next = (cur + delta).coerceIn(0.01f, 1f)
        lp.screenBrightness = next
        w.attributes = lp
        uiState.hudKind = "brightness"; uiState.hudValue = next
    }

    /** delta in [-1,1] as a fraction of full range; positive = louder. STREAM_MUSIC + HUD. */
    fun adjustVolume(delta: Float) = activity.runOnUiThread {
        val max = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
        val cur = audioManager.getStreamVolume(android.media.AudioManager.STREAM_MUSIC)
        val next = (cur + Math.round(delta * max)).coerceIn(0, max)
        audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, next, 0)
        uiState.hudKind = "volume"; uiState.hudValue = if (max > 0) next.toFloat() / max else 0f
    }

    /** Hide the brightness/volume HUD (called when a swipe gesture ends). */
    fun clearHud() = activity.runOnUiThread { uiState.hudKind = null }

    /** Apply the current fill/fit choice via ExoPlayer's scaling mode (full-screen SurfaceView). */
    private fun applyScaling() {
        player?.videoScalingMode =
            if (fillMode) C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING
            else C.VIDEO_SCALING_MODE_SCALE_TO_FIT
    }

    /** Toggle between sensor-landscape and sensor-portrait. */
    fun rotate() = activity.runOnUiThread {
        activity.requestedOrientation =
            if (activity.requestedOrientation == android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT)
                android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            else android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
    }

    private fun isDecoderError(e: androidx.media3.common.PlaybackException): Boolean {
        val c = e.errorCode
        return c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
               c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED ||
               c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODING_FAILED ||
               c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED ||
               c == androidx.media3.common.PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES
    }

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            notifyListeners("playerState", JSObject().put("playing", isPlaying))
            uiState.isPlaying = isPlaying
        }
        override fun onPlaybackStateChanged(state: Int) {
            notifyListeners("playerState", JSObject().put("state", state))
            uiState.ended = (state == Player.STATE_ENDED)
            uiState.buffering = (state == Player.STATE_BUFFERING)
            if (state == Player.STATE_ENDED) notifyListeners("playerEnded", JSObject())
        }
        override fun onTracksChanged(tracks: Tracks) {
            applyHdrBranch(tracks)
            emitTracks(tracks)
            // Phase-3 emits full playerTracks; Phase-1 emits a minimal presence signal.
            notifyListeners("playerTracks", JSObject())
        }
        override fun onPlayerError(error: PlaybackException) {
            // A hardware/decoder failure retries once with software decoders (ported from HybridPlayerPlugin).
            if (isDecoderError(error) && decoderMode != 2 && currentUrl != null) {
                val pos = player?.currentPosition ?: 0L
                val url = currentUrl!!
                decoderMode = 2; uiState.decoderMode = 2
                player?.release(); player = null
                doReload(url, pos)
                return
            }
            uiState.errorMessage = error.message ?: "Playback error"
            notifyListeners("playerError", JSObject().put("code", error.errorCode).put("message", error.message))
        }
        override fun onVideoSizeChanged(size: androidx.media3.common.VideoSize) {
            videoW = size.width; videoH = size.height
            uiState.videoWidth = size.width; uiState.videoHeight = size.height
            // Scaling is handled by ExoPlayer's videoScalingMode on a full-screen SurfaceView.
        }
        override fun onCues(cueGroup: androidx.media3.common.text.CueGroup) {
            host?.setCues(cueGroup.cues)
        }
    }

    /** Shrink into a floating PiP window, sized to the real video aspect ratio. */
    fun enterPip() = activity.runOnUiThread {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@runOnUiThread
        uiState.controlsVisible = false
        val w = if (videoW > 0) videoW else 16
        val h = if (videoH > 0) videoH else 9
        // Android rejects extreme ratios (~0.42..2.39) — clamp.
        val ratio = (w.toDouble() / h).coerceIn(0.42, 2.38)
        val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational((ratio * 1000).toInt(), 1000))
            .build()
        try { activity.enterPictureInPictureMode(params) } catch (e: Exception) {}
    }

    /** Called by MainActivity.onPictureInPictureModeChanged. */
    fun handlePipModeChanged(isInPip: Boolean) {
        inPip = isInPip
    }

    override fun handleOnPause() {
        // Don't keep audio playing when the app is backgrounded — unless we're in PiP,
        // where playback should keep going in the floating window.
        if (!inPip) player?.pause()
        super.handleOnPause()
    }

    override fun handleOnDestroy() {
        ui.removeCallbacks(ticker)
        player?.release(); player = null
        super.handleOnDestroy()
    }
}
