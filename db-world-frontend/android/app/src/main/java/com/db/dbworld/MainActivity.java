package com.db.dbworld;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

import com.db.dbworld.appupdate.AppUpdatePlugin;
import com.db.dbworld.download.DbWorldDownloadPlugin;
import com.db.dbworld.player.HybridPlayerPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private final Handler immersiveHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DbWorldDownloadPlugin.class);
        registerPlugin(HybridPlayerPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
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
     * When launched from a download notification (extra "openDownloads"), persist a
     * one-shot route flag. The web app pulls it via DbWorldDownload.consumePendingRoute()
     * on mount and on resume and navigates itself — robust for both a cold launch (SPA
     * still booting) and a warm app, with no fragile WebView eval timing.
     */
    private void handleOpenDownloads(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("openDownloads", false)) return;
        try {
            getSharedPreferences(DbWorldDownloadPlugin.PREFS, MODE_PRIVATE)
                    .edit()
                    .putString(DbWorldDownloadPlugin.PREF_PENDING_ROUTE, "downloads")
                    .apply();
        } catch (Exception ignored) {}
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
