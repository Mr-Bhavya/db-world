package com.db.dbworld.app.media.ingestion.service;

import com.db.dbworld.app.media.ingestion.model.FileBrowserItem;
import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

/**
 * Lists files and directories inside the configured stream-path or temp-path roots.
 * Only paths strictly within the allowed root are served (no path-traversal).
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class FileBrowserService {

    private final AppProperties runtimeProperties;

    private static final List<String> MEDIA_EXTENSIONS = List.of(
            "mkv", "mp4", "avi", "mov", "wmv", "flv", "webm",
            "m4v", "ts", "m2ts", "mpg", "mpeg",
            "mp3", "flac", "aac", "ogg", "wav", "m4a", "opus",
            "zip", "rar", "7z", "tar"
    );

    /**
     * @param root    "stream" or "temp"
     * @param subPath relative sub-path within root, e.g. "" or "Movies/Action"
     */
    public List<FileBrowserItem> browse(String root, String subPath) throws IOException {
        Path base = resolveRoot(root);
        Path target = subPath == null || subPath.isBlank()
                ? base
                : base.resolve(subPath).normalize();

        // Security: reject paths outside root
        if (!target.startsWith(base)) {
            throw new SecurityException("Path traversal attempt: " + subPath);
        }

        if (!Files.exists(target)) {
            throw new IllegalArgumentException("Path does not exist: " + target);
        }

        try (Stream<Path> stream = Files.list(target)) {
            return stream
                    .filter(p -> !p.getFileName().toString().startsWith("."))
                    .filter(p -> Files.isDirectory(p) || isMediaOrArchive(p))
                    .sorted((a, b) -> {
                        boolean aDir = Files.isDirectory(a);
                        boolean bDir = Files.isDirectory(b);
                        if (aDir != bDir) return aDir ? -1 : 1;
                        return a.getFileName().toString().compareToIgnoreCase(b.getFileName().toString());
                    })
                    .map(p -> toItem(p, base))
                    .toList();
        }
    }

    private Path resolveRoot(String root) {
        return switch (root.toLowerCase()) {
            case "stream" -> {
                Path p = runtimeProperties.getStreamPath();
                if (p == null) throw new IllegalStateException("app.stream-path not configured");
                yield p;
            }
            case "temp" -> {
                Path p = runtimeProperties.getTempPath();
                if (p == null) throw new IllegalStateException("app.paths.temp not configured");
                yield p;
            }
            default -> throw new IllegalArgumentException("Unknown root: " + root + ". Use 'stream' or 'temp'");
        };
    }

    private boolean isMediaOrArchive(Path p) {
        String name = p.getFileName().toString().toLowerCase();
        int dot = name.lastIndexOf('.');
        if (dot < 0) return false;
        return MEDIA_EXTENSIONS.contains(name.substring(dot + 1));
    }

    private FileBrowserItem toItem(Path p, Path base) {
        boolean isDir = Files.isDirectory(p);
        String  name  = p.getFileName().toString();
        String  rel   = base.relativize(p).toString().replace("\\", "/");

        Long size = null;
        Long modified = null;
        try {
            if (!isDir) size = Files.size(p);
            modified = Files.getLastModifiedTime(p).toMillis();
        } catch (IOException ignored) {}

        String ext = null;
        if (!isDir) {
            int dot = name.lastIndexOf('.');
            if (dot >= 0) ext = name.substring(dot + 1).toLowerCase();
        }

        return new FileBrowserItem(
                name,
                p.toAbsolutePath().toString(),
                rel,
                isDir,
                size,
                modified,
                ext
        );
    }
}
