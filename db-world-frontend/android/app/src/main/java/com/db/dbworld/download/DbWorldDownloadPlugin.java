package com.db.dbworld.download;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.db.dbworld.MainActivity;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.tonyodev.fetch2.AbstractFetchListener;
import com.tonyodev.fetch2.DefaultFetchNotificationManager;
import com.tonyodev.fetch2.Download;
import com.tonyodev.fetch2.DownloadNotification;
import com.tonyodev.fetch2.EnqueueAction;
import com.tonyodev.fetch2.Error;
import com.tonyodev.fetch2.Fetch;
import com.tonyodev.fetch2.FetchConfiguration;
import com.tonyodev.fetch2.NetworkType;
import com.tonyodev.fetch2.Priority;
import com.tonyodev.fetch2.Request;
import com.tonyodev.fetch2.Status;
import com.tonyodev.fetch2core.Extras;
import com.tonyodev.fetch2okhttp.OkHttpDownloader;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.OkHttpClient;

/**
 * DbWorldDownload — production download manager backed by Fetch2.
 *
 * Fetch2 owns persistence (its SQLite DB), HTTP-Range resume, the queue,
 * concurrency, auto-retry and network-aware auto-resume. This plugin adds the
 * Capacitor bridge, a foreground service for process survival, MediaStore
 * publishing (so finished files are visible in the phone's Downloads), and
 * carries app metadata (title, thumbnail, mediaFileId…) in each download's
 * Fetch "extras" so it all survives a restart.
 *
 * JS status vocabulary (kept compatible with the existing UI):
 *   pending · running · paused · success · failed · cancelled
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
    private static final String NAMESPACE          = "dbworld_downloads";
    private static final int    DEFAULT_CONCURRENT = 1;   // download one at a time by default
    private static final int    MAX_CONCURRENT     = 3;   // user may raise to at most 3 parallel
    private static final String PREF_CONCURRENT     = "concurrent_limit";
    private static final int    AUTO_RETRY_MAX     = 3;
    public  static final String PREFS             = "dbworld_downloads_prefs";
    private static final String PREF_WIFI_ONLY    = "wifi_only";
    public  static final String PREF_PENDING_ROUTE = "pending_route";
    private static final String ACTION_NOTIF      = "com.db.dbworld.DOWNLOAD_NOTIF_ACTION";

    private Fetch fetch;
    private volatile String initError = null; // set if Fetch2 failed to initialize in load()

    /** Handles pause/resume/cancel/delete/retry taps from the download notification buttons. */
    private final BroadcastReceiver notifActionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (fetch == null || intent == null) return;
            int id = intent.getIntExtra("downloadId", -1);
            String action = intent.getStringExtra("action");
            if (id < 0 || action == null) return;
            switch (action) {
                case "PAUSE":  fetch.pause(id);  break;
                case "RESUME": fetch.resume(id); break;
                case "CANCEL": fetch.cancel(id); break;
                case "DELETE": fetch.delete(id); break;
                case "RETRY":  fetch.retry(id);  break;
                default: break; // group _ALL actions etc. — ignored
            }
        }
    };
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();

    // Live speed/ETA per download id — only known during onProgress.
    private final Map<Integer, long[]> liveStats = new ConcurrentHashMap<>(); // id -> [bytesPerSec, etaSeconds]

    // ─── lifecycle ──────────────────────────────────────────────────────────

    @Override
    public void load() {
        super.load();
        android.util.Log.e(TAG, "BUILD_MARKER=notif-v4 load() starting");
        // Receiver for notification action buttons (SDK-34-safe registration).
        ContextCompat.registerReceiver(getContext(), notifActionReceiver,
                new IntentFilter(ACTION_NOTIF), ContextCompat.RECEIVER_NOT_EXPORTED);
        // IMPORTANT: never let initialization throw out of load(). If it does,
        // Capacitor drops the plugin registration and every call fails with the
        // opaque "plugin is not implemented on android". On failure we keep the
        // plugin registered and surface the real reason via initError.
        try {
            // Tuned for large media over flaky CDNs: generous read timeout (slow first
            // byte after a Range resume), no overall call timeout (multi-GB files),
            // automatic retry of dropped connections, and a warm connection pool so a
            // resume reuses the existing socket instead of re-handshaking.
            OkHttpClient client = new OkHttpClient.Builder()
                    .followRedirects(true)
                    .followSslRedirects(true)
                    .retryOnConnectionFailure(true)
                    .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
                    .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                    .callTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS)
                    .connectionPool(new okhttp3.ConnectionPool(8, 5, java.util.concurrent.TimeUnit.MINUTES))
                    .build();

            // The wrapped context makes Fetch's internal registerReceiver calls
            // (connectivity receiver + notification manager) pass RECEIVER_NOT_EXPORTED,
            // which is required on targetSdk 34+.
            Context fetchContext = receiverFlagSafeContext(getContext());

            FetchConfiguration config = new FetchConfiguration.Builder(fetchContext)
                    .setNamespace(NAMESPACE)
                    .setDownloadConcurrentLimit(concurrentLimit())
                    .setHttpDownloader(new OkHttpDownloader(client))
                    .enableRetryOnNetworkGain(true)          // auto-resume on reconnect
                    .setAutoRetryMaxAttempts(AUTO_RETRY_MAX) // retry transient failures
                    // Don't fallocate the full file up front — on FUSE storage a multi-GB
                    // preallocation stalls the visible "start" of every download/resume.
                    .preAllocateFileOnCreation(false)
                    .setProgressReportingInterval(1000)      // snappier progress UI
                    // Rich per-download notification: live progress, pause/resume/cancel
                    // buttons, and an auto completion notification. SDK-34-safe via the
                    // wrapped context above.
                    .setNotificationManager(new DbWorldNotificationManager(fetchContext))
                    .build();

            fetch = Fetch.Impl.getInstance(config);
            fetch.setGlobalNetworkType(isWifiOnly() ? NetworkType.WIFI_ONLY : NetworkType.ALL);
            fetch.addListener(listener);

            // Recover from a process kill (e.g. the user swiped the app away): Fetch
            // persists each download, but anything that was mid-flight stays parked.
            // Re-drive DOWNLOADING/QUEUED entries so a relaunch continues from the
            // partial file via HTTP Range instead of silently stalling.
            fetch.getDownloads(downloads -> {
                for (Download d : downloads) {
                    Status s = d.getStatus();
                    if (s == Status.DOWNLOADING || s == Status.QUEUED) {
                        fetch.resume(d.getId());
                    }
                }
                refreshForegroundState();
            });
            android.util.Log.d(TAG, "plugin loaded (Fetch2 mode)");
        } catch (Throwable t) {
            initError = t.getClass().getSimpleName() + ": " + t.getMessage();
            android.util.Log.e(TAG, "Fetch2 init failed in load(): " + initError, t);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (fetch != null) {
            fetch.removeListener(listener);
            // Don't fetch.close(): downloads should keep running via the service.
        }
        try { getContext().unregisterReceiver(notifActionReceiver); } catch (Exception ignored) {}
        super.handleOnDestroy();
    }

    // ─── permissions ──────────────────────────────────────────────────────────

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
        call.resolve();
    }

    // ─── startDownload ──────────────────────────────────────────────────────

    @PluginMethod
    public void startDownload(PluginCall call) {
        if (!fetchReady(call)) return;
        final String url      = call.getString("url");
        String fileNameArg    = call.getString("fileName", "download");
        final String title    = call.getString("title", fileNameArg);
        final String thumb    = call.getString("thumbnailUrl", "");
        final String mediaId  = call.getString("mediaFileId", "");
        final String recordId = call.getString("recordId", "");
        final String mimeArg  = call.getString("mimeType", "");

        if (url == null || url.isEmpty()) { call.reject("URL is required"); return; }
        final String fileName = (fileNameArg == null || fileNameArg.isEmpty()) ? "download" : fileNameArg;
        final String mime     = (mimeArg == null || mimeArg.isEmpty()) ? guessMime(fileName) : mimeArg;

        // Dedup against existing downloads (async), then enqueue inside the callback.
        fetch.getDownloads(downloads -> {
            for (Download d : downloads) {
                if (!fileName.equals(extra(d, "fileName", ""))) continue;
                Status s = d.getStatus();
                if (s == Status.COMPLETED) {
                    JSObject r = new JSObject();
                    r.put("downloadId", String.valueOf(d.getId()));
                    r.put("queued", false);
                    r.put("alreadyDownloaded", true);
                    call.resolve(r);
                    return;
                }
                if (s == Status.DOWNLOADING || s == Status.QUEUED || s == Status.PAUSED || s == Status.ADDED) {
                    JSObject r = new JSObject();
                    r.put("downloadId", String.valueOf(d.getId()));
                    r.put("queued", s == Status.QUEUED || s == Status.ADDED);
                    r.put("alreadyActive", true);
                    call.resolve(r);
                    return;
                }
            }
            enqueueNew(call, url, fileName, title, thumb, mediaId, recordId, mime);
        });
    }

    private void enqueueNew(PluginCall call, String url, String fileName, String title,
                            String thumb, String mediaId, String recordId, String mime) {
        File target = new File(downloadDir(), fileName);

        Request request = new Request(url, target.getAbsolutePath());
        request.setPriority(Priority.NORMAL);
        request.setNetworkType(isWifiOnly() ? NetworkType.WIFI_ONLY : NetworkType.ALL);
        request.setEnqueueAction(EnqueueAction.REPLACE_EXISTING);
        request.addHeader("User-Agent", "DbWorld-Android/2.0");

        Map<String, String> map = new HashMap<>();
        map.put("title", title);
        map.put("fileName", fileName);
        map.put("thumbnailUrl", thumb != null ? thumb : "");
        map.put("mediaFileId", mediaId != null ? mediaId : "");
        map.put("recordId", recordId != null ? recordId : "");
        map.put("mimeType", mime != null ? mime : "");
        map.put("localUri", "");
        request.setExtras(new Extras(map));

        fetch.enqueue(request,
                updated -> {
                    refreshForegroundState();
                    JSObject r = new JSObject();
                    r.put("downloadId", String.valueOf(updated.getId()));
                    r.put("queued", true);
                    call.resolve(r);
                },
                error -> {
                    android.util.Log.e(TAG, "enqueue failed: " + error);
                    call.reject("enqueue failed: " + error.toString());
                });
    }

    // ─── queue actions ──────────────────────────────────────────────────────

    @PluginMethod
    public void pauseDownload(PluginCall call)  { withId(call, id -> fetch.pause(id)); }

    @PluginMethod
    public void resumeDownload(PluginCall call) { withId(call, id -> fetch.resume(id)); }

    @PluginMethod
    public void retryDownload(PluginCall call) {
        if (!fetchReady(call)) return;
        Integer id = parseId(call);
        if (id == null) return;
        fetch.retry(id);
        JSObject r = new JSObject();
        r.put("downloadId", String.valueOf(id));
        call.resolve(r);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        // Stop but keep a CANCELLED record so the user can redownload it.
        withId(call, id -> fetch.cancel(id));
    }

    @PluginMethod
    public void deleteDownload(PluginCall call) {
        if (!fetchReady(call)) return;
        Integer id = parseId(call);
        if (id == null) return;
        // Remove the published file (MediaStore/public) first, then the Fetch record
        // (which also removes any partial file Fetch still manages).
        fetch.getDownload(id, download -> {
            if (download != null) {
                String localUri = extra(download, "localUri", "");
                ioExecutor.execute(() -> MediaStorePublisher.delete(getContext(), localUri));
            }
            fetch.delete(id);
            refreshForegroundState();
            call.resolve();
        });
    }

    @PluginMethod
    public void setNetworkPolicy(PluginCall call) {
        boolean wifiOnly = Boolean.TRUE.equals(call.getBoolean("wifiOnly", false));
        prefs().edit().putBoolean(PREF_WIFI_ONLY, wifiOnly).apply();
        if (fetch != null) {
            fetch.setGlobalNetworkType(wifiOnly ? NetworkType.WIFI_ONLY : NetworkType.ALL);
        }
        call.resolve();
    }

    @PluginMethod
    public void getSettings(PluginCall call) {
        JSObject r = new JSObject();
        r.put("wifiOnly", isWifiOnly());
        r.put("concurrentLimit", concurrentLimit());
        r.put("maxConcurrentLimit", MAX_CONCURRENT);
        call.resolve(r);
    }

    /** Sets how many downloads run in parallel (clamped 1..MAX). Applied live to the queue. */
    @PluginMethod
    public void setConcurrentLimit(PluginCall call) {
        Integer limit = call.getInt("limit");
        if (limit == null) { call.reject("limit required"); return; }
        int n = Math.max(1, Math.min(MAX_CONCURRENT, limit));
        prefs().edit().putInt(PREF_CONCURRENT, n).apply();
        if (fetch != null) fetch.setDownloadConcurrentLimit(n);
        JSObject r = new JSObject();
        r.put("concurrentLimit", n);
        call.resolve(r);
    }

    /**
     * Returns (and clears) a one-shot route requested by a notification tap. The SPA
     * calls this on mount and on resume, so navigation is driven by the web app pulling
     * the intent when it's actually ready — no fragile WebView eval timing.
     */
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
        if (!fetchReady(call)) return;
        fetch.getDownloads(downloads -> {
            JSArray list = new JSArray();
            for (Download d : downloads) {
                // Hide removed/deleted ghosts and orphaned completed entries whose
                // published file no longer exists.
                if (d.getStatus() == Status.REMOVED || d.getStatus() == Status.DELETED) continue;
                if (d.getStatus() == Status.COMPLETED && !publishedFileExists(d)) continue;
                list.put(toJS(d));
            }
            JSObject r = new JSObject();
            r.put("downloads", list);
            call.resolve(r);
        });
    }

    // ─── Fetch listener ───────────────────────────────────────────────────────

    private final AbstractFetchListener listener = new AbstractFetchListener() {
        @Override public void onAdded(@NonNull Download d) { emit("downloadAdded", d); }

        @Override public void onQueued(@NonNull Download d, boolean waitingOnNetwork) {
            refreshForegroundState();
            emit("downloadStateChanged", d);
        }

        @Override public void onProgress(@NonNull Download d, long etaMs, long bytesPerSec) {
            liveStats.put(d.getId(), new long[]{ Math.max(0, bytesPerSec),
                    etaMs > 0 ? etaMs / 1000 : -1 });
            emit("downloadProgress", d);
        }

        @Override public void onPaused(@NonNull Download d)  { refreshForegroundState(); emit("downloadStateChanged", d); }
        @Override public void onResumed(@NonNull Download d) { refreshForegroundState(); emit("downloadStateChanged", d); }

        @Override public void onCancelled(@NonNull Download d) {
            liveStats.remove(d.getId());
            refreshForegroundState();
            emit("downloadStateChanged", d);
        }

        @Override public void onRemoved(@NonNull Download d) { liveStats.remove(d.getId()); emit("downloadRemoved", d); }
        @Override public void onDeleted(@NonNull Download d) { liveStats.remove(d.getId()); emit("downloadRemoved", d); }

        @Override public void onError(@NonNull Download d, @NonNull Error error, Throwable throwable) {
            android.util.Log.e(TAG, "download error id=" + d.getId() + " err=" + error);
            liveStats.remove(d.getId());
            refreshForegroundState();
            emit("downloadError", d);
        }

        @Override public void onCompleted(@NonNull Download d) {
            liveStats.remove(d.getId());
            // Publish off the main thread, then update extras + notify JS.
            ioExecutor.execute(() -> publishAndComplete(d));
        }
    };

    // ─── completion / publishing ────────────────────────────────────────────

    private void publishAndComplete(Download d) {
        String fileName = extra(d, "fileName", new File(d.getFile()).getName());
        String mime     = extra(d, "mimeType", guessMime(fileName));
        File downloaded = new File(d.getFile());

        String localUri;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Uri published = MediaStorePublisher.publish(getContext(), downloaded, fileName, mime);
                //noinspection ResultOfMethodCallIgnored
                downloaded.delete(); // move: drop the app-private copy
                localUri = published.toString();
            } else {
                // API ≤ 28: Fetch already wrote to public Downloads/DB-World.
                localUri = "file://" + downloaded.getAbsolutePath();
            }
        } catch (Exception e) {
            android.util.Log.e(TAG, "publish failed, keeping private file: " + e.getMessage(), e);
            localUri = "file://" + downloaded.getAbsolutePath();
        }

        Map<String, String> map = new HashMap<>(d.getExtras().getMap());
        map.put("localUri", localUri);
        final String finalUri = localUri;
        fetch.replaceExtras(d.getId(), new Extras(map),
                updated -> {
                    refreshForegroundState();
                    emit("downloadComplete", updated);
                    emit("downloadStateChanged", updated);
                },
                error -> {
                    // Even if extras update fails, surface completion with the URI we have.
                    refreshForegroundState();
                    JSObject obj = toJS(d);
                    obj.put("localUri", finalUri);
                    obj.put("playableUri", finalUri);
                    obj.put("canPlay", true);
                    obj.put("status", "success");
                    obj.put("progress", 100);
                    notifyListeners("downloadComplete", obj);
                });
    }

    // ─── foreground service sync ──────────────────────────────────────────────

    private void refreshForegroundState() {
        if (fetch == null) return;
        fetch.getDownloads(downloads -> {
            int active = 0;
            for (Download d : downloads) {
                if (d.getStatus() == Status.DOWNLOADING || d.getStatus() == Status.QUEUED) active++;
            }
            if (active > 0) {
                try {
                    // Android 12+ forbids starting a foreground service from the
                    // background (e.g. an auto-resume on reconnect). Fetch keeps
                    // downloading regardless; the service is best-effort.
                    DownloadForegroundService.start(getContext(), active);
                } catch (Exception e) {
                    android.util.Log.w(TAG, "could not start foreground service: " + e.getMessage());
                }
            } else if (DownloadForegroundService.isRunning()) {
                DownloadForegroundService.stop(getContext());
            }
        });
    }

    // ─── DTO mapping ────────────────────────────────────────────────────────

    private JSObject toJS(Download d) {
        JSObject o = new JSObject();
        String status   = mapStatus(d.getStatus());
        String localUri = extra(d, "localUri", "");
        boolean done    = d.getStatus() == Status.COMPLETED;

        long[] stats = liveStats.get(d.getId());
        long speed = stats != null ? stats[0] : 0;
        long eta   = stats != null ? stats[1] : -1;

        o.put("downloadId",      String.valueOf(d.getId()));
        o.put("title",           extra(d, "title", extra(d, "fileName", "Download")));
        o.put("fileName",        extra(d, "fileName", new File(d.getFile()).getName()));
        o.put("status",          status);
        o.put("progress",        Math.max(0, d.getProgress()));
        o.put("bytesDownloaded", d.getDownloaded());
        o.put("bytesTotal",      d.getTotal());
        o.put("speedBytesPerSec", speed);
        o.put("etaSeconds",       eta);
        o.put("localUri",        localUri);
        o.put("playableUri",     localUri);
        o.put("mimeType",        extra(d, "mimeType", ""));
        o.put("thumbnailUrl",    extra(d, "thumbnailUrl", ""));
        o.put("mediaFileId",     extra(d, "mediaFileId", ""));
        o.put("recordId",        extra(d, "recordId", ""));
        o.put("canPlay",         done && !localUri.isEmpty());
        return o;
    }

    private void emit(String event, Download d) {
        notifyListeners(event, toJS(d));
    }

    private static String mapStatus(Status s) {
        switch (s) {
            case QUEUED:
            case ADDED:        return "pending";
            case DOWNLOADING:  return "running";
            case PAUSED:       return "paused";
            case COMPLETED:    return "success";
            case FAILED:       return "failed";
            case CANCELLED:
            case REMOVED:
            case DELETED:      return "cancelled";
            default:           return "pending";
        }
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    /** App-private external dir on API 29+, public Downloads/DB-World on API ≤ 28. */
    private File downloadDir() {
        File dir;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                    MediaStorePublisher.SUBDIR);
        } else {
            dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    MediaStorePublisher.SUBDIR);
        }
        if (!dir.exists()) //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        return dir;
    }

    private boolean publishedFileExists(Download d) {
        String localUri = extra(d, "localUri", "");
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

    private static String extra(Download d, String key, String def) {
        try {
            return d.getExtras().getString(key, def);
        } catch (Exception e) {
            return def;
        }
    }

    /** Rejects the call with the real reason if Fetch failed to initialize. */
    private boolean fetchReady(PluginCall call) {
        if (fetch == null) {
            call.reject("Download engine unavailable: "
                    + (initError != null ? initError : "not initialized"));
            return false;
        }
        return true;
    }

    private interface IdAction { void run(int id); }

    private void withId(PluginCall call, IdAction action) {
        if (!fetchReady(call)) return;
        Integer id = parseId(call);
        if (id == null) return;
        action.run(id);
        call.resolve();
    }

    private Integer parseId(PluginCall call) {
        String idStr = call.getString("downloadId");
        if (idStr == null) { call.reject("downloadId required"); return null; }
        try {
            return Integer.parseInt(idStr);
        } catch (NumberFormatException e) {
            call.reject("invalid downloadId: " + idStr);
            return null;
        }
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean isWifiOnly() {
        return prefs().getBoolean(PREF_WIFI_ONLY, false);
    }

    /** Persisted parallel-download limit, clamped to a safe 1..MAX range. */
    private int concurrentLimit() {
        int n = prefs().getInt(PREF_CONCURRENT, DEFAULT_CONCURRENT);
        return Math.max(1, Math.min(MAX_CONCURRENT, n));
    }

    /**
     * Wraps the context so every {@code registerReceiver(receiver, filter)} Fetch makes
     * internally (e.g. its connectivity receiver in PriorityListProcessorImpl) is forced to
     * pass RECEIVER_NOT_EXPORTED on Android 13+. Without this, Fetch 3.1.6 crashes on
     * targetSdk 34+ with a SecurityException. getApplicationContext() is overridden to return
     * the wrapper so Fetch's app-context-based registrations are also intercepted.
     */
    private Context receiverFlagSafeContext(Context base) {
        return new ContextWrapper(base.getApplicationContext()) {
            @Override
            public Context getApplicationContext() {
                return this;
            }

            @Override
            public Intent registerReceiver(BroadcastReceiver receiver, IntentFilter filter) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    return super.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
                }
                return super.registerReceiver(receiver, filter);
            }

            @Override
            public Intent registerReceiver(BroadcastReceiver receiver, IntentFilter filter,
                                           String broadcastPermission, android.os.Handler scheduler) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    return super.registerReceiver(receiver, filter, broadcastPermission, scheduler,
                            Context.RECEIVER_NOT_EXPORTED);
                }
                return super.registerReceiver(receiver, filter, broadcastPermission, scheduler);
            }
        };
    }

    /**
     * Fetch's built-in notification manager (live progress + pause/resume/cancel/retry
     * buttons + auto completion notification). We subclass it only to point it at our
     * Fetch instance and to make tapping the notification open the Downloads page.
     * Constructed with the receiver-flag-safe context so it doesn't crash on SDK 34+.
     */
    private class DbWorldNotificationManager extends DefaultFetchNotificationManager {
        DbWorldNotificationManager(Context context) {
            super(context);
        }

        @NonNull
        @Override
        public Fetch getFetchInstanceForNamespace(@NonNull String namespace) {
            return fetch;
        }

        @Override
        public void updateNotification(@NonNull NotificationCompat.Builder notificationBuilder,
                                       @NonNull DownloadNotification downloadNotification,
                                       @NonNull Context context) {
            super.updateNotification(notificationBuilder, downloadNotification, context);
            notificationBuilder.setContentIntent(openDownloadsPendingIntent());
        }

        /**
         * Fetch 3.1.6 builds its action-button PendingIntents without FLAG_IMMUTABLE,
         * which throws on Android 12+ and crashes the app. Override to build a safe,
         * immutable PendingIntent that routes the tap to our own receiver instead.
         */
        @NonNull
        @Override
        public PendingIntent getActionPendingIntent(@NonNull DownloadNotification downloadNotification,
                                                    @NonNull DownloadNotification.ActionType actionType) {
            // DefaultFetchNotificationManager assigns notificationId = download.id, so the
            // per-download notification id is the Fetch download id our receiver acts on.
            Intent intent = new Intent(ACTION_NOTIF).setPackage(getContext().getPackageName());
            intent.putExtra("downloadId", downloadNotification.getNotificationId());
            intent.putExtra("action", actionType.name());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            int requestCode = downloadNotification.getNotificationId() * 16 + actionType.ordinal();
            return PendingIntent.getBroadcast(getContext(), requestCode, intent, flags);
        }
    }

    /** Tapping a download notification brings the app forward and opens the Downloads page. */
    private PendingIntent openDownloadsPendingIntent() {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("openDownloads", true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(getContext(), 1001, intent, flags);
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
