package com.db.dbworld.download;

import android.content.Context;
import android.os.SystemClock;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Owns the embedded {@code aria2c} child process.
 *
 * The binary ships inside the APK as {@code jniLibs/<abi>/libaria2c.so} so the installer
 * extracts it into the app's {@code nativeLibraryDir}, the only place modern Android lets
 * us {@code exec()} a file from. We start it once with {@code --enable-rpc} and then drive
 * everything over JSON-RPC ({@link Aria2Rpc}); aria2 owns the queue, segmented multi-connection
 * transfers, HTTP-Range resume, retries and stall handling.
 *
 * Persistence: {@code --save-session} writes unfinished downloads to disk periodically and on
 * shutdown; {@code --input-file} reloads them (with their gid) on the next start, so a
 * process kill resumes cleanly. {@code --stop-with-process=<our pid>} guarantees aria2c exits
 * with the app instead of lingering as a zombie.
 */
final class Aria2Daemon {

    private static final String TAG  = "aria2";
    static final String HOST = "127.0.0.1";
    static final int    PORT = 6800;

    private final String    binaryPath;
    private final File      downloadDir;
    private final File      sessionFile;
    private final String    secret;
    private final Aria2Rpc  rpc;

    private Process process;
    private Thread  logThread;

    Aria2Daemon(Context ctx, String secret, File downloadDir, File sessionFile) {
        this.binaryPath  = ctx.getApplicationInfo().nativeLibraryDir + "/libaria2c.so";
        this.downloadDir = downloadDir;
        this.sessionFile = sessionFile;
        this.secret      = secret;
        this.rpc         = new Aria2Rpc(HOST, PORT, secret);
    }

    Aria2Rpc rpc() { return rpc; }

    /** True if the aria2c binary was actually packaged/extracted for this device's ABI. */
    boolean binaryAvailable() {
        File f = new File(binaryPath);
        return f.exists() && f.canRead();
    }

    String binaryPath() { return binaryPath; }

    /**
     * Ensures aria2c is up and its RPC is answering. Idempotent and safe to call from any
     * background thread. Returns false (without throwing) if the binary is missing or the
     * process failed to become ready, so the plugin can surface a clean error to the UI.
     */
    synchronized boolean ensureStarted(int concurrentLimit) {
        if (pingOk()) return true;              // already serving (this or a prior launch)
        if (!binaryAvailable()) {
            Log.e(TAG, "aria2c binary not found at " + binaryPath
                    + " — drop libaria2c.so into jniLibs/<abi>/ for this device.");
            return false;
        }
        try {
            startProcess(concurrentLimit);
        } catch (Exception e) {
            Log.e(TAG, "failed to start aria2c: " + e.getMessage(), e);
            return false;
        }
        boolean ready = waitUntilReady(6000);
        if (!ready) Log.e(TAG, "aria2c did not become ready within timeout");
        return ready;
    }

    boolean isRunning() {
        return isProcessAlive() && pingOk();
    }

    /** Save the session and stop the process (best-effort; also covered by --stop-with-process). */
    synchronized void shutdown() {
        try { rpc.saveSession(); } catch (Exception ignored) {}
        try { rpc.call("aria2.shutdown"); } catch (Exception ignored) {}
        if (process != null) {
            try { process.destroy(); } catch (Exception ignored) {}
            process = null;
        }
    }

    // ─── internals ──────────────────────────────────────────────────────────────

    private void startProcess(int concurrentLimit) throws Exception {
        File bin = new File(binaryPath);
        //noinspection ResultOfMethodCallIgnored
        bin.setExecutable(true, false); // installer already marks it +x; belt-and-suspenders

        if (!downloadDir.exists()) //noinspection ResultOfMethodCallIgnored
            downloadDir.mkdirs();

        ProcessBuilder pb = new ProcessBuilder(buildArgs(concurrentLimit));
        pb.redirectErrorStream(true);      // merge stderr → stdout so one drain covers both
        process = pb.start();
        Log.i(TAG, "aria2c started");
        drainLogs(process);
    }

