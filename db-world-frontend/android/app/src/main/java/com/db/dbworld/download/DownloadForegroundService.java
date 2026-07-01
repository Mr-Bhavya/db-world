package com.db.dbworld.download;

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
import androidx.core.app.ServiceCompat;

import com.db.dbworld.MainActivity;

/**
 * Foreground service that keeps the app process alive AND awake while downloads
 * run. Fetch2 does the actual downloading on its own threads; this service is
 * what stops Android from freezing/killing those transfers when the app is
 * backgrounded, the screen is off, or the device enters Doze / battery-saver.
 *
 * Two things it does that the previous version didn't:
 *  1. Holds a PARTIAL_WAKE_LOCK + Wi-Fi lock while active — the root fix for
 *     "download stops on its own but the UI still says downloading". Without a
 *     wakelock the CPU/radio sleep under Doze and the socket dies silently.
 *  2. Handles Android 14/15's ~6h dataSync foreground-service runtime cap via
 *     onTimeout(): pause everything (Fetch persists partials, so they resume
 *     later) and stand down instead of getting ANR-killed.
 *
 * The plugin starts this service when the first download becomes active (from a
 * user tap, so we're allowed to go foreground) and stops it when none remain.
 * It renders the single grouped summary notification; Fetch's own notification
 * manager renders the per-download progress + action buttons on the SAME channel
 * and group so they bundle together instead of cluttering the shade.
 */
public class DownloadForegroundService extends Service {

    public static final String CHANNEL_ID = "dbworld_downloads";
    private static final int    NOTIF_ID   = 2999;
    private static final String LOCK_TAG   = "dbworld:downloads";
    /** Must match Fetch's DEFAULT_GROUP_ID so per-download notifications bundle under this summary. */
    private static final String NOTIF_GROUP = "0";

    public static final String EXTRA_ACTIVE_COUNT = "activeCount";

    private static boolean running = false;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock  wifiLock;

    public static boolean isRunning() {
        return running;
    }

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

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // intent may be null on an OS-initiated restart; default to 1 active item.
        int activeCount = intent != null ? intent.getIntExtra(EXTRA_ACTIVE_COUNT, 1) : 1;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                    this, NOTIF_ID, buildSummaryNotification(activeCount),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, buildSummaryNotification(activeCount));
        }
        running = true;
        acquireLocks();

        // NOT_STICKY on purpose: the download engine (Fetch) lives in the
        // Activity-scoped Capacitor plugin, so a headless sticky restart couldn't
        // actually download — it would just hold a wakelock + notification with no
        // work (a battery-draining zombie). The wakelock + foreground state prevent
        // the process from being killed in the first place; if the whole process is
        // still killed, downloads resume when the app is next opened (plugin.load()
        // re-drives them from Fetch's persisted DB).
        return START_NOT_STICKY;
    }

    /** Android 14 (API 34) single-arg timeout callback. */
    @Override
    public void onTimeout(int startId) {
        handleTimeout();
    }

    /** Android 15 (API 35) typed timeout callback. */
    @Override
    public void onTimeout(int startId, int fgsType) {
        handleTimeout();
    }

    /**
     * The system hit the dataSync foreground-service runtime cap. We MUST stop the
     * FGS promptly or the app is ANR-killed. Ask the plugin to pause everything
     * (Fetch persists partial files, so a later resume continues via HTTP Range),
     * then release our locks and stand down.
     */
    private void handleTimeout() {
        try {
            Intent i = new Intent(DbWorldDownloadPlugin.ACTION_NOTIF).setPackage(getPackageName());
            i.putExtra("action", "PAUSE_ALL");
            sendBroadcast(i);
        } catch (Exception ignored) {}
        stopInternal(true);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

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
                // FULL_HIGH_PERF is deprecated but the correct/harmless value here;
                // do NOT use FULL_LOW_LATENCY (real-time apps only — hurts throughput).
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

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Download progress");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private Notification buildSummaryNotification(int activeCount) {
        String text = activeCount == 1
                ? "Downloading 1 item"
                : "Downloading " + activeCount + " items";
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("DB World")
                .setContentText(text)
                .setContentIntent(openDownloadsPendingIntent())
                .setOngoing(true)
                .setGroup(NOTIF_GROUP)
                .setGroupSummary(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    /** Tapping the summary brings the app forward and opens the Downloads page. */
    private PendingIntent openDownloadsPendingIntent() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("openDownloads", true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 1001, intent, flags);
    }
}
