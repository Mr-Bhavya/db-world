package com.db.dbworld;

import android.os.Bundle;

import com.db.dbworld.downloader.DbWorldDownloadPlugin;
import com.db.dbworld.player.DbWorldPlayerPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DbWorldPlayerPlugin.class);
        registerPlugin(DbWorldDownloadPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
