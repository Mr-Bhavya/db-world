package com.db.dbworld.app.filemanager.path;

import java.io.IOException;
import java.nio.file.Path;

/** Confines a raw client path to a resolved location base directory. */
public final class PathJail {
    private PathJail() {}

    public static Path resolve(Path base, String rawPath) {
        Path b = base.toAbsolutePath().normalize();
        Path resolved;
        if (rawPath == null || rawPath.isBlank() || rawPath.equals("/")) {
            resolved = b;
        } else {
            String rel = rawPath.replaceAll("^/+", "");
            resolved = rel.isEmpty() ? b : b.resolve(rel).normalize();
        }
        if (!resolved.startsWith(b)) {
            throw new SecurityException("Path traversal attempt blocked: " + rawPath);
        }
        return resolved;
    }

    /** Resolves then follows symlinks, re-checking the jail (use before reads/copies). */
    public static Path resolveReal(Path base, String rawPath) throws IOException {
        Path p = resolve(base, rawPath);
        Path real = p.toRealPath();
        if (!real.startsWith(base.toAbsolutePath().normalize().toRealPath())) {
            throw new SecurityException("Symlink escape blocked: " + rawPath);
        }
        return real;
    }

    public static String toRelative(Path base, Path p) {
        Path b = base.toAbsolutePath().normalize();
        if (p.equals(b)) return "/";
        return "/" + b.relativize(p).toString().replace("\\", "/");
    }
}
