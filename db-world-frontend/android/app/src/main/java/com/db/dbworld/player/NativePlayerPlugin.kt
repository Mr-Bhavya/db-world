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
    private val ui = Handler(Looper.getMainLooper())

    private val ticker = object : Runnable {
        override fun run() {
            val p = player ?: return
            val e = JSObject()
                .put("positionMs", maxOf(0, p.currentPosition))
                .put("durationMs", if (p.duration > 0) p.duration else 0)
                .put("bufferedMs", maxOf(0, p.bufferedPosition))
            notifyListeners("playerTime", e)
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
                val h = host ?: PlayerSurfaceHost(activity, bridge.webView).also { host = it }
                val surface = h.attach()
                h.mountCompose { /* Phase 2+ controls mount here */ }
                val p = player ?: ExoPlayerFactory.build(context, decoderMode).also {
                    player = it; it.addListener(listener)
                }
                p.setVideoSurfaceView(surface)
                toneMapApplied = false
                p.setMediaItem(MediaItem.fromUri(url))
                p.prepare()
                if (startMs > 0) p.seekTo(startMs)
                p.playWhenReady = true
                ui.removeCallbacks(ticker); ui.post(ticker)
                call.resolve()
            } catch (t: Throwable) {
                call.reject("present failed: ${t.message}")
            }
        }
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

    @PluginMethod
    fun dismiss(call: PluginCall) {
        activity.runOnUiThread {
            ui.removeCallbacks(ticker)
            val pos = player?.currentPosition ?: 0L
            val dur = player?.duration?.coerceAtLeast(0) ?: 0L
            player?.release(); player = null
            host?.detach()
            notifyListeners("playerClosed", JSObject().put("positionMs", pos).put("durationMs", dur))
            call.resolve()
        }
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

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            notifyListeners("playerState", JSObject().put("playing", isPlaying))
        }
        override fun onPlaybackStateChanged(state: Int) {
            notifyListeners("playerState", JSObject().put("state", state))
            if (state == Player.STATE_ENDED) notifyListeners("playerEnded", JSObject())
        }
        override fun onTracksChanged(tracks: Tracks) {
            applyHdrBranch(tracks)
            // Phase-3 emits full playerTracks; Phase-1 emits a minimal presence signal.
            notifyListeners("playerTracks", JSObject())
        }
        override fun onPlayerError(error: PlaybackException) {
            notifyListeners("playerError", JSObject()
                .put("code", error.errorCode).put("message", error.message))
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
