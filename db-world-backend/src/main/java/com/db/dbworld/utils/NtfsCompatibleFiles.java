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
 * ntfs-3g is a FUSE driver.  It handles read/write syscalls correctly but has
 * well-known problems with rename(2): it may return EROFS even on a writable
 * mount.  When it encounters NTFS metadata errors it also remounts the
 * filesystem read-only, after which mkdir(2) and open(O_CREAT) fail too.
 *
 * <h3>Strategy (layered)</h3>
 * <ol>
 *   <li><b>move</b>: try NIO rename → fall back to copy+delete (bypasses rename(2))</li>
 *   <li><b>createDirectories</b>: try NIO → fall back to native {@code mkdir -p}</li>
 *   <li><b>isDirectoryWritable</b>: use {@code Files.isWritable} + native {@code touch}
 *       probe (avoids the create+delete pattern that itself throws EROFS)</li>
 *   <li><b>attemptNtfsRemountRw</b>: parse {@code /proc/mounts}, run
 *       {@code mount -o remount,rw} (and optionally {@code ntfsfix}) so the
 *       caller can retry after a read-only remount event</li>
 * </ol>
 *
 * <h3>Sudo setup (required for remount recovery)</h3>
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
     * Falls back to copy+delete when NIO rename(2) returns EROFS on ntfs-3g.
     */
    public static Path move(Path source, Path target, CopyOption... options) throws IOException {
        try {
            return Files.move(source, target, options);
        } catch (IOException e) {
            if (!isNtfsFailure(e)) throw e;
            log.debug("Files.move() rejected by ntfs-3g ({}), using copy+delete: {} -> {}",
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
            // source delete failed — remove the incomplete copy to avoid data duplication
            try { Files.deleteIfExists(target); } catch (IOException ignored) {}
            throw new IOException(
                    "copy+delete fallback: copied successfully but could not delete source: " + source, delEx);
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
            log.warn("Files.createDirectories() failed with EROFS ({}), trying native mkdir -p: {}",
                    e.getMessage(), path);
            return nativeMkdirP(path);
        }
    }

    private static Path nativeMkdirP(Path path) throws IOException {
        try {
            ProcessBuilder pb = new ProcessBuilder("mkdir", "-p", path.toAbsolutePath().toString());
            pb.redirectErrorStream(true);
            Process proc = pb.start();
            String out = new String(proc.getInputStream().readAllBytes()).trim();
            boolean finished = proc.waitFor(PROC_TIMEOUT_SEC, TimeUnit.SECONDS);
            int exit = finished ? proc.exitValue() : -1;
            if (exit != 0) {
                throw new IOException("mkdir -p failed (exit=" + exit + ") for: " + path
                        + (out.isEmpty() ? "" : " | " + out));
            }
            return path;
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IOException("mkdir -p interrupted for: " + path, ie);
        }
    }

    // ── Write probe ───────────────────────────────────────────────────────────

    /**
     * Returns {@code true} if {@code dir} is currently writable.
     *
     * Uses {@code Files.isWritable()} first (fast path).  If NIO reports
     * not-writable — which can be a false negative on some ntfs-3g configurations
     * because the FUSE driver does not always propagate write permissions correctly —
     * falls back to a native {@code touch} probe that exercises the actual syscall.
     */
    public static boolean isDirectoryWritable(Path dir) {
        if (Files.isWritable(dir)) return true;
        // NIO false-negative guard: verify with an actual write syscall via touch
        Path probe = dir.resolve(".ntfs_write_probe_" + System.nanoTime());
        try {
            ProcessBuilder touch = new ProcessBuilder("touch", probe.toAbsolutePath().toString());
            touch.redirectErrorStream(true);
            Process p = touch.start();
            p.getInputStream().transferTo(OutputStream.nullOutputStream());
            boolean done = p.waitFor(PROBE_TIMEOUT_SEC, TimeUnit.SECONDS);
            if (done && p.exitValue() == 0) {
                // clean up
                new ProcessBuilder("rm", "-f", probe.toAbsolutePath().toString())
                        .start().waitFor(PROBE_TIMEOUT_SEC, TimeUnit.SECONDS);
                return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    // ── NTFS mount recovery ──────────────────────────────────────────────────

    /**
     * Attempts to remount the ntfs-3g volume containing {@code path} as read-write.
     *
     * Steps tried in order:
     * <ol>
     *   <li>{@code mount -o remount,rw <mountPoint>}</li>
     *   <li>{@code ntfsfix <device>} then remount</li>
     *   <li>{@code sudo mount -o remount,rw <mountPoint>}</li>
     * </ol>
     *
     * @return {@code true} when a remount attempt succeeded
     */
    public static boolean attemptNtfsRemountRw(Path path) {
        try {
            NtfsMountInfo mount = findNtfsMountInfo(path);
            if (mount == null) {
                log.warn("No ntfs-3g mount found for path: {}", path);
                return false;
            }
            log.warn("EROFS recovery: remounting {} ({}) rw", mount.mountPoint(), mount.device());

            if (exec("mount", "-o", "remount,rw", mount.mountPoint()) == 0) {
                log.info("Remount succeeded: {}", mount.mountPoint());
                return true;
            }
            // Dirty NTFS bit — fix it then remount
            log.warn("Direct remount failed; running ntfsfix on {}", mount.device());
            exec("ntfsfix", mount.device());
            if (exec("mount", "-o", "remount,rw", mount.mountPoint()) == 0) {
                log.info("Remount after ntfsfix succeeded: {}", mount.mountPoint());
                return true;
            }
            // Last resort: try with sudo
            if (exec("sudo", "mount", "-o", "remount,rw", mount.mountPoint()) == 0) {
                log.info("sudo remount succeeded: {}", mount.mountPoint());
                return true;
            }
            log.error("All remount attempts failed for: {}", mount.mountPoint());
            return false;
        } catch (Exception e) {
            log.error("NTFS remount attempt threw: {}", e.getMessage());
            return false;
        }
    }

    // ── Mount detection (parses /proc/mounts) ────────────────────────────────

    /**
     * Finds the ntfs-3g mount that contains {@code path} by reading
     * {@code /proc/mounts}.  Returns the longest (most-specific) matching entry,
     * or {@code null} if the path is not on an ntfs-3g / ntfs3 filesystem.
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
     * {@code fsType} is {@code fuseblk} for ntfs-3g and {@code ntfs3} for the
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

    private static int exec(String... cmd) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process p = pb.start();
        p.getInputStream().transferTo(OutputStream.nullOutputStream());
        return p.waitFor(PROC_TIMEOUT_SEC, TimeUnit.SECONDS) ? p.exitValue() : -1;
    }
}
