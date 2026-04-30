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
 * - When a download completes, the next item in the queue starts automatically.
 *
 * JS API:
 *   startDownload({ url, fileName })    → { downloadId, queued }
 *   getStatus({ downloadId })           → { downloadId, status, bytesDownloaded, bytesTotal, progress }
 *   cancelDownload({ downloadId })      → {}
 *   listDownloads()                     → { downloads: [...] }
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

    /** Queue of pending download requests (when one is already running). */
    private final Queue<JSObject> pendingQueue = new ArrayDeque<>();

    /** The DownloadManager ID of the currently active download (-1 if none). */
    private long activeDownloadId = -1L;

    private BroadcastReceiver completionReceiver;

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
                    activeDownloadId = -1L;
                    // Notify JS side
                    JSObject data = new JSObject();
                    data.put("downloadId", String.valueOf(id));
                    notifyListeners("downloadComplete", data);
                    // Start next queued download
                    startNextQueued();
                }
            }
        };
        getContext().registerReceiver(
                completionReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        );
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try { getContext().unregisterReceiver(completionReceiver); } catch (Exception ignored) {}
    }

    // ─── ensurePermissions ────────────────────────────────────────────────────

    /**
     * Requests the runtime permission needed for downloads on the current API level:
     *  - Android 13+ (API 33): POST_NOTIFICATIONS (for download progress notification)
     *  - Android 6-9 (API 23-28): WRITE_EXTERNAL_STORAGE (for public Movies directory)
     *  - Android 10-12: no runtime permission needed — resolves immediately
     * Download proceeds regardless of whether notifications permission is granted.
     */
    @PluginMethod
    public void ensurePermissions(PluginCall call) {
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
        // Resolve regardless — DownloadManager works even if notifications are denied
        call.resolve();
    }

    // ─── startDownload ────────────────────────────────────────────────────────

    @PluginMethod
    public void startDownload(PluginCall call) {
        String url      = call.getString("url");
        String fileName = call.getString("fileName", "");

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        if (fileName == null || fileName.isEmpty()) {
            String last = Uri.parse(url).getLastPathSegment();
            fileName = (last != null && !last.isEmpty()) ? last : "download";
        }

        // If something is already running, queue this request
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

        long downloadId = enqueueDownload(url, fileName);
        activeDownloadId = downloadId;

        JSObject result = new JSObject();
        result.put("downloadId", String.valueOf(downloadId));
        result.put("queued", false);
        call.resolve(result);
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

        DownloadManager.Query q = new DownloadManager.Query();
        q.setFilterById(id);
        Cursor c = downloadManager.query(q);

        if (!c.moveToFirst()) { c.close(); call.reject("Download not found"); return; }
        call.resolve(cursorToJSObject(c));
        c.close();
    }

    // ─── cancelDownload ───────────────────────────────────────────────────────

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String idStr = call.getString("downloadId");
        if (idStr == null) { call.reject("downloadId required"); return; }

        // Handle queued (not yet started) items — just ignore since we don't have their real ID
        if (idStr.startsWith("queued_")) { call.resolve(); return; }

        long id;
        try { id = Long.parseLong(idStr); } catch (NumberFormatException e) {
            call.reject("Invalid downloadId"); return;
        }

        downloadManager.remove(id);
        if (id == activeDownloadId) {
            activeDownloadId = -1L;
            startNextQueued();
        }
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

        // Append pending-queued items as synthetic entries
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

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private long enqueueDownload(String url, String fileName) {
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(fileName);
        request.setDescription("DB-World");
        request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_MOVIES, fileName);
        request.allowScanningByMediaScanner();
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(false);
        return downloadManager.enqueue(request);
    }

    private void startNextQueued() {
        JSObject next = pendingQueue.poll();
        if (next == null) return;
        String url      = next.optString("url", "");
        String fileName = next.optString("fileName", "download");
        if (!url.isEmpty()) {
            activeDownloadId = enqueueDownload(url, fileName);
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
        long   id               = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_ID));
        int    dmStatus         = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
        long   bytesDownloaded  = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
        long   bytesTotal       = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
        String title            = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE));

        double progress = (bytesTotal > 0) ? (bytesDownloaded * 100.0 / bytesTotal) : 0;

        obj.put("downloadId", String.valueOf(id));
        obj.put("title",      title != null ? title : "");
        obj.put("status",     dmStatusToString(dmStatus));
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
