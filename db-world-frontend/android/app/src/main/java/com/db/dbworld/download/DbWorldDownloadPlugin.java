package com.db.dbworld.download;

import android.Manifest;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayDeque;
import java.util.Queue;

/**
 * DbWorldDownload Capacitor plugin.
 *
 * - Only 1 download runs at a time; additional calls are queued.
 * - Fires downloadProgress / downloadStateChanged / downloadComplete / downloadError events.
 *
 * JS API:
 *   ensurePermissions()                → {}
 *   startDownload({ url, fileName })   → { downloadId, queued }
 *   getStatus({ downloadId })          → { downloadId, status, bytesDownloaded, bytesTotal, progress }
 *   cancelDownload({ downloadId })     → {}
 *   deleteDownload({ downloadId })     → {}
 *   pauseDownload({ downloadId })      → {}
 *   resumeDownload({ downloadId })     → {}
 *   listDownloads()                    → { downloads: [...] }
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

    private DownloadManager downloadManager;

    private final Queue<JSObject> pendingQueue = new ArrayDeque<>();
    private long activeDownloadId = -1L;

    private BroadcastReceiver completionReceiver;

    // Progress polling
    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private Runnable progressRunnable;
    private String lastPolledStatus = null;

    @Override
    public void load() {
        super.load();
        downloadManager = (DownloadManager) getContext()
                .getSystemService(Context.DOWNLOAD_SERVICE);

        completionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (id == activeDownloadId) {
                    stopProgressPolling();
                    activeDownloadId = -1L;
                    // Fire final complete event with full stats
                    JSObject data = queryDownload(id);
                    if (data == null) {
                        data = new JSObject();
                        data.put("downloadId", String.valueOf(id));
                        data.put("status", "success");
                        data.put("progress", 100);
                    } else {
                        data.put("status", "success");
                        data.put("progress", 100);
                    }
                    notifyListeners("downloadComplete", data);
                    notifyListeners("downloadStateChanged", data);
                    startNextQueued();
                }
            }
        };

        // Android 14+ (API 34) requires an explicit exported flag for dynamic receivers.
        // DownloadManager sends a system broadcast so the receiver must be EXPORTED.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            getContext().registerReceiver(
                    completionReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_EXPORTED
            );
        } else {
            getContext().registerReceiver(
                    completionReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            );
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        stopProgressPolling();
        try { getContext().unregisterReceiver(completionReceiver); } catch (Exception ignored) {}
    }

    // ─── ensurePermissions ────────────────────────────────────────────────────

    @PluginMethod
    public void ensurePermissions(PluginCall call) {
        android.util.Log.d("DbWorldDownload", "ensurePermissions: API=" + Build.VERSION.SDK_INT);
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
        String fileName = call.getString("fileName", "");

        android.util.Log.d("DbWorldDownload", "startDownload: fileName=" + fileName
                + " url=" + (url != null ? url.substring(0, Math.min(120, url.length())) : "null"));

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        if (fileName == null || fileName.isEmpty()) {
            String last = Uri.parse(url).getLastPathSegment();
            fileName = (last != null && !last.isEmpty()) ? last : "download";
        }

        if (activeDownloadId != -1L && isDownloadActive(activeDownloadId)) {
            JSObject item = new JSObject();
            item.put("url", url);
            item.put("fileName", fileName);
            pendingQueue.add(item);

            JSObject result = new JSObject();
            result.put("downloadId", "queued_" + System.currentTimeMillis());
            result.put("queued", true);
            call.resolve(result);
            return;
        }

        try {
            long downloadId = enqueueDownload(url, fileName);
            activeDownloadId = downloadId;
            lastPolledStatus = null;
            android.util.Log.d("DbWorldDownload", "enqueued ok: downloadId=" + downloadId);
            startProgressPolling(downloadId);

            JSObject result = new JSObject();
            result.put("downloadId", String.valueOf(downloadId));
            result.put("queued", false);
            call.resolve(result);
        } catch (Exception e) {
            android.util.Log.e("DbWorldDownload", "enqueueDownload failed: " + e.getMessage(), e);
            call.reject("enqueue failed: " + e.getMessage());
        }
    }

    // ─── getStatus ────────────────────────────────────────────────────────────

    @PluginMethod
    public void getStatus(PluginCall call) {
        String idStr = call.getString("downloadId");
        if (idStr == null || idStr.startsWith("queued_")) {
            JSObject result = new JSObject();
            result.put("status", "pending");
            call.resolve(result);
            return;
        }

        long id;
        try { id = Long.parseLong(idStr); } catch (NumberFormatException e) {
            call.reject("Invalid downloadId"); return;
        }

        JSObject obj = queryDownload(id);
        if (obj == null) { call.reject("Download not found"); return; }
        call.resolve(obj);
    }

    // ─── cancelDownload ───────────────────────────────────────────────────────

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String idStr = call.getString("downloadId");
        if (idStr == null) { call.reject("downloadId required"); return; }
        if (idStr.startsWith("queued_")) { call.resolve(); return; }

        long id;
        try { id = Long.parseLong(idStr); } catch (NumberFormatException e) {
            call.reject("Invalid downloadId"); return;
        }

        downloadManager.remove(id);
        if (id == activeDownloadId) {
            stopProgressPolling();
            activeDownloadId = -1L;
            startNextQueued();
        }
        call.resolve();
    }

    // ─── deleteDownload ───────────────────────────────────────────────────────

    @PluginMethod
    public void deleteDownload(PluginCall call) {
        String idStr = call.getString("downloadId");
        if (idStr == null) { call.reject("downloadId required"); return; }
        if (idStr.startsWith("queued_")) { call.resolve(); return; }

        long id;
        try { id = Long.parseLong(idStr); } catch (NumberFormatException e) {
            call.reject("Invalid downloadId"); return;
        }

        downloadManager.remove(id);
        if (id == activeDownloadId) {
            stopProgressPolling();
            activeDownloadId = -1L;
            startNextQueued();
        }
        call.resolve();
    }

    // ─── pauseDownload / resumeDownload (stubs — DownloadManager has no API for these) ──

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void resumeDownload(PluginCall call) {
        call.resolve();
    }

    // ─── listDownloads ────────────────────────────────────────────────────────

    @PluginMethod
    public void listDownloads(PluginCall call) {
        DownloadManager.Query q = new DownloadManager.Query();
        Cursor c = downloadManager.query(q);

        JSArray list = new JSArray();
        while (c.moveToNext()) {
            list.put(cursorToJSObject(c));
        }
        c.close();

        int pos = 0;
        for (JSObject item : pendingQueue) {
            JSObject obj = new JSObject();
            obj.put("downloadId", "queued_" + pos++);
            obj.put("title", item.optString("fileName", "Pending"));
            obj.put("status", "pending");
            obj.put("bytesDownloaded", 0);
            obj.put("bytesTotal", 0);
            obj.put("progress", 0);
            list.put(obj);
        }

        JSObject result = new JSObject();
        result.put("downloads", list);
        call.resolve(result);
    }

    // ─── Progress polling ─────────────────────────────────────────────────────

    private void startProgressPolling(long downloadId) {
        stopProgressPolling();
        progressRunnable = new Runnable() {
            @Override
            public void run() {
                pollProgress(downloadId);
            }
        };
        progressHandler.postDelayed(progressRunnable, 1000);
    }

    private void stopProgressPolling() {
        if (progressRunnable != null) {
            progressHandler.removeCallbacks(progressRunnable);
            progressRunnable = null;
        }
    }

    private void pollProgress(long downloadId) {
        JSObject obj = queryDownload(downloadId);
        if (obj == null) {
            stopProgressPolling();
            return;
        }

        String status = obj.optString("status", "unknown");

        // Always fire progress event for live UI updates
        notifyListeners("downloadProgress", obj);

        // Fire state-change event only when status transitions
        if (!status.equals(lastPolledStatus)) {
            lastPolledStatus = status;
            notifyListeners("downloadStateChanged", obj);
        }

        if ("success".equals(status) || "failed".equals(status)) {
            // Terminal state — BroadcastReceiver handles cleanup; stop polling
            stopProgressPolling();
            if ("failed".equals(status)) {
                notifyListeners("downloadError", obj);
            }
        } else {
            progressHandler.postDelayed(progressRunnable, 1000);
        }
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private JSObject queryDownload(long id) {
        DownloadManager.Query q = new DownloadManager.Query();
        q.setFilterById(id);
        Cursor c = downloadManager.query(q);
        if (!c.moveToFirst()) { c.close(); return null; }
        JSObject obj = cursorToJSObject(c);
        c.close();
        return obj;
    }

    private long enqueueDownload(String url, String fileName) {
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(fileName);
        request.setDescription("DB-World");
        request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE);
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);
        return downloadManager.enqueue(request);
    }

    private void startNextQueued() {
        JSObject next = pendingQueue.poll();
        if (next == null) return;
        String url      = next.optString("url", "");
        String fileName = next.optString("fileName", "download");
        if (!url.isEmpty()) {
            activeDownloadId = enqueueDownload(url, fileName);
            lastPolledStatus = null;
            startProgressPolling(activeDownloadId);
        }
    }

    private boolean isDownloadActive(long id) {
        DownloadManager.Query q = new DownloadManager.Query();
        q.setFilterById(id);
        q.setFilterByStatus(DownloadManager.STATUS_RUNNING | DownloadManager.STATUS_PENDING | DownloadManager.STATUS_PAUSED);
        Cursor c = downloadManager.query(q);
        boolean active = c.moveToFirst();
        c.close();
        return active;
    }

    private JSObject cursorToJSObject(Cursor c) {
        JSObject obj = new JSObject();
        long   id              = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_ID));
        int    dmStatus        = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
        int    dmReason        = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
        long   bytesDownloaded = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
        long   bytesTotal      = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
        String title           = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE));

        double progress = (bytesTotal > 0) ? (bytesDownloaded * 100.0 / bytesTotal) : 0;
        String statusStr = dmStatusToString(dmStatus);

        android.util.Log.d("DbWorldDownload",
                "poll id=" + id + " status=" + statusStr + " reason=" + dmReason
                + " bytes=" + bytesDownloaded + "/" + bytesTotal);

        obj.put("downloadId",      String.valueOf(id));
        obj.put("title",           title != null ? title : "");
        obj.put("status",          statusStr);
        obj.put("reason",          dmReason);
        obj.put("bytesDownloaded", bytesDownloaded);
        obj.put("bytesTotal",      bytesTotal);
        obj.put("progress",        (int) Math.round(progress));
        return obj;
    }

    private String dmStatusToString(int status) {
        switch (status) {
            case DownloadManager.STATUS_PENDING:    return "pending";
            case DownloadManager.STATUS_RUNNING:    return "running";
            case DownloadManager.STATUS_PAUSED:     return "paused";
            case DownloadManager.STATUS_SUCCESSFUL: return "success";
            case DownloadManager.STATUS_FAILED:     return "failed";
            default:                                return "unknown";
        }
    }
}
