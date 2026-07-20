package com.db.dbworld.download;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.db.dbworld.MainActivity;
import com.db.dbworld.R;

import java.util.Locale;

/**
 * Renders per-download notifications (live progress bar + speed/size, and Pause/Resume/Cancel/
 * Retry action buttons), tinted with the app's theme colour. aria2 has no notification layer of
 * its own, so the plugin's 1 Hz poller drives these from live RPC status; completion/error swap
 * the ongoing progress notification for a dismissible one.
 *
 * All entries use {@link DownloadForegroundService#CHANNEL_ID} and are standalone (not grouped),
 * so a paused or finished notification persists even after the foreground service stops.
 * Action taps are delivered as {@link DbWorldDownloadPlugin#ACTION_NOTIF} broadcasts.
 */
final class DownloadNotifier {

    /** Teal accent applied to all download notifications (icon tint, title, progress bar). */
    private static final int ACCENT = 0xFF009688; // Material Teal 500

    private DownloadNotifier() {}

    /** Stable per-download notification id derived from the aria2 gid. */
    static int notifId(String gid) {
        return ("dbworld_dl_" + gid).hashCode();
    }

    @SuppressLint("MissingPermission") // POST_NOTIFICATIONS is declared + requested by the plugin
    static void showProgress(Context ctx, String gid, String title, String status,
                             int progress, long speed, long done, long total) {
        DownloadForegroundService.ensureChannel(ctx);

        boolean running = "running".equals(status);
        boolean paused  = "paused".equals(status);
        int pct = Math.max(0, Math.min(100, progress));
        long eta = (running && speed > 0 && total > done) ? (total - done) / speed : -1;

        String size = total > 0 ? "  ·  " + fmtBytes(done) + " / " + fmtBytes(total) : "";
        String text;
        if (paused)       text = "Paused · " + pct + "%" + size;
        else if (running) text = pct + "%"
                + (speed > 0 ? "  ·  " + fmtSpeed(speed) : "")
                + (eta > 0 ? "  ·  " + fmtEta(eta) + " left" : "")
                + size;
        else              text = "Queued";

        // Custom content view so the progress bar is teal (setColor can't tint it on API 31+/OneUI).
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.notification_download);
        rv.setTextViewText(R.id.dl_title, title);
        rv.setTextViewText(R.id.dl_text, text);
        rv.setProgressBar(R.id.dl_progress, 100, pct, !running && !paused); // indeterminate only while queued

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, DownloadForegroundService.CHANNEL_ID)
                .setSmallIcon(paused ? android.R.drawable.ic_media_pause
                                     : android.R.drawable.stat_sys_download)
                .setContentTitle(title)   // fallback text if the custom view can't render
                .setContentText(text)
                .setColor(ACCENT)
                .setOngoing(running)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(rv)
                .setContentIntent(openDownloads(ctx));

        if (running)      b.addAction(action(ctx, gid, "PAUSE",  android.R.drawable.ic_media_pause, "Pause"));
        else if (paused)  b.addAction(action(ctx, gid, "RESUME", android.R.drawable.ic_media_play,  "Resume"));
        b.addAction(action(ctx, gid, "CANCEL", android.R.drawable.ic_menu_close_clear_cancel, "Cancel"));

        NotificationManagerCompat.from(ctx).notify(notifId(gid), b.build());
    }

    @SuppressLint("MissingPermission")
    static void showComplete(Context ctx, String gid, String title) {
        DownloadForegroundService.ensureChannel(ctx);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, DownloadForegroundService.CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle(title)
                .setContentText("Download complete")
                .setColor(themeColor(ctx))
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(openDownloads(ctx));
        NotificationManagerCompat.from(ctx).notify(notifId(gid), b.build());
    }

    @SuppressLint("MissingPermission")
    static void showError(Context ctx, String gid, String title) {
        DownloadForegroundService.ensureChannel(ctx);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, DownloadForegroundService.CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_error)
                .setContentTitle(title)
                .setContentText("Download failed — tap Retry")
                .setColor(themeColor(ctx))
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(openDownloads(ctx))
                .addAction(action(ctx, gid, "RETRY", android.R.drawable.ic_popup_sync, "Retry"));
        NotificationManagerCompat.from(ctx).notify(notifId(gid), b.build());
    }

    static void cancel(Context ctx, String gid) {
        try { NotificationManagerCompat.from(ctx).cancel(notifId(gid)); } catch (Exception ignored) {}
    }

    // ─── helpers ────────────────────────────────────────────────────────────────

    private static NotificationCompat.Action action(Context ctx, String gid, String act, int icon, String label) {
        Intent i = new Intent(DbWorldDownloadPlugin.ACTION_NOTIF).setPackage(ctx.getPackageName());
        i.putExtra("gid", gid);
        i.putExtra("action", act);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getBroadcast(ctx, (gid + act).hashCode(), i, flags);
        return new NotificationCompat.Action(icon, label, pi);
    }

    private static PendingIntent openDownloads(Context ctx) {
        Intent intent = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra("openDownloads", true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, 1002, intent, flags);
    }

    /** Teal accent for download notifications (tints the small icon, title, and progress bar). */
    static int themeColor(Context ctx) {
        return ACCENT;
    }

    private static String fmtBytes(long b) {
        if (b <= 0) return "0 B";
        String[] u = {"B", "KB", "MB", "GB", "TB"};
        int i = (int) (Math.log10(b) / Math.log10(1024));
        i = Math.max(0, Math.min(i, u.length - 1));
        double v = b / Math.pow(1024, i);
        return String.format(Locale.US, i == 0 ? "%.0f %s" : "%.1f %s", v, u[i]);
    }

    private static String fmtSpeed(long bytesPerSec) {
        return fmtBytes(bytesPerSec) + "/s";
    }

    private static String fmtEta(long seconds) {
        if (seconds <= 0) return "";
        long h = seconds / 3600, m = (seconds % 3600) / 60, s = seconds % 60;
        return h > 0 ? String.format(Locale.US, "%d:%02d:%02d", h, m, s)
                     : String.format(Locale.US, "%d:%02d", m, s);
    }
}
