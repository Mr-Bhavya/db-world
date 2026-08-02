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
 * Owns the on-screen player layers inside MainActivity: a full-screen SurfaceView (video) at the
 * bottom, a SubtitleView, and a ComposeView (controls) on top, with the Capacitor WebView
 * hidden-but-alive between plays. The SurfaceView is MATCH_PARENT (full screen) and the video is
 * scaled by ExoPlayer's videoScalingMode (fill vs fit) — no AspectRatioFrameLayout, which was
 * mis-positioning the video off to one side.
 */
class PlayerSurfaceHost(private val activity: Activity, private val webView: WebView) {

    private var surface: SurfaceView? = null
    private var compose: ComposeView? = null
    private var subtitles: androidx.media3.ui.SubtitleView? = null
    private val parent: ViewGroup get() = webView.parent as ViewGroup

    fun attach(): SurfaceView {
        if (surface == null) {
            val sv = SurfaceView(activity)
            parent.addView(sv, 0, ViewGroup.LayoutParams(   // full-screen video, bottom of the stack
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            surface = sv
            subtitles = androidx.media3.ui.SubtitleView(activity).apply {
                setUserDefaultStyle(); setUserDefaultTextSize()
            }
            parent.addView(subtitles, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            compose = ComposeView(activity).also {
                parent.addView(it, ViewGroup.LayoutParams(   // above the surface
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
            parent.setBackgroundColor(Color.BLACK)
            webView.setBackgroundColor(Color.TRANSPARENT)
            webView.visibility = View.INVISIBLE       // alive, not drawn
        }
        return surface!!
    }

    fun mountCompose(content: @Composable () -> Unit) {
        compose?.setContent(content)
    }

    fun setCues(cues: List<androidx.media3.common.text.Cue>) { subtitles?.setCues(cues) }

    fun detach() {
        compose?.let { parent.removeView(it) }; compose = null
        subtitles?.let { parent.removeView(it) }; subtitles = null
        surface?.let { parent.removeView(it) }; surface = null
        parent.setBackgroundColor(Color.TRANSPARENT)
        webView.setBackgroundColor(Color.BLACK)   // black, not white, so closing doesn't flash white
        webView.visibility = View.VISIBLE
    }
}
