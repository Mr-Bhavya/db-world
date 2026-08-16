package com.db.dbworld.player.probe

import android.app.Activity
import android.graphics.Color
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer

/**
 * PHASE-0 THROWAWAY. Hides the Capacitor WebView (INVISIBLE, still alive), adds a
 * SurfaceView playing a hardcoded HDR URL into MainActivity's content, and pings JS once
 * a second so we can confirm the bridge still delivers while the WebView is hidden.
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
object WebviewHiddenProbe {
    private var player: ExoPlayer? = null

    fun start(activity: Activity, webView: WebView, url: String, ping: (Long) -> Unit) {
        val parent = webView.parent as ViewGroup
        val surface = SurfaceView(activity)
        parent.addView(surface, 0, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        parent.setBackgroundColor(Color.BLACK)
        webView.visibility = View.INVISIBLE   // alive, not drawn

        val p = ExoPlayer.Builder(activity).build().also { player = it }
        p.setVideoSurfaceView(surface)
        p.setMediaItem(MediaItem.fromUri(url))
        p.prepare(); p.playWhenReady = true

        val h = android.os.Handler(activity.mainLooper)
        var n = 0L
        val tick = object : Runnable { override fun run() { ping(n++); h.postDelayed(this, 1000) } }
        h.post(tick)
    }
}
