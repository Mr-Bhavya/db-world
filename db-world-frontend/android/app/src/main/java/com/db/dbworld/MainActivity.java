package com.db.dbworld;

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
