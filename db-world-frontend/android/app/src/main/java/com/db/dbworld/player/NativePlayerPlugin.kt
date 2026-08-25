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
    private var fillMode = false  // false = letterbox-fit (default; whole frame, no distortion), true = crop-to-fill
    private var volFrac = -1f     // continuous volume accumulator for smooth swipe (seeded per gesture)
    private var seekAccum = 0     // accumulated seek seconds for rapid consecutive double-taps
    private var lastSeekAt = 0L
    private var lastSeekFwd = true
    private var pipReceiver: android.content.BroadcastReceiver? = null
    private val PIP_ACTION = "com.db.dbworld.player.NATIVE_PIP_CONTROL"
    private val prefs by lazy {
        context.getSharedPreferences("dbworld_native_player", android.content.Context.MODE_PRIVATE)
    }

    /** A short haptic tick for discrete actions (seek, lock, fit/fill). */
    private fun haptic() {
        try {
            activity.window.decorView.performHapticFeedback(
                android.view.HapticFeedbackConstants.CLOCK_TICK,
                android.view.HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING,
            )
        } catch (_: Throwable) {}
    }
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
                // Stand down while a sheet is open OR the progress bar is being dragged, so a
                // diagonal scrub can't leak into brightness/volume.
                sheetOpen = uiState.sheetOpen || uiState.scrubbing,
                onTapToggle = { uiState.controlsVisible = !uiState.controlsVisible },
                onDoubleSeek = { fwd ->
                    val now = System.currentTimeMillis()
                    // Rapid taps in the same direction accumulate (10s → 20s → 30s), like YouTube.
                    seekAccum = if (fwd == lastSeekFwd && now - lastSeekAt < 1200) seekAccum + 10 else 10
                    lastSeekFwd = fwd; lastSeekAt = now
                    player?.let { it.seekTo((it.currentPosition + if (fwd) 10_000 else -10_000).coerceAtLeast(0)) }
                    uiState.seekForward = fwd; uiState.seekSeconds = seekAccum; uiState.seekTick = now
                    haptic()
                },
                onBrightnessDelta = { adjustBrightness(it) },
                onVolumeDelta = { adjustVolume(it) },
                onZoom = { fill ->
                    if (fill != fillMode) {
                        fillMode = fill; host?.setFill(fill)
                        host?.pulseZoom(fill)   // animate the video itself (Prime-style), no label pill
                        prefs.edit().putBoolean("fill", fill).apply()
                        haptic()
                    }
                },
                onDragEnd = { clearHud() },
            ) {
                Box(Modifier.fillMaxSize()) {
                    com.db.dbworld.player.ui.PauseOverlay(state = uiState)
                    com.db.dbworld.player.ui.PlayerControls(
                        state = uiState,
                        onPlayPause = { player?.let { it.playWhenReady = !it.playWhenReady } },
                        onSeek = { ms -> player?.seekTo(ms) },
                        onSeekBy = { d -> player?.let { it.seekTo((it.currentPosition + d).coerceAtLeast(0)) }; haptic() },
                        onClose = { dismissInternal() },
                        onEnterPip = { enterPip() },
                        onRotate = { rotate() },
                        onToggleLock = { uiState.locked = !uiState.locked; haptic() },
                        onSelectAudio = { selectAudio(it) },
                        onSelectSubtitle = { selectSubtitle(it) },
                        onSetSpeed = { setSpeedNative(it) },
                        onSelectEpisode = { requestEpisode(it) },
                        onSelectQuality = { v -> selectQuality(v) },
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
        // Always build a FRESH player for each load. Reusing one across a URL swap (episode /
        // quality switch) left a blank surface; a new instance is cheap and reliable. The host
        // stays attached, so there's no teardown flicker.
        player?.release()
        val p = ExoPlayerFactory.build(context, decoderMode).also {
            player = it; it.addListener(listener)
        }
        p.setVideoSurfaceView(surface)
        // Restore remembered fit/fill + playback speed (per device).
        fillMode = prefs.getBoolean("fill", false)
        host?.setFill(fillMode)
        val savedSpeed = prefs.getFloat("speed", 1f)
        p.setPlaybackSpeed(savedSpeed)
        uiState.speed = savedSpeed
        toneMapApplied = false
        uiState.ended = false
        uiState.errorMessage = null
        currentUrl = url
        p.setMediaItem(MediaItem.fromUri(url))
        p.prepare()
        if (startMs > 0) p.seekTo(startMs)
        p.playWhenReady = true
        activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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
                progress = o.optDouble("progress", 0.0).toFloat(),
            ))
        }
        return out
    }

    private fun parseVariants(arr: com.getcapacitor.JSArray?): List<PlayerVariant> {
        val out = ArrayList<PlayerVariant>()
        if (arr == null) return out
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(PlayerVariant(o.optString("url"), o.optString("label"), o.optString("mediaFileId")))
        }
        return out
    }

    @PluginMethod
    fun setPlaylist(call: PluginCall) {
        val eps = call.getArray("episodes"); val vars = call.getArray("variants")
        val cur = call.getString("currentFileId") ?: ""
        val curVariant = call.getString("currentVariantId") ?: ""
        val playlistTitle = call.getString("title") ?: ""
        val playlistOverview = call.getString("overview") ?: ""
        val sb = call.getObject("storyboard")
        val audioInfoArr = call.getArray("audioInfo")
        val videoSpecsArr = call.getArray("videoSpecs")
        val fileSpecsArr = call.getArray("fileSpecs")
        val badgesArr = call.getArray("badges")
        activity.runOnUiThread {
            uiState.episodes = parseEpisodes(eps)
            uiState.variants = parseVariants(vars)
            uiState.currentFileId = cur
            uiState.currentVariantId = curVariant
            uiState.title = playlistTitle
            uiState.overview = playlistOverview
            uiState.storyboard = parseStoryboard(sb)
            uiState.audioInfo = parseSpecs(audioInfoArr)
            uiState.videoSpecs = parseSpecs(videoSpecsArr)
            uiState.fileSpecs = parseSpecs(fileSpecsArr)
            uiState.badges = parseBadges(badgesArr)
        }
        call.resolve()
    }

    private fun parseSpecs(arr: com.getcapacitor.JSArray?): List<PlayerSpec> {
        val out = ArrayList<PlayerSpec>()
        if (arr == null) return out
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(PlayerSpec(o.optString("name"), o.optString("detail")))
        }
        return out
    }

    private fun parseBadges(arr: com.getcapacitor.JSArray?): List<PlayerBadge> {
        val out = ArrayList<PlayerBadge>()
        if (arr == null) return out
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(PlayerBadge(o.optString("label"), o.optString("color"), o.optBoolean("filled")))
        }
        return out
    }

    private fun parseStoryboard(o: JSObject?): PlayerStoryboard? {
        if (o == null) return null
        val url = o.optString("url"); val count = o.optInt("count")
        if (url.isEmpty() || count <= 0) return null
        return PlayerStoryboard(
            url = url,
            intervalMs = o.optLong("intervalMs", 0L),
            cols = o.optInt("cols"),
            rows = o.optInt("rows"),
            tileW = o.optInt("tileW"),
            tileH = o.optInt("tileH"),
            count = count,
        )
    }

    /** Ask JS to switch episode (JS owns resolve + telemetry re-arm). */
    fun requestEpisode(fileId: String) {
        notifyListeners("playerSelectEpisode", JSObject().put("fileId", fileId))
    }

    /** Native quality switch — variants already carry resolved URLs, so just reload at pos. */
    fun selectQuality(v: PlayerVariant) = activity.runOnUiThread {
        val pos = player?.currentPosition ?: 0L
        uiState.currentVariantId = v.mediaFileId
        doReload(v.url, pos)
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
        prefs.edit().putFloat("speed", rate).apply()
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
        // JS-initiated teardown (unmount / src-change) — NOT a user close, so don't emit
        // playerClosed (which would navigate the route away mid-episode-switch).
        activity.runOnUiThread { dismissInternal(userInitiated = false) }
        call.resolve()
    }

    private fun dismissInternal(userInitiated: Boolean = true) {
        ui.removeCallbacks(ticker)
        unregisterPipReceiver()
        activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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
        // Only a genuine user close (native X / error dialog) navigates the route back.
        if (userInitiated) notifyListeners("playerClosed", JSObject().put("positionMs", pos).put("durationMs", dur))
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
                androidx.media3.common.C.TRACK_TYPE_VIDEO -> {
                    // Capture the active video format's tech details for the Info sheet.
                    if (g.isSelected || uiState.videoCodec.isEmpty()) {
                        val f = g.mediaTrackGroup.getFormat(0)
                        uiState.videoCodec = videoCodecName(f.sampleMimeType)
                        uiState.dynamicRange = dynamicRangeName(f.colorInfo?.colorTransfer)
                        uiState.frameRate = if (f.frameRate > 0f) f.frameRate else 0f
                    }
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

    /**
     * delta in [-1,1] as a fraction of full range; positive = louder. Accumulates into a
     * CONTINUOUS fraction and only then quantizes to a stream step — otherwise the tiny
     * per-frame delta rounds to 0 and the volume barely moves (the "swipe many times" bug).
     */
    fun adjustVolume(delta: Float) = activity.runOnUiThread {
        val max = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
        // Seed from the real volume at the start of a volume gesture.
        if (uiState.hudKind != "volume" || volFrac < 0f) {
            volFrac = if (max > 0) audioManager.getStreamVolume(android.media.AudioManager.STREAM_MUSIC).toFloat() / max else 0f
        }
        volFrac = (volFrac + delta).coerceIn(0f, 1f)
        audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, Math.round(volFrac * max), 0)
        uiState.hudKind = "volume"; uiState.hudValue = volFrac
    }

    /** Hide the brightness/volume HUD (called when a swipe gesture ends). */
    fun clearHud() = activity.runOnUiThread { uiState.hudKind = null; volFrac = -1f }

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
            // Don't let the screen time out mid-movie; allow it again when paused.
            if (isPlaying) activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            updatePipActions()   // keep the PiP play/pause icon in sync
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
            // Size the video frame to the real aspect ratio → symmetric letterbox, no stretch.
            val par = if (size.pixelWidthHeightRatio > 0f) size.pixelWidthHeightRatio else 1f
            if (size.height > 0) host?.setAspectRatio(size.width * par / size.height)
        }
        override fun onCues(cueGroup: androidx.media3.common.text.CueGroup) {
            host?.setCues(cueGroup.cues)
        }
    }

    /** Shrink into a floating PiP window, sized to the real video aspect ratio, with a play/pause action. */
    fun enterPip() = activity.runOnUiThread {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@runOnUiThread
        uiState.controlsVisible = false
        registerPipReceiver()
        try { activity.enterPictureInPictureMode(buildPipParams()) } catch (e: Exception) {}
    }

    private fun buildPipParams(): PictureInPictureParams {
        val w = if (videoW > 0) videoW else 16
        val h = if (videoH > 0) videoH else 9
        // Android rejects extreme ratios (~0.42..2.39) — clamp.
        val ratio = (w.toDouble() / h).coerceIn(0.42, 2.38)
        return PictureInPictureParams.Builder()
            .setAspectRatio(Rational((ratio * 1000).toInt(), 1000))
            .setActions(listOf(playPauseAction()))
            .build()
    }

    /** The single PiP-window action, its icon reflecting the current play/pause state. */
    private fun playPauseAction(): android.app.RemoteAction {
        val playing = player?.playWhenReady == true
        val iconRes = if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val title = if (playing) "Pause" else "Play"
        val intent = android.content.Intent(PIP_ACTION).setPackage(context.packageName)
        val flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) android.app.PendingIntent.FLAG_IMMUTABLE else 0)
        val pi = android.app.PendingIntent.getBroadcast(context, 1, intent, flags)
        return android.app.RemoteAction(
            android.graphics.drawable.Icon.createWithResource(context, iconRes), title, title, pi)
    }

    private fun registerPipReceiver() {
        if (pipReceiver != null) return
        pipReceiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: android.content.Context?, intent: android.content.Intent?) {
                val p = player ?: return
                p.playWhenReady = !p.playWhenReady
                updatePipActions()
            }
        }
        val filter = android.content.IntentFilter(PIP_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(pipReceiver, filter, android.content.Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(pipReceiver, filter)
        }
    }

    private fun unregisterPipReceiver() {
        pipReceiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
        pipReceiver = null
    }

    /** Refresh the PiP action so its icon tracks play↔pause while in PiP. */
    private fun updatePipActions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && inPip) {
            try { activity.setPictureInPictureParams(buildPipParams()) } catch (_: Exception) {}
        }
    }

    /** Called by MainActivity.onPictureInPictureModeChanged. */
    fun handlePipModeChanged(isInPip: Boolean) {
        inPip = isInPip
        uiState.inPip = isInPip
        if (!isInPip) unregisterPipReceiver()
    }

    override fun handleOnPause() {
        // Don't keep audio playing when the app is backgrounded — unless we're in PiP,
        // where playback should keep going in the floating window.
        if (!inPip) player?.pause()
        super.handleOnPause()
    }

    override fun handleOnDestroy() {
        ui.removeCallbacks(ticker)
        unregisterPipReceiver()
        player?.release(); player = null
        super.handleOnDestroy()
    }
}
