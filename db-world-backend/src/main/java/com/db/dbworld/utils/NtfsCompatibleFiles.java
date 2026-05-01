package com.db.dbworld.utils;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.CopyOption;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;

/**
 * File operations compatible with NTFS volumes mounted via ntfs-3g.
 *
 * ntfs-3g does not reliably support the rename(2) syscall used by Files.move(),
 * returning EROFS even on writable mounts. This class detects that failure and
 * falls back to copy-then-delete, which uses read/write syscalls that ntfs-3g
 * handles correctly.
 *
 * Usage: drop-in replacement for Files.move() wherever the target path may be
 * on an ntfs-3g mount (e.g. external USB drives, /ext_hdisk).
 */
public final class NtfsCompatibleFiles {

    private NtfsCompatibleFiles() {}

    /**
     * Moves {@code source} to {@code target}.
     *
     * First tries the native Files.move() (which uses rename(2)).
     * If the kernel rejects the rename with EROFS — a known ntfs-3g limitation —
     * falls back to Files.copy() + Files.delete(), which work correctly on ntfs-3g.
     */
    public static Path move(Path source, Path target, CopyOption... options) throws IOException {
        try {
            return Files.move(source, target, options);
        } catch (IOException e) {
            if (isNtfsRenameFailure(e)) {
                CopyOption[] copyOptions = dropMoveOnlyOptions(options);
                Files.copy(source, target, copyOptions);
                Files.delete(source);
                return target;
            }
            throw e;
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static boolean isNtfsRenameFailure(IOException e) {
        if (e instanceof AtomicMoveNotSupportedException) return true;
        String msg = e.getMessage();
        if (msg == null) return false;
        String lower = msg.toLowerCase();
        return lower.contains("read-only file system")
                || lower.contains("erofs")
                || lower.contains("read only file system");
    }

    /** ATOMIC_MOVE is a move-only option — not valid for Files.copy(). */
    private static CopyOption[] dropMoveOnlyOptions(CopyOption[] options) {
        return Arrays.stream(options)
                .filter(o -> o != StandardCopyOption.ATOMIC_MOVE)
                .toArray(CopyOption[]::new);
    }
}
