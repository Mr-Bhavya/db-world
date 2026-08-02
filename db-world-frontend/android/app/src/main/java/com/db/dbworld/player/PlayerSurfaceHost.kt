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
    private val parent: ViewGroup get() = webView.parent as ViewGroup

    fun attach(): SurfaceView {
        if (surface == null) {
            surface = SurfaceView(activity).also {
                parent.addView(it, 0, ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
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

    fun detach() {
        compose?.let { parent.removeView(it) }; compose = null
        surface?.let { parent.removeView(it) }; surface = null
        parent.setBackgroundColor(Color.TRANSPARENT)
        webView.setBackgroundColor(Color.WHITE)
        webView.visibility = View.VISIBLE
    }
}
