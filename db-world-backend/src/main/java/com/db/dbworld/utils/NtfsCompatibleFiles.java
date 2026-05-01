package com.db.dbworld.utils;

import lombok.extern.log4j.Log4j2;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.CopyOption;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

/**
 * Comprehensive file-operation toolkit for paths on NTFS volumes mounted via ntfs-3g.
 *
 * <h3>Why NIO fails on ntfs-3g</h3>
 * ntfs-3g is a FUSE driver. It handles read/write syscalls correctly but has
 * well-known problems with rename(2): it may return EROFS even on a writable mount.
 * When it detects the NTFS dirty bit (set by Windows on unclean shutdown, or by a
 * power loss mid-write) it remounts read-only as a safety measure, after which
 * mkdir(2), open(O_CREAT), unlink(2) and symlink(2) all fail with EROFS too.
 *
 * <h3>Fix: clear the dirty bit on the server</h3>
 * <pre>
 *   sudo ntfsfix /dev/sdX          # clears dirty bit — safe, non-destructive
 *   sudo mount -o remount,rw /ext_hdisk
 * </pre>
 * Note: {@code mount -o remount,rw} does NOT unmount — it only flips the
 * read-only flag on the live mount, so running processes are unaffected.
 *
 * <h3>Layered strategy in this class</h3>
 * <ol>
 *   <li><b>move</b>: NIO rename → copy+delete fallback</li>
 *   <li><b>createDirectories</b>: NIO → native {@code mkdir -p}</li>
 *   <li><b>delete</b>: NIO unlink → remount recovery → native {@code rm -f}</li>
 *   <li><b>probeWritable</b>: {@code touch} probe — exposes the real OS error
 *       message instead of returning a plain boolean</li>
 *   <li><b>attemptNtfsRemountRw</b>: parses {@code /proc/mounts},
 *       runs {@code mount -o remount,rw} (+ optional {@code ntfsfix})</li>
 * </ol>
 *
 * <h3>Sudo rules required for remount recovery</h3>
 * Add to {@code /etc/sudoers.d/dbworld}:
 * <pre>
 *   dbworld ALL=(ALL) NOPASSWD: /bin/mount -o remount* /ext_hdisk
 *   dbworld ALL=(ALL) NOPASSWD: /usr/bin/ntfsfix /dev/sd*
 * </pre>
 */
@Log4j2
public final class NtfsCompatibleFiles {

    private static final int PROC_TIMEOUT_SEC  = 30;
    private static final int PROBE_TIMEOUT_SEC = 10;

    private NtfsCompatibleFiles() {}

    // ── Move ─────────────────────────────────────────────────────────────────

    /**
     * Moves {@code source} to {@code target}.
     * Falls back to copy+delete when NIO rename(2) fails on ntfs-3g.
     */
    public static Path move(Path source, Path target, CopyOption... options) throws IOException {
        try {
            return Files.move(source, target, options);
        } catch (IOException e) {
            if (!isNtfsFailure(e)) throw e;
            log.debug("Files.move() rejected ({}), using copy+delete: {} -> {}",
                    e.getMessage(), source.getFileName(), target.getFileName());
            return copyThenDelete(source, target, options);
        }
    }

    private static Path copyThenDelete(Path source, Path target, CopyOption... options) throws IOException {
        CopyOption[] copyOpts = dropMoveOnlyOptions(options);
        Files.copy(source, target, copyOpts);
        try {
            Files.delete(source);
        } catch (IOException delEx) {
            try { Files.deleteIfExists(target); } catch (IOException ignored) {}
            throw new IOException(
                    "copy+delete fallback: copied but could not delete source " + source
                    + " — " + delEx.getMessage(), delEx);
        }
        return target;
    }

    // ── CreateDirectories ─────────────────────────────────────────────────────

    /**
     * Creates the directory tree at {@code path}.
     * Falls back to native {@code mkdir -p} when NIO throws EROFS.
     */
    public static Path createDirectories(Path path) throws IOException {
        try {
            return Files.createDirectories(path);
        } catch (IOException e) {
            if (!isNtfsFailure(e)) throw e;
            log.warn("Files.createDirectories() EROFS ({}), trying mkdir -p: {}", e.getMessage(), path);
            return nativeMkdirP(path);
        }
    }

