package com.db.dbworld.plugins

import android.content.Intent
import com.db.dbworld.player.VideoPlayerActivity
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor plugin that bridges JS → VideoPlayerActivity.
 *
 * JS usage:
 *   AndroidPlugins.DbWorldPlayer.launch({
 *     url:            "http://...",
 *     title:          "Movie Name",
 *     fileName:       "movie.mkv",
 *     fileId:         "abc123",        // used as resume key
 *     preferredAudio: "Hindi",         // default "Hindi"
 *     preferredSub:   null,            // default null (off)
 *   });
 */
@CapacitorPlugin(name = "DbWorldPlayer")
class MediaPlayerPlugin : Plugin() {

    @PluginMethod
    fun launch(call: PluginCall) {
        val url   = call.getString("url") ?: run { call.reject("url is required"); return }
        val title = call.getString("title") ?: ""
        val fileName = call.getString("fileName") ?: ""
        val fileId = call.getString("fileId") ?: url
        val preferredAudio = call.getString("preferredAudio") ?: "Hindi"
        val preferredSub   = call.getString("preferredSub")

        val intent = Intent(activity, VideoPlayerActivity::class.java).apply {
            putExtra(VideoPlayerActivity.EXTRA_URL,            url)
            putExtra(VideoPlayerActivity.EXTRA_TITLE,          title)
            putExtra(VideoPlayerActivity.EXTRA_FILE_NAME,      fileName)
            putExtra(VideoPlayerActivity.EXTRA_FILE_ID,        fileId)
            putExtra(VideoPlayerActivity.EXTRA_PREFERRED_AUDIO, preferredAudio)
            putExtra(VideoPlayerActivity.EXTRA_PREFERRED_SUB,  preferredSub)
        }
        activity.startActivity(intent)
        call.resolve()
    }
}
