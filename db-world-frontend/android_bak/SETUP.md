# Android Native Player — Setup Guide

Run these steps after `npx cap add android`.

---

## 1. app/build.gradle — add Media3 dependencies

Inside the `dependencies { }` block add:

```gradle
// Media3 ExoPlayer
def media3_version = "1.3.1"
implementation "androidx.media3:media3-exoplayer:$media3_version"
implementation "androidx.media3:media3-exoplayer-hls:$media3_version"
implementation "androidx.media3:media3-exoplayer-dash:$media3_version"
implementation "androidx.media3:media3-ui:$media3_version"
implementation "androidx.media3:media3-session:$media3_version"
```

Also confirm `compileOptions` and `kotlinOptions` target Java 11+:
```gradle
compileOptions {
    sourceCompatibility JavaVersion.VERSION_11
    targetCompatibility JavaVersion.VERSION_11
}
kotlinOptions {
    jvmTarget = '11'
}
```

---

## 2. AndroidManifest.xml — add activity + permissions

Inside `<manifest>` (before or after existing permissions):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WRITE_SETTINGS" tools:ignore="ProtectedPermissions" />
```

Inside `<application>`:
```xml
<!-- Native video player activity -->
<activity
    android:name="com.db.dbworld.player.VideoPlayerActivity"
    android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout"
    android:exported="false"
    android:launchMode="singleTop"
    android:screenOrientation="sensor"
    android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen"
    android:windowSoftInputMode="adjustNothing" />
```

---

## 3. Register the Capacitor plugin in MainActivity.kt

In `android/app/src/main/java/com/db/dbworld/MainActivity.kt`:
```kotlin
import com.db.dbworld.plugins.DbWorldPlayer

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(DbWorldPlayer::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

---

## 4. capacitor.config.json — already configured

The plugin is already registered:
```json
"plugins" {
    "DbWorldPlayer": {
        "package": "com.db.dbworld.player"
    }
}
```

---

## 5. JS usage (already wired in AndroidPlugins.js)

```js
import AndroidPlugins from '@platform/android/AndroidPlugins';
import { Capacitor } from '@capacitor/core';

// In your Play button handler:
if (Capacitor.getPlatform() === 'android') {
    await AndroidPlugins.launchNativePlayer({
        url:            mediaInfo.streamUrl,
        title:          record?.tmdb?.title ?? record?.name,
        fileName:       mediaInfo.general?.fileName,
        fileId:         mediaInfo.general?.fileId ?? mediaInfo.streamUrl,
        preferredAudio: 'Hindi',   // default
        preferredSub:   null,      // default off
    });
}
```

---

## Feature Summary

| Feature | Implementation |
|---|---|
| Play / Pause | Center play button + tap center |
| Seek ±10s | Side buttons + double-tap left/right |
| Seek by swipe | Horizontal swipe anywhere in center zone |
| Brightness | Swipe up/down on left 35% of screen |
| Volume | Swipe up/down on right 35% of screen |
| Zoom modes | Cycle: Fit → Zoom (crop) → Fill (stretch) → Original. Remembered on restart. |
| Audio tracks | Bottom bar 🎤 button — lists all tracks, selects Hindi by default |
| Subtitles | Bottom bar 💬 button — Off by default, lists embedded subs |
| Rotation lock | Top bar 🔄 button — locks to current orientation |
| Resume playback | Saves position per fileId on onStop, restores on relaunch |
| Brightness memory | Saves last brightness per app session |
| Media info | Top bar ℹ️ button — shows resolution, codec, audio, subtitle tracks |
| Auto-hide controls | 3.5s after last interaction when playing |
| Fullscreen immersive | Status bar + navigation bar hidden (swipe to reveal) |
| Keep screen on | WindowManager.FLAG_KEEP_SCREEN_ON while activity is open |
