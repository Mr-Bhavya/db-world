package com.db.dbworld;

import android.os.Bundle;
import android.view.View;

import com.db.dbworld.download.DbWorldDownloadPlugin;
import com.db.dbworld.player.DbWorldPlayerPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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
        if (hasFocus) {
            setImmersiveMode();
        }
    }

    @SuppressWarnings("deprecation")
    private void setImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
}