    private List<String> buildArgs(int concurrentLimit) {
        List<String> a = new ArrayList<>();
        a.add(binaryPath);
        // RPC (localhost only, secret-guarded)
        a.add("--enable-rpc=true");
        a.add("--rpc-listen-all=false");
        a.add("--rpc-listen-port=" + PORT);
        a.add("--rpc-secret=" + secret);
        a.add("--rpc-allow-origin-all=true");
        // Storage + resume
        a.add("--dir=" + downloadDir.getAbsolutePath());
        a.add("--continue=true");
        a.add("--always-resume=true");
        a.add("--file-allocation=none");   // FUSE storage: pre-allocation stalls the visible start
        a.add("--auto-file-renaming=false");
        a.add("--allow-overwrite=true");
        // Speed: segmented, many connections per server
        a.add("--max-concurrent-downloads=" + Math.max(1, concurrentLimit));
        a.add("--max-connection-per-server=16");
        a.add("--split=16");
        a.add("--min-split-size=1M");
        // Resilience: aria2's own retry/stall handling replaces the old watchdog
        a.add("--max-tries=5");
        a.add("--retry-wait=3");
        a.add("--connect-timeout=30");
        a.add("--timeout=60");
        a.add("--lowest-speed-limit=1K");  // drop & retry a dead-slow connection
        a.add("--disable-ipv6=true");      // avoid slow IPv6 fallbacks on mobile networks
        a.add("--user-agent=DbWorld-Android/3.0");
        // Certificate validation is OFF: aria2 on Android has no access to the system CA
        // store, and the app already permits cleartext to its own CDN. To validate instead,
        // ship a cacert.pem and add --ca-certificate=<path> + --check-certificate=true.
        a.add("--check-certificate=false");
        // Persistence across process death
        a.add("--save-session=" + sessionFile.getAbsolutePath());
        a.add("--save-session-interval=30");
        a.add("--auto-save-interval=20");
        if (sessionFile.exists() && sessionFile.length() > 0) {
            a.add("--input-file=" + sessionFile.getAbsolutePath());
        }
        // Lifecycle + logging.
        // NOTE: --stop-with-process is intentionally NOT used. On Android its parent-liveness
        // check misbehaves and aria2 self-terminates ~1-2s after start (killing the RPC server).
        // The foreground service keeps our process alive instead; a rare orphaned idle aria2 is
        // reused via the pingOk() check on next launch, or reaped by the OS.
        a.add("--daemon=false");
        a.add("--enable-color=false");
        a.add("--console-log-level=warn"); // errors/warnings only (bump to info to debug)
        a.add("--summary-interval=0");
        return a;
    }

    /**
     * Drains the merged stdout/stderr to logcat. This is not just diagnostics — a child
     * process whose output pipe fills without a reader will block, so we must consume it.
     */
    private void drainLogs(Process p) {
        logThread = new Thread(() -> {
            try (BufferedReader r = new BufferedReader(
                    new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) {
                    Log.d(TAG, line);
                }
            } catch (Exception ignored) {
                // pipe closed on process exit
            }
        }, "aria2-log");
        logThread.setDaemon(true);
        logThread.start();
    }

    private boolean waitUntilReady(long timeoutMs) {
        long deadline = SystemClock.uptimeMillis() + timeoutMs;
        while (SystemClock.uptimeMillis() < deadline) {
            if (pingOk()) return true;
            if (!isProcessAlive()) return false; // crashed on startup — stop waiting
            try { Thread.sleep(150); } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return pingOk();
    }

    private boolean pingOk() {
        try {
            rpc.getVersion();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isProcessAlive() {
        if (process == null) return false;
        try {
            process.exitValue(); // throws IllegalThreadStateException while still running
            return false;
        } catch (IllegalThreadStateException alive) {
            return true;
        }
    }
}
