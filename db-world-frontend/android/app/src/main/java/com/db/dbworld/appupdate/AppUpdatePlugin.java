package com.db.dbworld.appupdate;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app updater for sideloaded distribution. Downloads the release APK and
 * launches the system installer (the OS shows its own install confirmation —
 * a silent install isn't possible without device-owner/root).
 *
 * Emits "updateProgress" { progress, downloadedBytes, totalBytes } while
 * downloading. installApk resolves with:
 *   { status: "installing" }        — download done, installer launched
 *   { status: "needs_permission" }  — user must allow "install unknown apps"
 *                                      (we open that settings screen)
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String APK_NAME = "db-world-update.apk";
    private volatile boolean downloading = false;

    @PluginMethod
    public void installApk(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("url required"); return; }

        // Android O+: the app needs the user's one-time "install unknown apps" grant.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(settings);
            } catch (Exception ignored) { /* some OEMs lack this screen */ }
            JSObject r = new JSObject();
            r.put("status", "needs_permission");
            call.resolve(r);
            return;
        }

        if (downloading) { call.reject("already downloading"); return; }
        downloading = true;

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                File apk = new File(getContext().getCacheDir(), APK_NAME);
                if (apk.exists() && !apk.delete()) { /* overwrite below */ }

                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);
                conn.connect();

                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) throw new RuntimeException("HTTP " + code);

                long total = conn.getContentLengthLong();
                try (InputStream in = conn.getInputStream();
                     OutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[64 * 1024];
                    long done = 0;
                    int n, lastPct = -1;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct != lastPct) {
                                lastPct = pct;
                                JSObject e = new JSObject();
                                e.put("progress", pct);
                                e.put("downloadedBytes", done);
                                e.put("totalBytes", total);
                                notifyListeners("updateProgress", e);
                            }
                        }
                    }
                    out.flush();
                }

                launchInstall(apk);
                JSObject r = new JSObject();
                r.put("status", "installing");
                call.resolve(r);
            } catch (Exception e) {
                call.reject("update failed: " + e.getMessage());
            } finally {
                downloading = false;
                if (conn != null) conn.disconnect();
            }
        }, "apk-download").start();
    }

    private void launchInstall(File apk) {
        Uri uri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().runOnUiThread(() -> {
            try { getContext().startActivity(intent); } catch (Exception ignored) {}
        });
    }
}
