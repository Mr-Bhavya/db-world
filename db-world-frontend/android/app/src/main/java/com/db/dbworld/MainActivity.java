package com.db.dbworld;

import android.os.Bundle;

import com.db.dbworld.player.DbWorldPlayerPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DbWorldPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
