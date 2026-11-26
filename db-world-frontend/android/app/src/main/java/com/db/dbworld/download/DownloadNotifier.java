package com.db.dbworld.download;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.db.dbworld.MainActivity;
import com.db.dbworld.R;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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
        boolean sized   = total > 0;
        int pct = Math.max(0, Math.min(100, progress));
        // Never show 100% until aria2 actually reports completion.
        if (pct == 100 && sized && done < total) pct = 99;

        long smooth = running ? smoothSpeed(gid, speed) : 0;
        if (!running) SPEED.remove(gid); // a resumed download starts its average afresh
        long eta = (running && smooth > 0 && sized && total > done) ? (total - done) / smooth : -1;

        // Line 1 (both views): what is happening and how long is left — the two things a glance needs.
        String headline;
        if (paused)                       headline = "Paused" + (sized ? " · " + pct + "%" : "");
        else if (!running)                headline = "Queued";
        else if (speed <= 0 && done == 0) headline = "Connecting…";
        else if (speed <= 0)              headline = (sized ? pct + "% · " : "") + "Waiting for data…";
        else if (sized)                   headline = pct + "%" + (eta > 0 ? " · " + fmtEta(eta) + " left" : "");
        else                              headline = fmtBytes(done) + " downloaded";

        // Line 2 (expanded only): exact sizes and rate.
        String sizes = sized ? fmtBytes(done) + " of " + fmtBytes(total)
                             : (done > 0 ? fmtBytes(done) : "Size unknown");
        String detail = sizes + (running && smooth > 0 ? "  ·  " + fmtSpeed(smooth) : "");

        // Collapsed view keeps one line, so it carries the rate after the headline when there is room.
        String collapsed = headline + (running && smooth > 0 ? " · " + fmtSpeed(smooth) : "");

        // Indeterminate while queued, or while running with no known size.
        boolean indeterminate = (!running && !paused) || (running && !sized);

        // Custom content view so the progress bar is teal (setColor can't tint it on API 31+/OneUI).
        RemoteViews small = progressView(ctx, title, collapsed, null, pct, indeterminate);
        RemoteViews big   = progressView(ctx, title, headline, detail, pct, indeterminate);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, DownloadForegroundService.CHANNEL_ID)
                .setSmallIcon(paused ? android.R.drawable.ic_media_pause
                                     : android.R.drawable.stat_sys_download)
                .setContentTitle(title)   // fallback text if the custom view can't render
                .setContentText(collapsed)
                .setColor(ACCENT)
                .setOngoing(running)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(small)
                .setCustomBigContentView(big)
                .setContentIntent(openDownloads(ctx));

        if (running)      b.addAction(action(ctx, gid, "PAUSE",  android.R.drawable.ic_media_pause, "Pause"));
        else if (paused)  b.addAction(action(ctx, gid, "RESUME", android.R.drawable.ic_media_play,  "Resume"));
        b.addAction(action(ctx, gid, "CANCEL", android.R.drawable.ic_menu_close_clear_cancel, "Cancel"));

        NotificationManagerCompat.from(ctx).notify(notifId(gid), b.build());
    }

    private static RemoteViews progressView(Context ctx, String title, String text, String sub,
                                            int pct, boolean indeterminate) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.notification_download);
        rv.setTextViewText(R.id.dl_title, title);
        rv.setTextViewText(R.id.dl_text, text);
        rv.setProgressBar(R.id.dl_progress, 100, pct, indeterminate);
        if (sub != null) {
            rv.setTextViewText(R.id.dl_sub, sub);
            rv.setViewVisibility(R.id.dl_sub, View.VISIBLE);
        }
        return rv;
    }

    @SuppressLint("MissingPermission")
    static void showComplete(Context ctx, String gid, String title, long total) {
        SPEED.remove(gid);
        DownloadForegroundService.ensureChannel(ctx);
        String text = "Download complete" + (total > 0 ? " · " + fmtBytes(total) : "") + " · Tap to open";
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, DownloadForegroundService.CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle(title)
                .setContentText(text)
                .setColor(themeColor(ctx))
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(openDownloads(ctx));
        NotificationManagerCompat.from(ctx).notify(notifId(gid), b.build());
    }

    @SuppressLint("MissingPermission")
    static void showError(Context ctx, String gid, String title) {
        SPEED.remove(gid);
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
        SPEED.remove(gid);
        try { NotificationManagerCompat.from(ctx).cancel(notifId(gid)); } catch (Exception ignored) {}
    }

    // ─── speed smoothing ────────────────────────────────────────────────────────

    /** Per-download exponential moving average of aria2's instantaneous speed (bytes/s). */
    private static final Map<String, Double> SPEED = new ConcurrentHashMap<>();
    private static final double SPEED_ALPHA = 0.3;

    /**
     * Folds one raw speed sample into the download's average and returns it. aria2's 1 Hz speed
     * swings widely, which made the ETA jump by minutes every tick; the average keeps it steady
     * while still following real changes within a few seconds.
     */
    static long smoothSpeed(String gid, long raw) {
        if (raw <= 0) return 0; // stalled: report it honestly, but keep the history for recovery
        Double prev = SPEED.get(gid);
        double next = prev == null ? raw : prev + SPEED_ALPHA * (raw - prev);
        SPEED.put(gid, next);
        return Math.round(next);
    }

    /** The current smoothed speed without adding a sample; falls back to the raw value. */
    static long peekSpeed(String gid, long raw) {
        if (raw <= 0) return 0;
        Double avg = SPEED.get(gid);
        return avg == null ? raw : Math.round(avg);
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

    /** Human ETA matching the app's wording: "1h 5m", "2m 3s", "45s". */
    static String fmtEta(long seconds) {
        if (seconds <= 0) return "";
        long h = seconds / 3600, m = (seconds % 3600) / 60, s = seconds % 60;
        if (h > 0) return m > 0 ? h + "h " + m + "m" : h + "h";
        if (m > 0) return m >= 10 || s == 0 ? m + "m" : m + "m " + s + "s";
        return s + "s";
    }
}
