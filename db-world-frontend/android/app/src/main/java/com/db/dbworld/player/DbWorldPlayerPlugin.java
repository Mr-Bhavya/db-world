package com.db.dbworld.player;

import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DbWorldPlayer")
public class DbWorldPlayerPlugin extends Plugin {

    @PluginMethod
    public void launch(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        String title         = call.getString("title", "");
        String fileName      = call.getString("fileName", "");
        String fileId        = call.getString("fileId", "");
        String preferredAudio = call.getString("preferredAudio", "");
        String preferredSub  = call.getString("preferredSub", "");

        Intent intent = new Intent(getContext(), VideoPlayerActivity.class);
        intent.putExtra(VideoPlayerActivity.EXTRA_URL,            url);
        intent.putExtra(VideoPlayerActivity.EXTRA_TITLE,          title);
        intent.putExtra(VideoPlayerActivity.EXTRA_FILE_NAME,      fileName);
        intent.putExtra(VideoPlayerActivity.EXTRA_FILE_ID,        fileId);
        intent.putExtra(VideoPlayerActivity.EXTRA_PREFERRED_AUDIO, preferredAudio);
        intent.putExtra(VideoPlayerActivity.EXTRA_PREFERRED_SUB,  preferredSub);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        getContext().startActivity(intent);
        call.resolve();
    }
}