    private static Path nativeMkdirP(Path path) throws IOException {
        try {
            ProcessBuilder pb = new ProcessBuilder("mkdir", "-p", path.toAbsolutePath().toString());
            pb.redirectErrorStream(true);
            Process proc = pb.start();
            String out = new String(proc.getInputStream().readAllBytes()).trim();
            boolean done = proc.waitFor(PROC_TIMEOUT_SEC, TimeUnit.SECONDS);
            int exit = done ? proc.exitValue() : -1;
            if (exit != 0) {
                throw new IOException("mkdir -p failed (exit=" + exit + ") for: " + path
                        + (out.isEmpty() ? "" : " — " + out));
            }
            return path;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IOException("mkdir -p interrupted for: " + path, ie);
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * Deletes {@code path} (file, symlink, or empty directory).
     *
     * On EROFS: attempts ntfs-3g remount recovery, then retries NIO delete.
     * As a last resort tries native {@code rm -f}.
     */
    public static void delete(Path path) throws IOException {
        try {
            Files.delete(path);
        } catch (IOException e) {
            if (!isNtfsFailure(e)) throw e;
            log.warn("Files.delete() EROFS ({}), attempting recovery for: {}", e.getMessage(), path);

            // Attempt remount, then retry
            if (attemptNtfsRemountRw(path.getParent() != null ? path.getParent() : path)) {
                try {
                    Files.delete(path);
                    return;
                } catch (IOException retryEx) {
                    log.warn("Files.delete() still failed after remount ({}), trying rm -f", retryEx.getMessage());
                }
            }

            // Last resort: native rm -f
            try {
                ProcessBuilder pb = new ProcessBuilder("rm", "-f", path.toAbsolutePath().toString());
                pb.redirectErrorStream(true);
                Process proc = pb.start();
                String out = new String(proc.getInputStream().readAllBytes()).trim();
                boolean done = proc.waitFor(PROC_TIMEOUT_SEC, TimeUnit.SECONDS);
                int exit = done ? proc.exitValue() : -1;
                if (exit != 0) {
                    throw new IOException("rm -f failed (exit=" + exit + ") for: " + path
                            + (out.isEmpty() ? "" : " — " + out));
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new IOException("rm -f interrupted for: " + path, ie);
            }
        }
    }

    /**
     * Deletes {@code path} if it exists (NOFOLLOW_LINKS).
     * Returns {@code true} if the path existed and was deleted.
     */
    public static boolean deleteIfExists(Path path) throws IOException {
        if (!Files.exists(path, java.nio.file.LinkOption.NOFOLLOW_LINKS)) return false;
        delete(path);
        return true;
    }

    // ── Write probe (exposes real OS error) ──────────────────────────────────

    /**
     * Verifies {@code dir} is writable.
     * Returns {@code null} if writable, or an {@code IOException} containing
     * the <b>real OS error message</b> if not.
     *
     * Uses a native {@code touch} probe so the actual kernel error is captured.
     * {@code Files.isWritable()} can give false negatives on ntfs-3g because
     * the FUSE permission layer doesn't always reflect the kernel's write state.
     */
    public static IOException probeWritable(Path dir) {
        if (Files.isWritable(dir)) return null;

        Path probe = dir.resolve(".ntfs_write_probe_" + System.nanoTime());
        String probePathStr = probe.toAbsolutePath().toString();
        try {
            ProcessBuilder touch = new ProcessBuilder("touch", probePathStr);
            touch.redirectErrorStream(true);
            Process p = touch.start();
            String output = new String(p.getInputStream().readAllBytes()).trim();
            boolean done = p.waitFor(PROBE_TIMEOUT_SEC, TimeUnit.SECONDS);
            int exit = done ? p.exitValue() : -1;

            if (exit == 0) {
                // writable — clean up probe file
                new ProcessBuilder("rm", "-f", probePathStr)
                        .start().waitFor(PROBE_TIMEOUT_SEC, TimeUnit.SECONDS);
                return null;
            }
            // Capture the real OS error from touch's stderr
            String reason = output.isEmpty()
                    ? "touch probe returned exit=" + exit
                    : output; // e.g. "touch: cannot touch '...': Read-only file system"
            return new IOException("Directory not writable: " + dir + " — " + reason);

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return new IOException("Write probe interrupted for: " + dir, ie);
        } catch (Exception e) {
            return new IOException("Write probe failed for: " + dir + " — " + e.getMessage(), e);
        }
    }

    /** Convenience boolean wrapper around {@link #probeWritable}. */
    public static boolean isDirectoryWritable(Path dir) {
        return probeWritable(dir) == null;
    }

    // ── NTFS mount recovery ──────────────────────────────────────────────────

    /**
     * Attempts to remount the ntfs-3g volume containing {@code path} as read-write.
     * Does NOT unmount — uses {@code mount -o remount,rw} which is safe while the
     * filesystem is in use by other processes.
     *
     * Steps tried in order:
     * <ol>
     *   <li>{@code mount -o remount,rw <mountPoint>}</li>
     *   <li>{@code ntfsfix <device>} (clears dirty bit) then remount</li>
     *   <li>{@code sudo mount -o remount,rw <mountPoint>}</li>
     * </ol>
     *
     * @return {@code true} when a remount attempt succeeded
     */
    public static boolean attemptNtfsRemountRw(Path path) {
        if (path == null) return false;
        try {
            NtfsMountInfo mount = findNtfsMountInfo(path);
            if (mount == null) {
                log.warn("No ntfs-3g/ntfs3 mount found for path: {}", path);
                return false;
            }
            log.warn("EROFS recovery: remounting {} ({}) rw", mount.mountPoint(), mount.device());

            String[] remountCmd = {"mount", "-o", "remount,rw", mount.mountPoint()};

            int exit = execCapture(remountCmd);
            if (exit == 0) { log.info("Remount succeeded: {}", mount.mountPoint()); return true; }

            // NTFS dirty bit — clear it then remount
            log.warn("Direct remount failed (exit={}); running ntfsfix on {}", exit, mount.device());
            execCapture("ntfsfix", mount.device());

            exit = execCapture(remountCmd);
            if (exit == 0) { log.info("Remount after ntfsfix succeeded: {}", mount.mountPoint()); return true; }

            // Last resort: try with sudo
            exit = execCapture("sudo", "mount", "-o", "remount,rw", mount.mountPoint());
            if (exit == 0) { log.info("sudo remount succeeded: {}", mount.mountPoint()); return true; }

            log.error("All remount attempts failed for: {}", mount.mountPoint());
            return false;
        } catch (Exception e) {
            log.error("NTFS remount attempt threw: {}", e.getMessage());
            return false;
        }
    }

    // ── Mount detection ───────────────────────────────────────────────────────

    /**
     * Finds the ntfs-3g / ntfs3 mount containing {@code path} by parsing
     * {@code /proc/mounts}. Returns the longest (most-specific) matching entry,
     * or {@code null} if the path is not on an NTFS filesystem.
     */
    public static NtfsMountInfo findNtfsMountInfo(Path path) {
        Path procMounts = Paths.get("/proc/mounts");
        if (!Files.exists(procMounts)) return null;
        String pathStr = path.toAbsolutePath().normalize().toString();
        try (var lines = Files.lines(procMounts)) {
            return lines
                    .map(NtfsCompatibleFiles::parseMountLine)
                    .filter(Objects::nonNull)
                    .filter(NtfsMountInfo::isNtfs)
                    .filter(m -> pathStr.startsWith(m.mountPoint()))
                    .max(Comparator.comparingInt(m -> m.mountPoint().length()))
                    .orElse(null);
        } catch (IOException e) {
            log.warn("Could not read /proc/mounts: {}", e.getMessage());
            return null;
        }
    }

    private static NtfsMountInfo parseMountLine(String line) {
        if (line == null || line.startsWith("#") || line.isBlank()) return null;
        String[] p = line.split("\\s+");
        if (p.length < 4) return null;
        return new NtfsMountInfo(p[0], p[1], p[2], p[3]);
    }

    /**
     * Parsed entry from {@code /proc/mounts}.
     * {@code fsType} is {@code fuseblk} for ntfs-3g; {@code ntfs3} for the
     * in-kernel NTFS driver (Linux ≥ 5.15).
     */
    public record NtfsMountInfo(String device, String mountPoint, String fsType, String options) {
        public boolean isNtfs() {
            return "fuseblk".equals(fsType) || fsType.contains("ntfs");
        }
        public boolean isReadOnly() {
            return Arrays.asList(options.split(",")).contains("ro");
        }
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    public static boolean isNtfsFailure(IOException e) {
        if (e instanceof AtomicMoveNotSupportedException) return true;
        String msg = e.getMessage();
        if (msg == null) return false;
        String lower = msg.toLowerCase();
        return lower.contains("read-only file system")
                || lower.contains("erofs")
                || lower.contains("read only file system")
                || lower.contains("operation not supported");
    }

    private static CopyOption[] dropMoveOnlyOptions(CopyOption[] options) {
        return Arrays.stream(options)
                .filter(o -> o != StandardCopyOption.ATOMIC_MOVE)
                .toArray(CopyOption[]::new);
    }

    /** Runs a command, captures and logs output, returns exit code. */
    private static int execCapture(String... cmd) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process p = pb.start();
        String out = new String(p.getInputStream().readAllBytes()).trim();
        boolean done = p.waitFor(PROC_TIMEOUT_SEC, TimeUnit.SECONDS);
        int exit = done ? p.exitValue() : -1;
        if (!out.isEmpty()) {
            log.debug("exec {}: exit={} output={}", String.join(" ", cmd), exit, out);
        }
        return exit;
    }
}
