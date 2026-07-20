package com.db.dbworld.download;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

import com.db.dbworld.MainActivity;

/**
 * Foreground service that keeps the app process — and therefore the embedded aria2c child
 * process — alive AND awake while downloads run. aria2 does the downloading; this service stops
 * Android from freezing/killing those transfers when the app is backgrounded, the screen is off,
 * or the device is in Doze / battery-saver.
 *
 * It holds a PARTIAL_WAKE_LOCK + Wi-Fi lock while active (the fix for "download stops on its own
 * but still shows downloading") and handles Android 14/15's ~6h dataSync foreground-service
 * runtime cap via {@link #onTimeout}: it asks the plugin to pause everything (aria2 persists
 * partials, so they resume later) and stands down instead of being ANR-killed.
 *
 * Started only from foreground entry points (a user tap / app resume) — never from the background
 * — so it can't throw the ForegroundServiceStartNotAllowed exception that used to wedge launch.
 */
public class DownloadForegroundService extends Service {

    public static final String CHANNEL_ID = "dbworld_downloads";
    private static final int    NOTIF_ID   = 2999;
    private static final String LOCK_TAG   = "dbworld:downloads";

    public static final String EXTRA_ACTIVE_COUNT = "activeCount";

    private static boolean running = false;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock  wifiLock;

    public static boolean isRunning() { return running; }

    public static void start(Context context, int activeCount) {
        Intent intent = new Intent(context, DownloadForegroundService.class);
        intent.putExtra(EXTRA_ACTIVE_COUNT, activeCount);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, DownloadForegroundService.class));
    }

    /**
     * Updates the ongoing notification's item count WITHOUT touching the service lifecycle — safe
     * to call from a background thread (the poller), unlike {@link #start} which would try to
     * bring the service to the foreground and can be blocked in the background on Android 12+.
     */
    @SuppressLint("MissingPermission") // POST_NOTIFICATIONS is declared + requested by the plugin
    public static void updateCount(Context context, int activeCount) {
        if (!running) return;
        try {
            ensureChannel(context);
            NotificationManagerCompat.from(context).notify(NOTIF_ID, buildNotification(context, activeCount));
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannel(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        int activeCount = intent != null ? intent.getIntExtra(EXTRA_ACTIVE_COUNT, 1) : 1;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(this, activeCount),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIF_ID, buildNotification(this, activeCount));
            }
            running = true;
            acquireLocks();
        } catch (Exception e) {
            // e.g. ForegroundServiceStartNotAllowed / DidNotStartInTime — stand down cleanly
            // rather than let the system ANR-kill the whole app. aria2 keeps downloading while
            // the process lives; if the process dies, downloads resume on next launch.
            android.util.Log.w("aria2", "startForeground failed: " + e.getMessage());
            stopInternal(true);
        }
        // NOT_STICKY: aria2's engine lives in the Activity-scoped plugin, so a headless sticky
        // restart couldn't actually download. Persisted session resumes on next app launch.
        return START_NOT_STICKY;
    }

    /** Android 14 (API 34) timeout callback. */
    @Override
    public void onTimeout(int startId) { handleTimeout(); }

    /** Android 15 (API 35) typed timeout callback. */
    @Override
    public void onTimeout(int startId, int fgsType) { handleTimeout(); }

    private void handleTimeout() {
        try {
            Intent i = new Intent(DbWorldDownloadPlugin.ACTION_NOTIF).setPackage(getPackageName());
            i.putExtra("action", "PAUSE_ALL");
            sendBroadcast(i); // plugin pauses all + saves the session
        } catch (Exception ignored) {}
        stopInternal(true);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        stopInternal(false);
        super.onDestroy();
    }

    private void stopInternal(boolean selfStop) {
        releaseLocks();
        running = false;
        try {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        } catch (Exception ignored) {}
        if (selfStop) stopSelf();
    }

    // ─── wake / wifi locks ────────────────────────────────────────────────────

    private void acquireLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (wakeLock == null && pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, LOCK_TAG);
                wakeLock.setReferenceCounted(false);
            }
            if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();

            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiLock == null && wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, LOCK_TAG);
                wifiLock.setReferenceCounted(false);
            }
            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
        } catch (Exception ignored) {}
    }

    private void releaseLocks() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        try { if (wifiLock != null && wifiLock.isHeld()) wifiLock.release(); } catch (Exception ignored) {}
    }

    // ─── notification ─────────────────────────────────────────────────────────

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Download progress");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private static Notification buildNotification(Context ctx, int activeCount) {
        String text = activeCount == 1
                ? "Downloading 1 item"
                : "Downloading " + activeCount + " items";
        return new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("DB World")
                .setContentText(text)
                .setContentIntent(openDownloadsPendingIntent(ctx))
                .setColor(DownloadNotifier.themeColor(ctx))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    /** Tapping the notification brings the app forward and opens the Downloads page. */
    private static PendingIntent openDownloadsPendingIntent(Context ctx) {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("openDownloads", true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, 1001, intent, flags);
    }
}
