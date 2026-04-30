package com.db.dbworld.download;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.Call;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * DbWorldDownload — OkHttp-based download plugin.
 *
 * Replaces DownloadManager (which silently stalls on many OEM builds) with
 * a direct OkHttp download on a background thread.  Fires progress events to
 * JS and shows a system notification with a live progress bar.
 *
 * JS API (unchanged):
 *   ensurePermissions()              → {}
 *   startDownload({ url, fileName }) → { downloadId, queued }
 *   getStatus({ downloadId })        → { downloadId, status, … }
 *   cancelDownload({ downloadId })   → {}
 *   deleteDownload({ downloadId })   → {}
 *   pauseDownload({ downloadId })    → {}   (stub)
 *   resumeDownload({ downloadId })   → {}   (stub)
 *   listDownloads()                  → { downloads: […] }
 */
@CapacitorPlugin(
    name = "DbWorldDownload",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        ),
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class DbWorldDownloadPlugin extends Plugin {

    private static final String CHANNEL_ID = "dbworld_downloads";
    private static final long   NOTIFY_EVERY_BYTES = 256 * 1024; // fire progress every 256 KB

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)   // no read timeout — large files
            .followRedirects(true)
            .followSslRedirects(true)
            .build();

    private final ExecutorService executor    = Executors.newSingleThreadExecutor();
    private final Handler         mainHandler = new Handler(Looper.getMainLooper());

    // Tracks every active/queued download this session
    private final Map<String, DownloadTask> activeTasks   = new ConcurrentHashMap<>();
    private final List<JSObject>            finishedItems = new ArrayList<>();
    private final Queue<JSObject>           pendingQueue  = new ArrayDeque<>();
    private final AtomicBoolean             isDownloading = new AtomicBoolean(false);

    private int nextNotifId = 3000;

    // ─── Internal task record ─────────────────────────────────────────────────

    private static class DownloadTask {
        String  downloadId;
        String  url;
        String  fileName;
        String  title;
        volatile long   bytesDownloaded = 0;
        volatile long   bytesTotal      = -1;
        volatile String status          = "pending";
        volatile int    progress        = 0;
        volatile Call   okCall;
        volatile boolean cancelled      = false;
        int notifId;
    }

    // ─── load / destroy ───────────────────────────────────────────────────────

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
        android.util.Log.d("DbWorldDownload", "plugin loaded (OkHttp mode)");
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        executor.shutdownNow();
    }

    // ─── ensurePermissions ────────────────────────────────────────────────────

    @PluginMethod
    public void ensurePermissions(PluginCall call) {
        android.util.Log.d("DbWorldDownload", "ensurePermissions API=" + Build.VERSION.SDK_INT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "permissionsCallback");
                return;
            }
        } else if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (getPermissionState("storage") != PermissionState.GRANTED) {
                requestPermissionForAlias("storage", call, "permissionsCallback");
                return;
            }
        }
        call.resolve();
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        call.resolve();
    }

    // ─── startDownload ────────────────────────────────────────────────────────

    @PluginMethod
    public void startDownload(PluginCall call) {
        String url      = call.getString("url");
        String fileName = call.getString("fileName", "download");
        String title    = call.getString("title", fileName);

        if (url == null || url.isEmpty()) { call.reject("URL is required"); return; }
        if (fileName == null || fileName.isEmpty()) fileName = "download";

        android.util.Log.d("DbWorldDownload",
                "startDownload fileName=" + fileName + " url=" + url.substring(0, Math.min(80, url.length())));

        if (isDownloading.get()) {
            JSObject item = new JSObject();
            item.put("url", url); item.put("fileName", fileName); item.put("title", title);
            pendingQueue.add(item);

            JSObject result = new JSObject();
            result.put("downloadId", "queued_" + System.currentTimeMillis());
            result.put("queued", true);
            call.resolve(result);
            return;
        }

        DownloadTask task = buildTask(url, fileName, title);
        activeTasks.put(task.downloadId, task);
        isDownloading.set(true);
        executor.execute(() -> performDownload(task));

        JSObject result = new JSObject();
        result.put("downloadId", task.downloadId);
        result.put("queued", false);
        call.resolve(result);
    }

    // ─── getStatus ────────────────────────────────────────────────────────────

    @PluginMethod
    public void getStatus(PluginCall call) {
        String id = call.getString("downloadId");
        if (id == null) { call.reject("downloadId required"); return; }

        DownloadTask task = activeTasks.get(id);
        if (task != null) { call.resolve(taskToJSObject(task)); return; }

        JSObject result = new JSObject();
        result.put("downloadId", id);
        result.put("status", id.startsWith("queued_") ? "pending" : "unknown");
        call.resolve(result);
    }

    // ─── cancelDownload ───────────────────────────────────────────────────────

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String id = call.getString("downloadId");
        if (id == null) { call.reject("downloadId required"); return; }
        cancelTask(id);
        call.resolve();
    }

    // ─── deleteDownload ───────────────────────────────────────────────────────

    @PluginMethod
    public void deleteDownload(PluginCall call) {
        String id = call.getString("downloadId");
        if (id == null) { call.reject("downloadId required"); return; }
        cancelTask(id);
        // Remove from finished list too
        synchronized (finishedItems) {
            finishedItems.removeIf(o -> id.equals(o.optString("downloadId", null)));
        }
        call.resolve();
    }

    // ─── pauseDownload / resumeDownload (stubs) ───────────────────────────────

    @PluginMethod public void pauseDownload(PluginCall call)  { call.resolve(); }
    @PluginMethod public void resumeDownload(PluginCall call) { call.resolve(); }

    // ─── listDownloads ────────────────────────────────────────────────────────

    @PluginMethod
    public void listDownloads(PluginCall call) {
        JSArray list = new JSArray();

        // Active tasks
        for (DownloadTask t : activeTasks.values()) {
            list.put(taskToJSObject(t));
        }

        // Queued items (not yet started)
        int pos = 0;
        for (JSObject item : pendingQueue) {
            JSObject obj = new JSObject();
            obj.put("downloadId", "queued_" + pos++);
            obj.put("title",    item.optString("title", item.optString("fileName", "Pending")));
            obj.put("fileName", item.optString("fileName", "download"));
            obj.put("status",   "pending");
            obj.put("progress", 0);
            obj.put("bytesDownloaded", 0);
            obj.put("bytesTotal", -1);
            list.put(obj);
        }

        // Finished downloads (this session)
        synchronized (finishedItems) {
            for (JSObject fi : finishedItems) list.put(fi);
        }

        JSObject result = new JSObject();
        result.put("downloads", list);
        call.resolve(result);
    }

    // ─── Download execution ───────────────────────────────────────────────────

    private void performDownload(DownloadTask task) {
        android.util.Log.d("DbWorldDownload", "performDownload start id=" + task.downloadId);
        task.status = "running";
        showProgressNotif(task);
        fireEvent("downloadStateChanged", task);

        Request request = new Request.Builder()
                .url(task.url)
                .addHeader("User-Agent", "DbWorld-Android/1.0")
                .build();

        task.okCall = httpClient.newCall(request);

        try (Response response = task.okCall.execute()) {
            if (task.cancelled) { cleanupCancelled(task); return; }

            android.util.Log.d("DbWorldDownload", "HTTP " + response.code() + " for id=" + task.downloadId);

            if (!response.isSuccessful()) {
                android.util.Log.e("DbWorldDownload", "HTTP error " + response.code());
                failTask(task, "HTTP " + response.code());
                return;
            }

            ResponseBody body = response.body();
            if (body == null) { failTask(task, "empty response body"); return; }

            task.bytesTotal = body.contentLength();
            android.util.Log.d("DbWorldDownload",
                    "content-length=" + task.bytesTotal + " fileName=" + task.fileName);

            File outputDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!outputDir.exists()) outputDir.mkdirs();
            File outputFile = new File(outputDir, task.fileName);

            try (InputStream in = body.byteStream();
                 FileOutputStream out = new FileOutputStream(outputFile)) {

                byte[] buf = new byte[16 * 1024];
                int    count;
                long   lastFireBytes = 0;

                while ((count = in.read(buf)) != -1) {
                    if (task.cancelled) {
                        out.close();
                        outputFile.delete();
                        cleanupCancelled(task);
                        return;
                    }
                    out.write(buf, 0, count);
                    task.bytesDownloaded += count;

                    if (task.bytesTotal > 0) {
                        task.progress = (int)(task.bytesDownloaded * 100 / task.bytesTotal);
                    }

                    if (task.bytesDownloaded - lastFireBytes >= NOTIFY_EVERY_BYTES) {
                        lastFireBytes = task.bytesDownloaded;
                        fireEvent("downloadProgress", task);
                        updateProgressNotif(task);
                    }
                }
                out.flush();
            }

            task.status   = "success";
            task.progress = 100;
            android.util.Log.d("DbWorldDownload", "download complete id=" + task.downloadId);

            fireEvent("downloadProgress",    task);
            fireEvent("downloadComplete",    task);
            fireEvent("downloadStateChanged", task);
            showCompleteNotif(task);

            synchronized (finishedItems) { finishedItems.add(0, taskToJSObject(task)); }

        } catch (IOException e) {
            if (!task.cancelled) {
                android.util.Log.e("DbWorldDownload", "IO error: " + e.getMessage(), e);
                failTask(task, e.getMessage());
            }
        } finally {
            activeTasks.remove(task.downloadId);
            isDownloading.set(false);
            startNextQueued();
        }
    }

    // ─── Notification helpers ─────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "DB-World Downloads", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Download progress");
            NotificationManager nm = (NotificationManager)
                    getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private void showProgressNotif(DownloadTask task) {
        try {
            NotificationCompat.Builder b = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_sys_download)
                    .setContentTitle(task.title)
                    .setContentText("Downloading…")
                    .setProgress(100, 0, true)   // indeterminate until we know size
                    .setOngoing(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW);
            NotificationManagerCompat.from(getContext()).notify(task.notifId, b.build());
        } catch (Exception ignored) {}
    }

    private void updateProgressNotif(DownloadTask task) {
        try {
            boolean indeterminate = task.bytesTotal <= 0;
            String  text = indeterminate
                    ? formatBytes(task.bytesDownloaded)
                    : formatBytes(task.bytesDownloaded) + " / " + formatBytes(task.bytesTotal);

            NotificationCompat.Builder b = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_sys_download)
                    .setContentTitle(task.title)
                    .setContentText(text)
                    .setProgress(100, task.progress, indeterminate)
                    .setOngoing(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW);
            NotificationManagerCompat.from(getContext()).notify(task.notifId, b.build());
        } catch (Exception ignored) {}
    }

    private void showCompleteNotif(DownloadTask task) {
        try {
            NotificationManagerCompat.from(getContext()).cancel(task.notifId);
            NotificationCompat.Builder b = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle(task.title)
                    .setContentText("Download complete")
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT);
            NotificationManagerCompat.from(getContext()).notify(task.notifId + 10000, b.build());
        } catch (Exception ignored) {}
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private DownloadTask buildTask(String url, String fileName, String title) {
        DownloadTask t = new DownloadTask();
        t.downloadId = String.valueOf(System.currentTimeMillis());
        t.url        = url;
        t.fileName   = fileName;
        t.title      = title;
        t.notifId    = nextNotifId++;
        return t;
    }

    private void cancelTask(String id) {
        if (id.startsWith("queued_")) return;
        DownloadTask task = activeTasks.get(id);
        if (task != null) {
            task.cancelled = true;
            if (task.okCall != null) task.okCall.cancel();
            NotificationManagerCompat.from(getContext()).cancel(task.notifId);
        }
    }

    private void cleanupCancelled(DownloadTask task) {
        NotificationManagerCompat.from(getContext()).cancel(task.notifId);
        android.util.Log.d("DbWorldDownload", "download cancelled id=" + task.downloadId);
    }

    private void failTask(DownloadTask task, String reason) {
        task.status = "failed";
        android.util.Log.e("DbWorldDownload", "failTask id=" + task.downloadId + " reason=" + reason);
        fireEvent("downloadError",        task);
        fireEvent("downloadStateChanged", task);
        NotificationManagerCompat.from(getContext()).cancel(task.notifId);
    }

    private void startNextQueued() {
        JSObject next = pendingQueue.poll();
        if (next == null) return;
        DownloadTask task = buildTask(
                next.optString("url", ""),
                next.optString("fileName", "download"),
                next.optString("title", "Download"));
        if (!task.url.isEmpty()) {
            activeTasks.put(task.downloadId, task);
            isDownloading.set(true);
            executor.execute(() -> performDownload(task));
        }
    }

    private void fireEvent(String event, DownloadTask task) {
        JSObject obj = taskToJSObject(task);
        mainHandler.post(() -> notifyListeners(event, obj));
    }

    private JSObject taskToJSObject(DownloadTask task) {
        JSObject obj = new JSObject();
        obj.put("downloadId",      task.downloadId);
        obj.put("title",           task.title);
        obj.put("fileName",        task.fileName);
        obj.put("status",          task.status);
        obj.put("progress",        task.progress);
        obj.put("bytesDownloaded", task.bytesDownloaded);
        obj.put("bytesTotal",      task.bytesTotal);
        return obj;
    }

    private static String formatBytes(long bytes) {
        if (bytes < 0)           return "?";
        if (bytes < 1024)        return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024));
    }
}
