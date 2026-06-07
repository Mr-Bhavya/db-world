package com.db.dbworld;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

import com.db.dbworld.download.DbWorldDownloadPlugin;
import com.db.dbworld.player.DbWorldPlayerPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private final Handler immersiveHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DbWorldPlayerPlugin.class);
        registerPlugin(DbWorldDownloadPlugin.class);
        super.onCreate(savedInstanceState);
        setImmersiveMode();
        handleOpenDownloads(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOpenDownloads(intent);
    }

    /**
     * When launched from a download notification (extra "openDownloads"), tell the web
     * app to navigate to the Downloads page. Fired with a small delay so the SPA has a
     * chance to attach its listener; the JS side listens for "dbworldOpenDownloads".
     */
    private void handleOpenDownloads(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("openDownloads", false)) return;
        // Fire a few times so it lands whether the SPA is already up (warm) or still
        // loading (cold launch from the notification).
        for (long delay : new long[]{ 1200, 3500, 6000 }) {
            immersiveHandler.postDelayed(() -> {
                try {
                    if (getBridge() != null) getBridge().triggerWindowJSEvent("dbworldOpenDownloads");
                } catch (Exception ignored) {}
            }, delay);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        setImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) setImmersiveMode();
    }

    /**
     * IMMERSIVE (not STICKY): the first edge-swipe only reveals the system bars without
     * sending a back-key event to the app. The back event fires only on the *second*
     * gesture while bars are visible — giving the expected "first swipe shows bars,
     * second swipe navigates" UX. The listener auto-rehides after 3 s of inactivity.
     */
    @SuppressWarnings("deprecation")
    private void setImmersiveMode() {
        immersiveHandler.removeCallbacksAndMessages(null);
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE);
        decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0) {
                // bars became visible — schedule auto-rehide after 3 s
                immersiveHandler.removeCallbacksAndMessages(null);
                immersiveHandler.postDelayed(this::setImmersiveMode, 3000);
            }
        });
    }
}
