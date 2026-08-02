package com.db.dbworld.player

import android.os.Handler
import android.os.Looper
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
                onTapToggle = { uiState.controlsVisible = !uiState.controlsVisible },
                onDoubleSeek = { fwd ->
                    player?.let { it.seekTo((it.currentPosition + if (fwd) 10_000 else -10_000).coerceAtLeast(0)) }
                },
                onBrightnessDelta = { adjustBrightness(it) },
                onVolumeDelta = { adjustVolume(it) },
            ) {
                com.db.dbworld.player.ui.PlayerControls(
                    state = uiState,
                    onPlayPause = { player?.let { it.playWhenReady = !it.playWhenReady } },
                    onSeek = { ms -> player?.seekTo(ms) },
                    onClose = { dismissInternal() },
                )
            }
        }
        val p = player ?: ExoPlayerFactory.build(context, decoderMode).also {
            player = it; it.addListener(listener)
        }
        p.setVideoSurfaceView(surface)
        toneMapApplied = false
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

    @PluginMethod
    fun dismiss(call: PluginCall) {
        activity.runOnUiThread { dismissInternal() }
        call.resolve()
    }

    private fun dismissInternal() {
        ui.removeCallbacks(ticker)
        val pos = player?.currentPosition ?: 0L
        val dur = player?.duration?.coerceAtLeast(0) ?: 0L
        player?.release(); player = null
        host?.detach()
        notifyListeners("playerClosed", JSObject().put("positionMs", pos).put("durationMs", dur))
    }

    private fun onPlayer(block: (ExoPlayer) -> Unit) =
        activity.runOnUiThread { player?.let(block) }

    /** Enable HDR→SDR tone-map only when content is HDR and the display can't show that HDR type. */
    private fun applyHdrBranch(tracks: Tracks) {
        if (toneMapApplied) return
        val display = activity.windowManager.defaultDisplay
        @Suppress("DEPRECATION")
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

    /** delta in [-1,1] as a fraction of full range; positive = brighter. */
    fun adjustBrightness(delta: Float) = activity.runOnUiThread {
        val w = activity.window
        val lp = w.attributes
        val cur = if (lp.screenBrightness in 0f..1f) lp.screenBrightness else 0.5f
        lp.screenBrightness = (cur + delta).coerceIn(0.01f, 1f)
        w.attributes = lp
    }

    /** delta in [-1,1] as a fraction of full range; positive = louder. STREAM_MUSIC (system bar stays in sync). */
    fun adjustVolume(delta: Float) = activity.runOnUiThread {
        val max = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
        val cur = audioManager.getStreamVolume(android.media.AudioManager.STREAM_MUSIC)
        val next = (cur + Math.round(delta * max)).coerceIn(0, max)
        audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, next, 0)
    }

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            notifyListeners("playerState", JSObject().put("playing", isPlaying))
            uiState.isPlaying = isPlaying
        }
        override fun onPlaybackStateChanged(state: Int) {
            notifyListeners("playerState", JSObject().put("state", state))
            if (state == Player.STATE_ENDED) notifyListeners("playerEnded", JSObject())
        }
        override fun onTracksChanged(tracks: Tracks) {
            applyHdrBranch(tracks)
            emitTracks(tracks)
            // Phase-3 emits full playerTracks; Phase-1 emits a minimal presence signal.
            notifyListeners("playerTracks", JSObject())
        }
        override fun onPlayerError(error: PlaybackException) {
            notifyListeners("playerError", JSObject()
                .put("code", error.errorCode).put("message", error.message))
        }
        override fun onVideoSizeChanged(size: androidx.media3.common.VideoSize) {
            val par = if (size.pixelWidthHeightRatio > 0f) size.pixelWidthHeightRatio else 1f
            if (size.height > 0) host?.setAspectRatio(size.width * par / size.height)
        }
    }

    override fun handleOnPause() {
        // Don't keep audio playing when the app is backgrounded. (PiP, added in Phase 5,
        // will guard this.) The resulting state change is reported to JS as usual.
        player?.pause()
        super.handleOnPause()
    }

    override fun handleOnDestroy() {
        ui.removeCallbacks(ticker)
        player?.release(); player = null
        super.handleOnDestroy()
    }
}
