package com.db.dbworld.download;

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
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Capacitor plugin for native Android DownloadManager.
 *
 * Methods exposed to JS:
 *   startDownload({ url, fileName, title?, description? }) → { downloadId }
 *   getStatus({ downloadId })                              → { status, progress, bytesDownloaded, bytesTotal }
 *   listDownloads()                                        → { downloads: [...] }
 *   cancelDownload({ downloadId })                         → {}
 */
@CapacitorPlugin(name = "DbWorldDownload")
public class DbWorldDownloadPlugin extends Plugin {

    private DownloadManager downloadManager;
    // Track downloadId → callbackId for progress notifications
    private final ConcurrentHashMap<Long, String> activeDownloads = new ConcurrentHashMap<>();

    private BroadcastReceiver completionReceiver;

    @Override
    public void load() {
        super.load();
        downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);

        // Listen for download completion
        completionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != -1 && activeDownloads.containsKey(id)) {
                    JSObject result = queryDownload(id);
                    notifyListeners("downloadComplete", result);
                    activeDownloads.remove(id);
                }
            }
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(
                    completionReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_NOT_EXPORTED
            );
        } else {
            getContext().registerReceiver(
                    completionReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            );
        }
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        String url      = call.getString("url");
        String fileName = call.getString("fileName", "download");
        String title    = call.getString("title", fileName);
        String desc     = call.getString("description", "Downloading via DB Cinema");

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                .setTitle(title)
                .setDescription(desc)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_MOVIES, fileName)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false);

        // Make visible in gallery
        request.allowScanningByMediaScanner();

        long downloadId = downloadManager.enqueue(request);
        activeDownloads.put(downloadId, call.getCallbackId());

        JSObject result = new JSObject();
        result.put("downloadId", downloadId);
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        long downloadId = call.getLong("downloadId", -1L);
        if (downloadId == -1) { call.reject("downloadId required"); return; }
        call.resolve(queryDownload(downloadId));
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        long downloadId = call.getLong("downloadId", -1L);
        if (downloadId == -1) { call.reject("downloadId required"); return; }
        downloadManager.remove(downloadId);
        activeDownloads.remove(downloadId);
        call.resolve();
    }

    @PluginMethod
    public void listDownloads(PluginCall call) {
        DownloadManager.Query query = new DownloadManager.Query();
        Cursor cursor = downloadManager.query(query);

        JSArray list = new JSArray();
        if (cursor != null) {
            while (cursor.moveToNext()) {
                list.put(cursorToJson(cursor));
            }
            cursor.close();
        }

        JSObject result = new JSObject();
        result.put("downloads", list);
        call.resolve(result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private JSObject queryDownload(long downloadId) {
        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        Cursor cursor = downloadManager.query(query);
        JSObject result = new JSObject();
        result.put("downloadId", downloadId);
        if (cursor != null && cursor.moveToFirst()) {
            result = cursorToJson(cursor);
            cursor.close();
        }
        return result;
    }

    private JSObject cursorToJson(Cursor cursor) {
        JSObject obj = new JSObject();
        try {
            long   id        = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_ID));
            int    status    = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long   downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long   total     = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            String title     = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE));
            String localUri  = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
            String reason    = "";
            if (status == DownloadManager.STATUS_FAILED) {
                int r = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                reason = String.valueOf(r);
            }

            obj.put("downloadId",       id);
            obj.put("status",           statusLabel(status));
            obj.put("statusCode",       status);
            obj.put("progress",         total > 0 ? (int)(downloaded * 100 / total) : 0);
            obj.put("bytesDownloaded",  downloaded);
            obj.put("bytesTotal",       total);
            obj.put("title",            title != null ? title : "");
            obj.put("localUri",         localUri != null ? localUri : "");
            obj.put("failureReason",    reason);
        } catch (Exception ignored) {}
        return obj;
    }

    private static String statusLabel(int status) {
        switch (status) {
            case DownloadManager.STATUS_PENDING:    return "pending";
            case DownloadManager.STATUS_RUNNING:    return "running";
            case DownloadManager.STATUS_PAUSED:     return "paused";
            case DownloadManager.STATUS_SUCCESSFUL: return "success";
            case DownloadManager.STATUS_FAILED:     return "failed";
            default:                                return "unknown";
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try { getContext().unregisterReceiver(completionReceiver); } catch (Exception ignored) {}
    }
}
