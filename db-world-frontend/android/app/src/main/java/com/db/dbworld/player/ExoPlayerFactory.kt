package com.db.dbworld.player

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.LoadControl
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import androidx.media3.exoplayer.upstream.DefaultAllocator
import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.NextRenderersFactory

@UnstableApi
object ExoPlayerFactory {

    /** decoderMode: 0 auto · 1 hardware-first · 2 software-first. Mirrors HybridPlayerPlugin. */
    fun build(context: Context, decoderMode: Int): ExoPlayer {
        val rf = NextRenderersFactory(context)
            .setEnableDecoderFallback(true)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
        when (decoderMode) {
            1 -> rf.setMediaCodecSelector(preferSelector(true))
            2 -> rf.setMediaCodecSelector(preferSelector(false))
        }
        val player = ExoPlayer.Builder(context, rf)
            .setLoadControl(buildLoadControl(context))
            .build()
        player.trackSelectionParameters = player.trackSelectionParameters.buildUpon()
            .setPreferredAudioLanguage("hin")
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            .build()
        // Auto-pause on transient focus loss (calls, other media) and duck appropriately;
        // pause when headphones are unplugged.
        player.setAudioAttributes(androidx.media3.common.AudioAttributes.DEFAULT, /* handleAudioFocus= */ true)
        player.setHandleAudioBecomingNoisy(true)
        return player
    }

    private fun buildLoadControl(context: Context): LoadControl {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val lowRam = am.isLowRamDevice
        // Phase-5 tightens this via BufferTier; Phase-1 keeps parity with the current values,
        // only shrinking the byte ceiling on low-RAM devices to avoid OOM.
        val targetBytes = if (lowRam) 32 * 1024 * 1024 else 96 * 1024 * 1024
        return DefaultLoadControl.Builder()
            .setAllocator(DefaultAllocator(true, 64 * 1024))
            .setBufferDurationsMs(30_000, 120_000, 2_500, 7_000)
            .setTargetBufferBytes(targetBytes)
            .setPrioritizeTimeOverSizeThresholds(false)
            .setBackBuffer(30_000, true)
            .build()
    }

    private fun preferSelector(preferHardware: Boolean) = MediaCodecSelector { mime, secure, tunneling ->
        val infos = ArrayList(MediaCodecUtil.getDecoderInfos(mime, secure, tunneling))
        infos.sortWith(Comparator { a, b ->
            val aw = if (a.softwareOnly) 1 else 0
            val bw = if (b.softwareOnly) 1 else 0
            if (preferHardware) aw.compareTo(bw) else bw.compareTo(aw)
        })
        infos
    }
}
