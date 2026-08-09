package com.db.dbworld.player.probe

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.view.SurfaceView
import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer

/**
 * PHASE-0 THROWAWAY. Plays an HDR10 file on a bare full-screen SurfaceView to prove
 * true HDR passthrough on-device. Launch:
 *   adb shell am start -n com.db.dbworld/com.db.dbworld.player.probe.HdrProbeActivity \
 *     -e url "https://<host>/<hdr10-file>"
 */
@OptIn(UnstableApi::class)
class HdrProbeActivity : Activity() {
    private var player: ExoPlayer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val surface = SurfaceView(this)
        setContentView(surface, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        val url = intent.getStringExtra("url") ?: run {
            Log.e("HdrProbe", "no -e url provided"); finish(); return
        }
        val p = ExoPlayer.Builder(this).build().also { player = it }
        p.setVideoSurfaceView(surface)
        p.addListener(object : Player.Listener {
            override fun onTracksChanged(tracks: Tracks) {
                for (g in tracks.groups) {
                    if (g.type != androidx.media3.common.C.TRACK_TYPE_VIDEO) continue
                    val f = g.mediaTrackGroup.getFormat(0)
                    val ci = f.colorInfo
                    Log.i("HdrProbe", "video=${f.sampleMimeType} " +
                        "colorTransfer=${ci?.colorTransfer} colorSpace=${ci?.colorSpace} " +
                        "(ST2084=6, HLG=7)")
                }
            }
        })
        p.setMediaItem(MediaItem.fromUri(url))
        p.prepare()
        p.playWhenReady = true
    }

    override fun onDestroy() {
        player?.release(); player = null
        super.onDestroy()
    }
}
