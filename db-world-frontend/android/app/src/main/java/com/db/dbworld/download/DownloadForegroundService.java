package com.db.dbworld.download;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Tiny foreground service whose only job is to keep the app process alive while
 * downloads are running. Fetch2 performs the actual downloading on its own
 * threads; without a foreground service Android freely kills a backgrounded
 * process, which is the root cause of the old "downloads auto-stop" bug.
 *
 * The plugin starts this service when the first download becomes active and
 * stops it when none remain. It shows a low-importance summary notification;
 * Fetch's own notification manager renders the per-download progress + actions.
 */
public class DownloadForegroundService extends Service {

    public static final String CHANNEL_ID = "dbworld_downloads";
    private static final int   NOTIF_ID    = 2999;

    public static final String EXTRA_ACTIVE_COUNT = "activeCount";

    private static boolean running = false;

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
        int activeCount = intent != null ? intent.getIntExtra(EXTRA_ACTIVE_COUNT, 1) : 1;
        Notification notification = buildSummaryNotification(activeCount);

        // Android 14+ requires the foreground service type at startForeground time.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                    this, NOTIF_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, notification);
        }
        running = true;
        // If the OS kills us mid-download, Fetch's persisted state lets the plugin
        // resume on next launch; no need to redeliver the intent.
        return START_NOT_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "DB-World Downloads", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Download progress");
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
                .setOngoing(true)
                .setGroup(CHANNEL_ID)
                .setGroupSummary(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }
}
