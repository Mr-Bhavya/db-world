package com.db.dbworld.player

import android.app.Activity
import android.graphics.Color
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.ComposeView

/**
 * Owns the on-screen player layers inside MainActivity: a SurfaceView (video) at the bottom
 * and a ComposeView (controls) on top, with the Capacitor WebView hidden-but-alive between
 * plays. Native-over-SurfaceView compositing is reliable (unlike a WebView over a SurfaceView),
 * which is the whole reason true HDR works here.
 */
class PlayerSurfaceHost(private val activity: Activity, private val webView: WebView) {

    private var surface: SurfaceView? = null
    private var compose: ComposeView? = null
    private var frame: androidx.media3.ui.AspectRatioFrameLayout? = null
    private var subtitles: androidx.media3.ui.SubtitleView? = null
    private val parent: ViewGroup get() = webView.parent as ViewGroup

    fun attach(): SurfaceView {
        if (surface == null) {
            val f = androidx.media3.ui.AspectRatioFrameLayout(activity).apply {
                setResizeMode(androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT)
            }
            val sv = SurfaceView(activity)
            f.addView(sv, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            parent.addView(f, 0, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            surface = sv
            frame = f
            subtitles = androidx.media3.ui.SubtitleView(activity).apply {
                setUserDefaultStyle(); setUserDefaultTextSize()
            }
            parent.addView(subtitles, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            compose = ComposeView(activity).also {
                parent.addView(it, ViewGroup.LayoutParams(   // above the surface
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
            parent.setBackgroundColor(Color.BLACK)   // black letterbox bars
            webView.setBackgroundColor(Color.TRANSPARENT)
            webView.visibility = View.INVISIBLE       // alive, not drawn
        }
        return surface!!
    }

    fun mountCompose(content: @Composable () -> Unit) {
        compose?.setContent(content)
    }

    fun setAspectRatio(ratio: Float) {
        if (ratio > 0f) frame?.setAspectRatio(ratio)
    }

    /** fill=true -> ZOOM (crop to fill the screen); fill=false -> FIT (letterbox). */
    fun setFill(fill: Boolean) {
        frame?.resizeMode =
            if (fill) androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            else androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
    }

    fun setCues(cues: List<androidx.media3.common.text.Cue>) { subtitles?.setCues(cues) }

    fun detach() {
        compose?.let { parent.removeView(it) }; compose = null
        subtitles?.let { parent.removeView(it) }; subtitles = null
        frame?.let { parent.removeView(it) }; frame = null; surface = null
        parent.setBackgroundColor(Color.TRANSPARENT)
        webView.setBackgroundColor(Color.WHITE)
        webView.visibility = View.VISIBLE
    }
}
