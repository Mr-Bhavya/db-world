package com.db.dbworld.player

import android.app.Activity
import android.graphics.Color
import android.view.Gravity
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.ComposeView

/**
 * Owns the on-screen player layers inside MainActivity: an aspect-correct video surface at the
 * bottom, a SubtitleView, and a ComposeView (controls) on top, with the Capacitor WebView
 * hidden-but-alive between plays.
 *
 * The video sits in a media3 [AspectRatioFrameLayout] (which shrinks itself to the video's aspect
 * ratio), centered inside a full-screen black container via Gravity.CENTER — so a 16:9 (or 2.4:1,
 * etc.) video is letterboxed SYMMETRICALLY, never stretched and never shoved to one side. FIT =
 * letterbox (whole frame), ZOOM = crop-to-fill.
 */
class PlayerSurfaceHost(private val activity: Activity, private val webView: WebView) {

    private var container: FrameLayout? = null
    private var frame: androidx.media3.ui.AspectRatioFrameLayout? = null
    private var surface: SurfaceView? = null
    private var subtitles: androidx.media3.ui.SubtitleView? = null
    private var compose: ComposeView? = null
    private val parent: ViewGroup get() = webView.parent as ViewGroup

    fun attach(): SurfaceView {
        if (surface == null) {
            val c = FrameLayout(activity).apply { setBackgroundColor(Color.BLACK) }
            val f = androidx.media3.ui.AspectRatioFrameLayout(activity).apply {
                setResizeMode(androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT)
            }
            val sv = SurfaceView(activity)
            f.addView(sv, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            // MATCH_PARENT + CENTER: the frame shrinks itself to the video aspect in onMeasure,
            // and the container then centers that shrunk frame.
            c.addView(f, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER))
            parent.addView(c, 0, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            surface = sv; frame = f; container = c

            subtitles = androidx.media3.ui.SubtitleView(activity).apply {
                setUserDefaultStyle(); setUserDefaultTextSize()
            }
            parent.addView(subtitles, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            compose = ComposeView(activity).also {
                parent.addView(it, ViewGroup.LayoutParams(   // above the surface
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
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

    /** fill=true -> ZOOM (crop to fill the screen); fill=false -> FIT (letterbox, whole frame). */
    fun setFill(fill: Boolean) {
        frame?.resizeMode =
            if (fill) androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            else androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT
    }

    fun setCues(cues: List<androidx.media3.common.text.Cue>) { subtitles?.setCues(cues) }

    fun detach() {
        compose?.let { parent.removeView(it) }; compose = null
        subtitles?.let { parent.removeView(it) }; subtitles = null
        container?.let { parent.removeView(it) }; container = null; frame = null; surface = null
        webView.setBackgroundColor(Color.BLACK)   // black, not white, so closing doesn't flash white
        webView.visibility = View.VISIBLE
    }
}
