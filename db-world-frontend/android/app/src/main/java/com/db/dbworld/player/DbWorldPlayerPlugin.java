package com.db.dbworld.player;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DbWorldPlayer")
public class DbWorldPlayerPlugin extends Plugin {

    /** Accessible from VideoPlayerActivity to fire events back to JS. */
    public static volatile DbWorldPlayerPlugin INSTANCE;

    @Override
    public void load() {
        super.load();
        INSTANCE = this;
        android.util.Log.d("DbWorldPlayer", "Plugin loaded");
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (INSTANCE == this) INSTANCE = null;
    }

    @PluginMethod
    public void launch(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        String title          = call.getString("title", "");
        String fileName       = call.getString("fileName", "");
        String fileId         = call.getString("fileId", "");
        String preferredAudio = call.getString("preferredAudio", "");
        String preferredSub   = call.getString("preferredSub", "");
        String episodesJson   = call.getString("episodesJson", "[]");

        Intent intent = new Intent(getContext(), VideoPlayerActivity.class);
        intent.putExtra(VideoPlayerActivity.EXTRA_URL,            url);
        intent.putExtra(VideoPlayerActivity.EXTRA_TITLE,          title);
        intent.putExtra(VideoPlayerActivity.EXTRA_FILE_NAME,      fileName);
        intent.putExtra(VideoPlayerActivity.EXTRA_FILE_ID,        fileId);
        intent.putExtra(VideoPlayerActivity.EXTRA_PREFERRED_AUDIO, preferredAudio);
        intent.putExtra(VideoPlayerActivity.EXTRA_PREFERRED_SUB,  preferredSub);
        intent.putExtra(VideoPlayerActivity.EXTRA_EPISODES_JSON,  episodesJson);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * Called by VideoPlayerActivity when it stops, so JS can persist the position.
     */
    public void emitPlayerStopped(String fileId, long positionMs, long durationMs,
                                   String audioLang, String subLang) {
        JSObject data = new JSObject();
        data.put("fileId",     fileId);
        data.put("positionMs", positionMs);
        data.put("durationMs", durationMs);
        data.put("audioLang",  audioLang != null ? audioLang : "");
        data.put("subLang",    subLang   != null ? subLang   : "");
        notifyListeners("playerStopped", data);
    }
}
