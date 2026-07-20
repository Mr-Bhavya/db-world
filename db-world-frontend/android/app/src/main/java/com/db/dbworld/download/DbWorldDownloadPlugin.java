package com.db.dbworld.download;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.MediaScannerConnection;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * DbWorldDownload — production download manager backed by an embedded <b>aria2c</b> process.
 *
 * aria2 owns the queue, segmented multi-connection transfers (the big speed win over the old
 * single-connection engine), HTTP-Range resume, retries and stall handling. This plugin is the
 * Capacitor bridge: it drives aria2 over JSON-RPC ({@link Aria2Rpc}/{@link Aria2Daemon}), keeps
 * durable app metadata + completed-download history in {@link DownloadMetaStore}, polls aria2 at
 * 1 Hz to emit live progress events, publishes finished files to the phone's Downloads via
 * {@link MediaStorePublisher}, and keeps the process (and thus aria2c) alive during downloads via
 * {@link DownloadForegroundService}.
 *
 * The JS method + event surface is unchanged from the previous Fetch2 implementation, so the web
 * app needs no changes. {@code downloadId} is now aria2's gid (an opaque string).
 *
 * JS status vocabulary: pending · running · paused · success · failed · cancelled
 */
@CapacitorPlugin(
    name = "DbWorldDownload",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
        @Permission(alias = "storage",       strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class DbWorldDownloadPlugin extends Plugin {

    private static final String TAG               = "DbWorldDownload";
    private static final int    DEFAULT_CONCURRENT = 1;
    private static final int    MAX_CONCURRENT     = 3;

    public  static final String PREFS              = "dbworld_downloads_prefs";
    public  static final String PREF_PENDING_ROUTE = "pending_route";
    private static final String PREF_WIFI_ONLY     = "wifi_only";
    private static final String PREF_CONCURRENT     = "concurrent_limit";
    private static final String PREF_SECRET        = "aria2_rpc_secret";

    /** Notification-action + FGS-timeout broadcast. Carries "action"
     *  (PAUSE/RESUME/CANCEL/RETRY/PAUSE_ALL) and, for per-download actions, "gid". */
    public  static final String ACTION_NOTIF       = "com.db.dbworld.DOWNLOAD_NOTIF_ACTION";

    private Aria2Daemon       daemon;
    private DownloadMetaStore store;
    private File              downloadDir;
    private File              sessionFile;
    private volatile String   initError = null;

    private final ExecutorService          ioExecutor = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService poller     = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "dbworld-aria2-poll");
        t.setDaemon(true);
        return t;
    });
    private ScheduledFuture<?> pollFuture;
    /** gids with a pause requested but not yet reflected by aria2 — suppresses decaying-speed emits. */
    private final Set<String> pausing = ConcurrentHashMap.newKeySet();

    private ConnectivityManager.NetworkCallback netCallback;

    // Notification-action receiver. It is STATIC and registered once on the application context so
    // it survives Activity destruction: a notification button is tapped while the app is
    // backgrounded — often with the Activity already gone but the process kept alive by the
    // foreground service. An Activity-scoped receiver would be unregistered by then (the old bug
    // where taps did nothing). It dispatches to the current plugin instance.
    private static volatile DbWorldDownloadPlugin ACTIVE;
    private static boolean receiverRegistered = false;

    private static final BroadcastReceiver NOTIF_RECEIVER = new BroadcastReceiver() {
        @Override public void onReceive(Context ctx, Intent intent) {
            DbWorldDownloadPlugin p = ACTIVE;
            if (p != null && intent != null && ACTION_NOTIF.equals(intent.getAction())) {
                p.handleNotifAction(intent);
            }
        }
    };

    /** Dispatches a notification button tap (Pause/Resume/Cancel/Retry) or the FGS PauseAll timeout. */
    private void handleNotifAction(Intent intent) {
        if (daemon == null) return;
        String action = intent.getStringExtra("action");
        if (action == null) return;
        String gid = intent.getStringExtra("gid");
        android.util.Log.i(TAG, "notif action: " + action + " gid=" + gid);
        if ("PAUSE_ALL".equals(action)) {
            runIo(() -> {
                try { daemon.rpc().pauseAll(); daemon.rpc().saveSession(); } catch (Exception ignored) {}
                startPolling();
            });
            return;
        }
        if (gid == null) return;
        switch (action) {
            case "PAUSE":  runIo(() -> pauseGid(gid));  break;
            case "RESUME": runIo(() -> resumeGid(gid)); break;
            case "CANCEL": runIo(() -> cancelGid(gid)); break;
            case "RETRY":  runIo(() -> {
                try { retryGid(gid); } catch (Exception e) { android.util.Log.w(TAG, "notif retry failed: " + e.getMessage()); }
            }); break;
            default: break;
        }
    }

    // ─── lifecycle ──────────────────────────────────────────────────────────

    @Override
    public void load() {
        super.load();
        android.util.Log.i(TAG, "BUILD_MARKER=aria2c-v1 load()");
        // Never let init throw out of load(): Capacitor would drop the plugin and every call
        // would fail with the opaque "not implemented on android". Surface real errors via initError.
        try {
            store       = new DownloadMetaStore(new File(getContext().getFilesDir(), "dbworld_downloads.json"));
            downloadDir = downloadDir();
            sessionFile = new File(getContext().getFilesDir(), "aria2.session");
            daemon      = new Aria2Daemon(getContext(), getOrCreateSecret(), downloadDir, sessionFile);

            ACTIVE = this;
            if (!receiverRegistered) {
                ContextCompat.registerReceiver(getContext().getApplicationContext(), NOTIF_RECEIVER,
                        new IntentFilter(ACTION_NOTIF), ContextCompat.RECEIVER_NOT_EXPORTED);
                receiverRegistered = true;
            }
            registerNetworkCallback();

            // Start the aria2c child process off the main thread (exec + readiness poll ~1s).
            // Starting a child process is NOT gated by the foreground-service background rules,
            // so this is safe here; the FGS itself is only started from foreground entry points.
            runIo(() -> {
                boolean ok = daemon.ensureStarted(concurrentLimit());
                if (!ok) {
                    initError = "Download engine unavailable — the aria2c binary is missing for this "
                            + "device's CPU (drop libaria2c.so into jniLibs/<abi>/) or failed to start.";
                    android.util.Log.e(TAG, initError);
                    return;
                }
                initError = null;
                try { reconcileOnStartup(); } catch (Exception e) {
                    android.util.Log.w(TAG, "startup reconcile failed: " + e.getMessage());
                }
                startPolling(); // reflect any downloads reloaded from the saved session
            });
        } catch (Throwable t) {
            initError = t.getClass().getSimpleName() + ": " + t.getMessage();
            android.util.Log.e(TAG, "aria2 init failed in load(): " + initError, t);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // Returning to the foreground: re-assert the FGS for any in-flight work (allowed now),
        // and refresh the live view.
        runIo(() -> {
            boolean hasActive = false, hasNonTerminal = false;
            for (JSONObject m : store.all()) {
                String s = m.optString("status", "");
                if ("pending".equals(s) || "running".equals(s)) hasActive = true;
                if (!isTerminal(s)) hasNonTerminal = true;
            }
            if (hasActive) startForegroundServiceSafe(1);
            if (hasNonTerminal) startPolling();
        });
    }

    @Override
    protected void handleOnDestroy() {
        stopPolling();
        // NOTIF_RECEIVER is intentionally NOT unregistered — it's process-scoped (application
        // context) so notification buttons keep working while downloads run with the Activity gone.
        // Cleaned up automatically when the process dies.
        unregisterNetworkCallback();
        // Do NOT shut aria2 down: downloads keep running under the foreground service while the
        // process is alive; --stop-with-process cleans it up if the process is actually killed.
        super.handleOnDestroy();
    }

    // ─── permissions ──────────────────────────────────────────────────────────

    @PluginMethod
    public void ensurePermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionsCallback");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Direct writes to public Download/DB-World need All-files-access on Android 11+.
            if (!Environment.isExternalStorageManager()) promptAllFilesAccess();
        } else if (getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "permissionsCallback");
            return;
        }
        call.resolve();
    }

    /** Opens the system "All files access" screen for this app (Android 11+). */
    private void promptAllFilesAccess() {
        try {
            getContext().startActivity(new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception e) {
            try {
                getContext().startActivity(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {}
        }
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) { call.resolve(); }

    // ─── startDownload ──────────────────────────────────────────────────────

    @PluginMethod
    public void startDownload(PluginCall call) {
        final String url      = call.getString("url");
        String fileNameArg    = call.getString("fileName", "download");
        final String title    = call.getString("title", fileNameArg);
        final String thumb    = orEmpty(call.getString("thumbnailUrl", ""));
        final String mediaId  = orEmpty(call.getString("mediaFileId", ""));
        final String recordId = orEmpty(call.getString("recordId", ""));
        final String mimeArg  = orEmpty(call.getString("mimeType", ""));
        final String requestId = orEmpty(call.getString("requestId", ""));

        if (url == null || url.isEmpty()) { call.reject("URL is required"); return; }
        final String fileName = (fileNameArg == null || fileNameArg.isEmpty()) ? "download" : fileNameArg;
        final String mime     = mimeArg.isEmpty() ? guessMime(fileName) : mimeArg;

        runIo(() -> {
            try {
                // De-dup against an existing record for the same file.
                JSONObject existing = store.findByFileName(fileName);
                if (existing != null) {
                    String s = existing.optString("status", "");
                    String gid = existing.optString("gid", "");
                    if ("success".equals(s)) {
                        JSObject r = new JSObject();
                        r.put("downloadId", gid); r.put("queued", false); r.put("alreadyDownloaded", true);
                        call.resolve(r); return;
                    }
                    if ("pending".equals(s) || "running".equals(s) || "paused".equals(s)) {
                        JSObject r = new JSObject();
                        r.put("downloadId", gid); r.put("alreadyActive", true);
                        r.put("queued", "pending".equals(s));
                        call.resolve(r); return;
                    }
                    // failed/cancelled → allow a fresh enqueue below; drop the stale record.
                    store.remove(gid);
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
                    promptAllFilesAccess();
                    call.reject("Grant \"All files access\" to save into the DB-World folder, then try again.");
                    return;
                }

                if (!daemon.ensureStarted(concurrentLimit())) {
                    call.reject(initError != null ? initError : "Download engine unavailable");
                    return;
                }
                // We're on a user tap while the app is foreground → allowed to go foreground.
                startForegroundServiceSafe(1);

                boolean startPaused = isWifiOnly() && !isUnmetered();

                JSONObject opts = new JSONObject();
                opts.put("out", fileName);
                opts.put("dir", downloadDir.getAbsolutePath());
                if (startPaused) opts.put("pause", "true");

                String gid = daemon.rpc().addUri(url, opts);

                JSONObject meta = new JSONObject();
                meta.put("gid", gid);
                meta.put("url", url);
                meta.put("fileName", fileName);
                meta.put("title", title);
                meta.put("thumbnailUrl", thumb);
                meta.put("mediaFileId", mediaId);
                meta.put("recordId", recordId);
                meta.put("mimeType", mime);
                meta.put("requestId", requestId);
                meta.put("dir", downloadDir.getAbsolutePath());
                meta.put("path", new File(downloadDir, fileName).getAbsolutePath());
                meta.put("status", startPaused ? "paused" : "pending");
                meta.put("bytesTotal", 0);
                meta.put("localUri", "");
                meta.put("addedAt", System.currentTimeMillis());
                store.upsert(gid, meta);

                emit("downloadAdded", meta, null);
                startPolling();

                JSObject r = new JSObject();
                r.put("downloadId", gid); r.put("queued", true);
                call.resolve(r);
            } catch (Exception e) {
                android.util.Log.e(TAG, "startDownload failed: " + e.getMessage(), e);
                call.reject("Failed to start download: " + e.getMessage());
            }
        });
    }

    // ─── direct save / open (used by the Document Wallet — NOT an aria2 download) ──

    /**
     * Writes already-in-hand bytes (base64) straight into the public Downloads/DB-World collection
     * and returns a shareable URI. Unlike {@link #startDownload}, this bypasses aria2: the wallet has
     * already fetched + decrypted the (authenticated, per-user) file into the WebView, so there is no
     * URL for the native daemon to fetch. Small documents only — the payload is held in memory.
     *
     * <p>API 29+: temp-file → {@link MediaStorePublisher#publish} → {@code content://} URI (visible in
     * the Files app, no storage permission). API ≤ 28: writes to the public Downloads/DB-World path
     * and returns a {@code file://} URI.
     */
    @PluginMethod
    public void saveDocument(PluginCall call) {
        final String base64   = call.getString("data");
        final String nameArg  = orEmpty(call.getString("fileName", "document"));
        final String mimeArg  = orEmpty(call.getString("mimeType", ""));
        if (base64 == null || base64.isEmpty()) { call.reject("data is required"); return; }
        final String fileName = nameArg.isEmpty() ? "document" : nameArg;
        final String mime     = mimeArg.isEmpty() ? guessMime(fileName) : mimeArg;

        runIo(() -> {
            File tmp = null;
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                Uri resultUri;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    tmp = File.createTempFile("wallet_", ".tmp", getContext().getCacheDir());
                    try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(bytes); }
                    resultUri = MediaStorePublisher.publish(getContext(), tmp, fileName, mime);
                } else {
                    File dest = new File(downloadDir, fileName);
                    try (FileOutputStream out = new FileOutputStream(dest)) { out.write(bytes); }
                    resultUri = Uri.fromFile(dest);
                }
                JSObject r = new JSObject();
                r.put("uri", resultUri.toString());
                r.put("mimeType", mime);
                call.resolve(r);
            } catch (Exception e) {
                android.util.Log.e(TAG, "saveDocument failed: " + e.getMessage(), e);
                call.reject("saveDocument failed: " + e.getMessage());
            } finally {
                if (tmp != null) //noinspection ResultOfMethodCallIgnored
                    tmp.delete();
            }
        });
    }

    /**
     * Opens a previously-saved file in the user's default viewer via ACTION_VIEW. Accepts a
     * {@code content://} URI (opened directly) or a {@code file://} URI (re-wrapped through our
     * FileProvider so it's shareable on API 24+).
     */
    @PluginMethod
    public void openFile(PluginCall call) {
        final String uriStr  = call.getString("uri");
        final String mimeArg = orEmpty(call.getString("mimeType", ""));
        if (uriStr == null || uriStr.isEmpty()) { call.reject("uri is required"); return; }
        try {
            Uri uri  = Uri.parse(uriStr);
            String mime = mimeArg.isEmpty() ? guessMime(uriStr) : mimeArg;
            if ("file".equals(uri.getScheme())) {
                File f = new File(uri.getPath());
                uri = FileProvider.getUriForFile(getContext(),
                        getContext().getPackageName() + ".fileprovider", f);
            }
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, mime);
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(view);
            call.resolve();
        } catch (Exception e) {
            android.util.Log.e(TAG, "openFile failed: " + e.getMessage(), e);
            call.reject("openFile failed: " + e.getMessage());
        }
    }

    // ─── queue actions ──────────────────────────────────────────────────────

    @PluginMethod
    public void pauseDownload(PluginCall call)  { withGid(call, this::pauseGid); }

    @PluginMethod
    public void resumeDownload(PluginCall call) { withGid(call, this::resumeGid); }

    @PluginMethod
    public void cancelDownload(PluginCall call) { withGid(call, this::cancelGid); }

    @PluginMethod
    public void retryDownload(PluginCall call) {
        final String gid = call.getString("downloadId");
        if (gid == null) { call.reject("downloadId required"); return; }
        runIo(() -> {
            try {
                String newGid = retryGid(gid);
                JSObject r = new JSObject();
                r.put("downloadId", newGid);
                call.resolve(r);
            } catch (Exception e) {
                android.util.Log.e(TAG, "retry failed: " + e.getMessage(), e);
                call.reject("Retry failed: " + e.getMessage());
            }
        });
    }

    // Internal actions shared by the @PluginMethods above and the notification buttons.
    // Each runs on the io thread (via withGid/runIo/receiver) and is self-contained + throw-safe.

    private void pauseGid(String gid) {
        pausing.add(gid); // stop the poller emitting progress for it right away
        try { daemon.rpc().pause(gid); } catch (Exception e) { android.util.Log.w(TAG, "pause failed: " + e.getMessage()); }
        startPolling();
    }

    private void resumeGid(String gid) {
        pausing.remove(gid);
        try { daemon.rpc().unpause(gid); } catch (Exception e) { android.util.Log.w(TAG, "resume failed: " + e.getMessage()); }
        startForegroundServiceSafe(1); // user action; app is typically foreground
        startPolling();
    }

    /** Stop the transfer but keep a CANCELLED record (partial retained) so it's redownloadable. */
    private void cancelGid(String gid) {
        pausing.remove(gid);
        try { daemon.rpc().remove(gid); } catch (Exception ignored) {}
        store.patch(gid, map("status", "cancelled"));
        DownloadNotifier.cancel(getContext(), gid);
        JSONObject m = store.get(gid);
        if (m != null) emit("downloadStateChanged", m, null);
    }

    /** Re-enqueue a failed/cancelled download's URL, swap its record to the new gid; returns new gid. */
    private String retryGid(String gid) throws Exception {
        JSONObject meta = store.get(gid);
        if (meta == null) throw new IllegalStateException("unknown downloadId");
        String url = meta.optString("url", "");
        if (url.isEmpty()) throw new IllegalStateException("no URL on record to retry");
        String fileName = meta.optString("fileName", "download");
        if (!daemon.ensureStarted(concurrentLimit())) {
            throw new IllegalStateException(initError != null ? initError : "Download engine unavailable");
        }
        startForegroundServiceSafe(1);

        JSONObject opts = new JSONObject();
        opts.put("out", fileName);
        opts.put("dir", downloadDir.getAbsolutePath());
        String newGid = daemon.rpc().addUri(url, opts);

        try { daemon.rpc().removeDownloadResult(gid); } catch (Exception ignored) {}
        DownloadNotifier.cancel(getContext(), gid);
        store.rekey(gid, newGid);
        store.patch(newGid, map("status", "pending", "localUri", ""));

        emitRemoved(gid);
        JSONObject fresh = store.get(newGid);
        if (fresh != null) emit("downloadAdded", fresh, null);
        startPolling();
        return newGid;
    }

    @PluginMethod
    public void deleteDownload(PluginCall call) {
        final String gid = call.getString("downloadId");
        if (gid == null) { call.reject("downloadId required"); return; }
        runIo(() -> {
            try {
                JSONObject meta = store.get(gid);
                // Stop it if still live, then drop aria2's record.
                try { daemon.rpc().forceRemove(gid); } catch (Exception ignored) {}
                try { daemon.rpc().removeDownloadResult(gid); } catch (Exception ignored) {}
                if (meta != null) {
                    String localUri = meta.optString("localUri", "");
                    if (!localUri.isEmpty()) MediaStorePublisher.delete(getContext(), localUri);
                    String path = meta.optString("path", "");
                    if (!path.isEmpty()) {
                        //noinspection ResultOfMethodCallIgnored
                        new File(path).delete();
                        //noinspection ResultOfMethodCallIgnored
                        new File(path + ".aria2").delete(); // aria2 control file
                    }
                }
                pausing.remove(gid);
                store.remove(gid);
                DownloadNotifier.cancel(getContext(), gid);
                emitRemoved(gid);
                call.resolve();
            } catch (Exception e) {
                android.util.Log.e(TAG, "delete failed: " + e.getMessage(), e);
                call.reject("Delete failed: " + e.getMessage());
            }
        });
    }

    // ─── settings ─────────────────────────────────────────────────────────────

    @PluginMethod
    public void setNetworkPolicy(PluginCall call) {
        boolean wifiOnly = Boolean.TRUE.equals(call.getBoolean("wifiOnly", false));
        prefs().edit().putBoolean(PREF_WIFI_ONLY, wifiOnly).apply();
        runIo(() -> {
            try {
                if (daemon != null && daemon.isRunning()) {
                    if (wifiOnly && !isUnmetered()) daemon.rpc().pauseAll();
                    else if (!wifiOnly)             daemon.rpc().unpauseAll();
                    startPolling();
                }
            } catch (Exception ignored) {}
            call.resolve();
        });
    }

    @PluginMethod
    public void getSettings(PluginCall call) {
        JSObject r = new JSObject();
        r.put("wifiOnly", isWifiOnly());
        r.put("concurrentLimit", concurrentLimit());
        r.put("maxConcurrentLimit", MAX_CONCURRENT);
        call.resolve(r);
    }

    @PluginMethod
    public void setConcurrentLimit(PluginCall call) {
        Integer limit = call.getInt("limit");
        if (limit == null) { call.reject("limit required"); return; }
        int n = Math.max(1, Math.min(MAX_CONCURRENT, limit));
        prefs().edit().putInt(PREF_CONCURRENT, n).apply();
        runIo(() -> {
            try {
                if (daemon != null && daemon.isRunning()) {
                    JSONObject o = new JSONObject();
                    o.put("max-concurrent-downloads", String.valueOf(n));
                    daemon.rpc().changeGlobalOption(o);
                    startPolling(); // a freed slot may start a queued item
                }
            } catch (Exception ignored) {}
            JSObject r = new JSObject();
            r.put("concurrentLimit", n);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void consumePendingRoute(PluginCall call) {
        SharedPreferences p = prefs();
        String route = p.getString(PREF_PENDING_ROUTE, null);
        if (route != null) p.edit().remove(PREF_PENDING_ROUTE).apply();
        JSObject r = new JSObject();
        r.put("route", route == null ? "" : route);
        call.resolve(r);
    }

    // ─── listDownloads ────────────────────────────────────────────────────────

    @PluginMethod
    public void listDownloads(PluginCall call) {
        runIo(() -> {
            try {
                Map<String, JSONObject> live = liveStatuses();
                JSArray list = new JSArray();
                for (JSONObject meta : store.all()) {
                    String gid    = meta.optString("gid", "");
                    String status = meta.optString("status", "");
                    // Drop completed entries whose published file no longer exists.
                    if ("success".equals(status) && !publishedFileExists(meta)) continue;
                    list.put(toDto(meta, live.get(gid)));
                }
                JSObject r = new JSObject();
                r.put("downloads", list);
                call.resolve(r);
            } catch (Exception e) {
                // Even if aria2 isn't reachable, return whatever durable history we have.
                android.util.Log.w(TAG, "listDownloads live query failed: " + e.getMessage());
                JSArray list = new JSArray();
                for (JSONObject meta : store.all()) {
                    if ("success".equals(meta.optString("status", "")) && !publishedFileExists(meta)) continue;
                    list.put(toDto(meta, null));
                }
                JSObject r = new JSObject();
                r.put("downloads", list);
                call.resolve(r);
            }
        });
    }

    // ─── 1 Hz poller (live progress + completion detection) ─────────────────────

    private synchronized void startPolling() {
        if (pollFuture != null && !pollFuture.isCancelled()) return;
        pollFuture = poller.scheduleWithFixedDelay(this::pollTick, 0, 1, TimeUnit.SECONDS);
    }

    private synchronized void stopPolling() {
        if (pollFuture != null) { pollFuture.cancel(false); pollFuture = null; }
    }

    private void pollTick() {
        try {
            if (daemon == null) return;
            Aria2Rpc rpc = daemon.rpc();
            JSONArray active  = rpc.tellActive(Aria2Rpc.POLL_KEYS);
            JSONArray waiting = rpc.tellWaiting(0, 1000, Aria2Rpc.POLL_KEYS);
            JSONArray stopped = rpc.tellStopped(0, 100, Aria2Rpc.POLL_KEYS);

            int activeCount = active.length();
            int waitingRunnable = 0; // queued (not paused) — keeps the poller alive

            for (int i = 0; i < active.length(); i++) {
                JSONObject o = active.optJSONObject(i);
                if (o == null) continue;
                String gid = o.optString("gid", "");
                JSONObject meta = store.get(gid);
                if (meta == null) continue;
                if (pausing.contains(gid)) continue; // pause requested — suppress decaying-speed progress
                if (!"running".equals(meta.optString("status")) || meta.optLong("bytesTotal", 0) == 0) {
                    store.patch(gid, map("status", "running", "bytesTotal", o.optLong("totalLength", 0)));
                    meta = store.get(gid);
                }
                emit("downloadProgress", meta, o);
                renderNotif(gid, meta, o, "running");
            }

            for (int i = 0; i < waiting.length(); i++) {
                JSONObject o = waiting.optJSONObject(i);
                if (o == null) continue;
                String gid = o.optString("gid", "");
                pausing.remove(gid); // no longer actively downloading
                String js = mapAriaStatus(o.optString("status", "waiting"));
                if ("pending".equals(js)) waitingRunnable++;
                JSONObject meta = store.get(gid);
                if (meta == null) continue;
                if (!js.equals(meta.optString("status"))) {
                    store.patch(gid, map("status", js, "bytesTotal", o.optLong("totalLength", 0)));
                    meta = store.get(gid);
                    emit("downloadStateChanged", meta, o);
                }
                if ("paused".equals(js)) renderNotif(gid, meta, o, "paused");
                else DownloadNotifier.cancel(getContext(), gid); // queued → no ongoing notification
            }

            for (int i = 0; i < stopped.length(); i++) {
                JSONObject o = stopped.optJSONObject(i);
                if (o == null) continue;
                String gid = o.optString("gid", "");
                pausing.remove(gid);
                JSONObject meta = store.get(gid);
                if (meta == null || isTerminal(meta.optString("status", ""))) continue;
                String ast = o.optString("status", "");
                if ("complete".equals(ast))      finalizeComplete(gid, o);
                else if ("error".equals(ast))    finalizeError(gid, o);
                else if ("removed".equals(ast))  finalizeRemoved(gid);
            }

            // Foreground service reflects only actively-downloading items.
            if (activeCount > 0) DownloadForegroundService.updateCount(getContext(), activeCount);
            else if (DownloadForegroundService.isRunning()) DownloadForegroundService.stop(getContext());

            // Stop polling when nothing is downloading or queued to run (paused items don't
            // change on their own; resume / network callbacks restart polling).
            if (activeCount + waitingRunnable == 0) stopPolling();
        } catch (Throwable t) {
            android.util.Log.w(TAG, "poll tick failed: " + t.getMessage());
        }
    }

    /** Build/refresh a per-download progress notification from a live aria2 status object. */
    private void renderNotif(String gid, JSONObject meta, JSONObject o, String status) {
        long total = o.optLong("totalLength", 0);
        long done  = o.optLong("completedLength", 0);
        long speed = o.optLong("downloadSpeed", 0);
        int progress = total > 0 ? (int) Math.min(100, done * 100 / total) : 0;
        String title = meta.optString("title", meta.optString("fileName", "Download"));
        DownloadNotifier.showProgress(getContext(), gid, title, status, progress, speed, done, total);
    }

    // ─── completion / publishing ────────────────────────────────────────────

    private void finalizeComplete(String gid, JSONObject live) {
        JSONObject meta = store.get(gid);
        if (meta == null) return;
        String fileName = meta.optString("fileName", "download");
        String mime     = meta.optString("mimeType", guessMime(fileName));
        String path     = meta.optString("path", new File(downloadDir, fileName).getAbsolutePath());
        long total = live.optLong("totalLength", meta.optLong("bytesTotal", 0));

        // aria2 wrote straight into the public Download/DB-World folder — NO copy. Mark complete now
        // (file:// is playable via all-files-access), then index it into MediaStore and upgrade
        // localUri to the content:// URI so it shows in the Files app / other players.
        store.patch(gid, map("status", "success", "localUri", "file://" + path, "bytesTotal", total));
        try { daemon.rpc().removeDownloadResult(gid); } catch (Exception ignored) {}

        JSONObject fresh = store.get(gid);
        if (fresh != null) {
            emit("downloadComplete", fresh, null);
            emit("downloadStateChanged", fresh, null);
        }
        DownloadNotifier.showComplete(getContext(), gid, meta.optString("title", fileName));

        try {
            MediaScannerConnection.scanFile(getContext(), new String[]{ path }, new String[]{ mime },
                (scannedPath, uri) -> {
                    if (uri != null) {
                        store.patch(gid, map("localUri", uri.toString()));
                        JSONObject m2 = store.get(gid);
                        if (m2 != null) emit("downloadStateChanged", m2, null);
                    }
                });
        } catch (Exception e) {
            android.util.Log.w(TAG, "media scan failed: " + e.getMessage());
        }
    }

    private void finalizeError(String gid, JSONObject live) {
        store.patch(gid, map("status", "failed", "errorMessage", live.optString("errorMessage", "")));
        try { daemon.rpc().removeDownloadResult(gid); } catch (Exception ignored) {}
        JSONObject m = store.get(gid);
        if (m != null) {
            emit("downloadError", m, null);
            DownloadNotifier.showError(getContext(), gid, m.optString("title", m.optString("fileName", "Download")));
        }
    }

    private void finalizeRemoved(String gid) {
        store.patch(gid, map("status", "cancelled"));
        try { daemon.rpc().removeDownloadResult(gid); } catch (Exception ignored) {}
        DownloadNotifier.cancel(getContext(), gid);
        JSONObject m = store.get(gid);
        if (m != null) emit("downloadStateChanged", m, null);
    }

    // ─── startup reconcile (re-link session ↔ metadata) ─────────────────────────

    /**
     * After aria2 reloads its saved session, re-link each reloaded download to our stored
     * metadata by on-disk path — robust whether or not aria2 preserved the original gid.
     */
    private void reconcileOnStartup() throws IOException {
        Aria2Rpc rpc = daemon.rpc();
        reconcileList(rpc.tellActive(Aria2Rpc.FULL_KEYS));
        reconcileList(rpc.tellWaiting(0, 1000, Aria2Rpc.FULL_KEYS));
    }

    private void reconcileList(JSONArray arr) {
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            String gid  = o.optString("gid", "");
            String path = firstFilePath(o);
            if (path == null || path.isEmpty()) continue;
            String storedGid = store.gidForPath(path);
            if (storedGid != null && !storedGid.equals(gid)) {
                store.rekey(storedGid, gid);
            } else if (storedGid == null && store.get(gid) == null) {
                // Orphan from the session with no metadata — synthesize a minimal record.
                try {
                    JSONObject meta = new JSONObject();
                    String fileName = new File(path).getName();
                    meta.put("gid", gid);
                    meta.put("fileName", fileName);
                    meta.put("title", fileName);
                    meta.put("path", path);
                    meta.put("dir", downloadDir.getAbsolutePath());
                    meta.put("mimeType", guessMime(fileName));
                    meta.put("status", mapAriaStatus(o.optString("status", "waiting")));
                    meta.put("bytesTotal", o.optLong("totalLength", 0));
                    meta.put("localUri", "");
                    meta.put("addedAt", System.currentTimeMillis());
                    meta.put("url", firstUri(o));
                    store.upsert(gid, meta);
                } catch (Exception ignored) {}
            }
        }
    }

    // ─── DTO / events ────────────────────────────────────────────────────────

    private JSObject toDto(JSONObject meta, JSONObject live) {
        String gid;
        String status;
        long completed, total, speed;
        if (live != null) {
            gid    = live.optString("gid", meta.optString("gid", ""));
            status = mapAriaStatus(live.optString("status", meta.optString("status", "pending")));
            total     = live.optLong("totalLength", meta.optLong("bytesTotal", 0));
            completed = live.optLong("completedLength", 0);
            speed     = live.optLong("downloadSpeed", 0);
        } else {
            gid    = meta.optString("gid", "");
            status = meta.optString("status", "pending");
            total     = meta.optLong("bytesTotal", 0);
            completed = "success".equals(status) ? total : 0;
            speed     = 0;
        }
        int progress = total > 0 ? (int) Math.min(100, completed * 100 / total)
                                 : ("success".equals(status) ? 100 : 0);
        long eta = (speed > 0 && total > completed) ? (total - completed) / speed : -1;
        String localUri = meta.optString("localUri", "");
        boolean done = "success".equals(status);
        int connections = live != null ? live.optInt("connections", 0) : 0;

        JSObject o = new JSObject();
        o.put("downloadId",       gid);
        o.put("title",            meta.optString("title", meta.optString("fileName", "Download")));
        o.put("fileName",         meta.optString("fileName", "download"));
        o.put("status",           status);
        o.put("progress",         progress);
        o.put("bytesDownloaded",  completed);
        o.put("bytesTotal",       total);
        o.put("speedBytesPerSec", speed);
        o.put("etaSeconds",       eta);
        o.put("localUri",         localUri);
        o.put("playableUri",      localUri);
        o.put("mimeType",         meta.optString("mimeType", ""));
        o.put("thumbnailUrl",     meta.optString("thumbnailUrl", ""));
        o.put("mediaFileId",      meta.optString("mediaFileId", ""));
        o.put("recordId",         meta.optString("recordId", ""));
        o.put("requestId",        meta.optString("requestId", ""));
        o.put("connections",      connections);
        o.put("canPlay",          done && !localUri.isEmpty());
        return o;
    }

    private void emit(String event, JSONObject meta, JSONObject live) {
        notifyListeners(event, toDto(meta, live));
    }

    private void emitRemoved(String gid) {
        JSObject o = new JSObject();
        o.put("downloadId", gid);
        notifyListeners("downloadRemoved", o);
    }

    private static String mapAriaStatus(String s) {
        if (s == null) return "pending";
        switch (s) {
            case "active":   return "running";
            case "waiting":  return "pending";
            case "paused":   return "paused";
            case "complete": return "success";
            case "error":    return "failed";
            case "removed":  return "cancelled";
            default:         return "pending";
        }
    }

    private static boolean isTerminal(String jsStatus) {
        return "success".equals(jsStatus) || "failed".equals(jsStatus) || "cancelled".equals(jsStatus);
    }

    // ─── foreground service ─────────────────────────────────────────────────

    /** Start the FGS from a context we believe is foreground; never let it crash the caller. */
    private void startForegroundServiceSafe(int count) {
        try {
            DownloadForegroundService.start(getContext(), count);
        } catch (Exception e) {
            android.util.Log.w(TAG, "could not start foreground service: " + e.getMessage());
        }
    }

    // ─── network policy (wifi-only) ─────────────────────────────────────────

    private void registerNetworkCallback() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return; // registerDefaultNetworkCallback: API 24+
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return;
            netCallback = new ConnectivityManager.NetworkCallback() {
                @Override public void onAvailable(@NonNull Network n) { applyWifiPolicy(); }
                @Override public void onLost(@NonNull Network n)      { applyWifiPolicy(); }
                @Override public void onCapabilitiesChanged(@NonNull Network n, @NonNull NetworkCapabilities c) { applyWifiPolicy(); }
            };
            cm.registerDefaultNetworkCallback(netCallback);
        } catch (Exception e) {
            android.util.Log.w(TAG, "network callback registration failed: " + e.getMessage());
        }
    }

    private void unregisterNetworkCallback() {
        if (netCallback == null) return;
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) cm.unregisterNetworkCallback(netCallback);
        } catch (Exception ignored) {}
        netCallback = null;
    }

    /** When wifi-only is on: pause on metered/lost networks, resume on an unmetered (wifi) one. */
    private void applyWifiPolicy() {
        if (!isWifiOnly()) return;
        runIo(() -> {
            try {
                if (daemon == null || !daemon.isRunning()) return;
                if (isUnmetered()) { daemon.rpc().unpauseAll(); startPolling(); }
                else               { daemon.rpc().pauseAll(); }
            } catch (Exception ignored) {}
        });
    }

    private boolean isUnmetered() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            Network n = cm.getActiveNetwork();
            if (n == null) return false;
            NetworkCapabilities c = cm.getNetworkCapabilities(n);
            return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
        } catch (Exception e) {
            return true; // fail open — don't wedge downloads if we can't tell
        }
    }

    // ─── queries / helpers ──────────────────────────────────────────────────

    private Map<String, JSONObject> liveStatuses() throws IOException {
        Map<String, JSONObject> m = new HashMap<>();
        Aria2Rpc rpc = daemon.rpc();
        collect(m, rpc.tellActive(Aria2Rpc.POLL_KEYS));
        collect(m, rpc.tellWaiting(0, 1000, Aria2Rpc.POLL_KEYS));
        collect(m, rpc.tellStopped(0, 1000, Aria2Rpc.POLL_KEYS));
        return m;
    }

    private static void collect(Map<String, JSONObject> m, JSONArray a) {
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o == null) continue;
            String gid = o.optString("gid", null);
            if (gid != null) m.put(gid, o);
        }
    }

    private static String firstFilePath(JSONObject status) {
        JSONArray files = status.optJSONArray("files");
        if (files == null || files.length() == 0) return null;
        JSONObject f = files.optJSONObject(0);
        return f == null ? null : f.optString("path", null);
    }

    private static String firstUri(JSONObject status) {
        JSONArray files = status.optJSONArray("files");
        if (files == null || files.length() == 0) return "";
        JSONObject f = files.optJSONObject(0);
        if (f == null) return "";
        JSONArray uris = f.optJSONArray("uris");
        if (uris == null || uris.length() == 0) return "";
        JSONObject u = uris.optJSONObject(0);
        return u == null ? "" : u.optString("uri", "");
    }

    private interface GidAction { void run(String gid) throws Exception; }

    /** Runs an aria2 action for the call's downloadId on the io thread, then resolves. */
    private void withGid(PluginCall call, GidAction action) {
        final String gid = call.getString("downloadId");
        if (gid == null) { call.reject("downloadId required"); return; }
        if (daemon == null) { call.reject(initError != null ? initError : "Download engine unavailable"); return; }
        runIo(() -> {
            try {
                action.run(gid);
                call.resolve();
            } catch (Exception e) {
                android.util.Log.e(TAG, "action failed for " + gid + ": " + e.getMessage(), e);
                call.reject("Action failed: " + e.getMessage());
            }
        });
    }

    private void runIo(Runnable r) { ioExecutor.execute(r); }

    private static Map<String, Object> map(Object... kv) {
        HashMap<String, Object> m = new HashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    private static String orEmpty(String s) { return s == null ? "" : s; }

    /** App-private external dir on API 29+, public Downloads/DB-World on API ≤ 28. */
    /** Public Downloads/DB-World for all API levels (All-files-access on 30+, legacy on ≤29). */
    private File downloadDir() {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                MediaStorePublisher.SUBDIR);
        if (!dir.exists()) //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        return dir;
    }

    private boolean publishedFileExists(JSONObject meta) {
        String localUri = meta.optString("localUri", "");
        if (localUri.isEmpty()) return true; // not yet published — keep it
        if (localUri.startsWith("content://")) {
            try (android.os.ParcelFileDescriptor pfd =
                         getContext().getContentResolver().openFileDescriptor(Uri.parse(localUri), "r")) {
                return pfd != null;
            } catch (Exception e) {
                return false;
            }
        }
        return new File(localUri.replace("file://", "")).exists();
    }

    private String getOrCreateSecret() {
        SharedPreferences p = prefs();
        String s = p.getString(PREF_SECRET, null);
        if (s == null || s.isEmpty()) {
            byte[] b = new byte[16];
            new SecureRandom().nextBytes(b);
            StringBuilder sb = new StringBuilder();
            for (byte x : b) sb.append(String.format("%02x", x));
            s = sb.toString();
            p.edit().putString(PREF_SECRET, s).apply();
        }
        return s;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean isWifiOnly() { return prefs().getBoolean(PREF_WIFI_ONLY, false); }

    private int concurrentLimit() {
        int n = prefs().getInt(PREF_CONCURRENT, DEFAULT_CONCURRENT);
        return Math.max(1, Math.min(MAX_CONCURRENT, n));
    }

    private static String guessMime(String fileName) {
        String f = fileName.toLowerCase();
        if (f.endsWith(".mp4"))  return "video/mp4";
        if (f.endsWith(".mkv"))  return "video/x-matroska";
        if (f.endsWith(".webm")) return "video/webm";
        if (f.endsWith(".avi"))  return "video/x-msvideo";
        if (f.endsWith(".mov"))  return "video/quicktime";
        if (f.endsWith(".m4v"))  return "video/x-m4v";
        if (f.endsWith(".mp3"))  return "audio/mpeg";
        if (f.endsWith(".m4a"))  return "audio/mp4";
        return "application/octet-stream";
    }
}
