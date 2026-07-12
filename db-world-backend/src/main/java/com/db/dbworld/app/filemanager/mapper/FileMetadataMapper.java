package com.db.dbworld.app.filemanager.mapper;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.path.PathJail;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.stream.Stream;

/** Maps a filesystem {@link Path} to a {@link FileItemDto}; size/MIME helpers. */
public final class FileMetadataMapper {
    private FileMetadataMapper() {}

    public static FileItemDto toDto(String locationId, Path base, Path p, boolean withChildCount) throws IOException {
        BasicFileAttributes attrs = Files.readAttributes(p, BasicFileAttributes.class);
        boolean dir = attrs.isDirectory();
        long size = dir ? 0L : attrs.size();
        int children = 0;
        if (dir && withChildCount) {
            try (Stream<Path> s = Files.list(p)) {
                children = (int) s.count();
            } catch (IOException ignored) {}
        }
        String name = p.getFileName() != null ? p.getFileName().toString() : p.toString();
        String ext  = dir ? "" : (name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "");
        return FileItemDto.builder()
            .name(name)
            .path(PathJail.toRelative(base, p))
            .directory(dir)
            .sizeBytes(size)
            .formattedSize(formatSize(size))
            .extension(ext)
            .mimeType(dir ? "directory" : guessMime(ext))
            .lastModified(LocalDateTime.ofInstant(attrs.lastModifiedTime().toInstant(), ZoneId.systemDefault()))
            .createdAt(LocalDateTime.ofInstant(attrs.creationTime().toInstant(), ZoneId.systemDefault()))
            .childCount(children)
            .readable(Files.isReadable(p))
            .writable(Files.isWritable(p))
            .locationId(locationId)
            .build();
    }

    public static String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }

    public static String guessMime(String ext) {
        return switch (ext) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png"   -> "image/png";
            case "gif"   -> "image/gif";
            case "webp"  -> "image/webp";
            case "mp4"   -> "video/mp4";
            case "mkv"   -> "video/x-matroska";
            case "avi"   -> "video/x-msvideo";
            case "mp3"   -> "audio/mpeg";
            case "flac"  -> "audio/flac";
            case "pdf"   -> "application/pdf";
            case "zip"   -> "application/zip";
            case "tar"   -> "application/x-tar";
            case "gz"    -> "application/gzip";
            case "json"  -> "application/json";
            case "xml"   -> "application/xml";
            case "txt"   -> "text/plain";
            case "html"  -> "text/html";
            case "css"   -> "text/css";
            case "js"    -> "application/javascript";
            case "ts"    -> "application/typescript";
            case "java"  -> "text/x-java-source";
            default      -> "application/octet-stream";
        };
    }
}
