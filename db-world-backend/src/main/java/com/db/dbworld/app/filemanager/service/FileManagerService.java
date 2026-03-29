package com.db.dbworld.app.filemanager.service;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Stream;

@Service
@Log4j2
public class FileManagerService {

    @Value("${file-manager.base-dir:/}")
    private String baseDirConfig;

    private Path cachedBaseDir;

    @PostConstruct
    private void initBaseDir() {
        this.cachedBaseDir = Path.of(baseDirConfig).toAbsolutePath().normalize();
    }

    private Path baseDir() {
        return cachedBaseDir;
    }

    // ── Path jail ─────────────────────────────────────────────────────────────

    private Path jailed(String rawPath) {
        Path base = baseDir();
        Path resolved;
        if (rawPath == null || rawPath.isBlank() || rawPath.equals("/")) {
            resolved = base;
        } else {
            String rel = rawPath.startsWith("/") ? rawPath.substring(1) : rawPath;
            resolved = base.resolve(rel).normalize();
        }
        if (!resolved.startsWith(base)) {
            throw new SecurityException("Path traversal attempt blocked: " + rawPath);
        }
        return resolved;
    }

    private String toRelative(Path p) {
        Path base = baseDir();
        if (p.equals(base)) return "/";
        return "/" + base.relativize(p).toString().replace("\\", "/");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private FileItemDto toDto(Path p) throws IOException {
        BasicFileAttributes attrs = Files.readAttributes(p, BasicFileAttributes.class);
        boolean dir = attrs.isDirectory();
        long size = dir ? 0L : attrs.size();
        int children = 0;
        if (dir) {
            try (Stream<Path> s = Files.list(p)) {
                children = (int) s.count();
            } catch (IOException ignored) {}
        }
        String name = p.getFileName() != null ? p.getFileName().toString() : p.toString();
        String ext  = dir ? "" : (name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "");
        return FileItemDto.builder()
            .name(name)
            .path(toRelative(p))
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
            .build();
    }

    private static String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }

    private static String guessMime(String ext) {
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

    // ── API methods ───────────────────────────────────────────────────────────

    public FileListDto listDirectory(String path, String sortBy, String order) throws IOException {
        Path dir = jailed(path);
        if (!Files.isDirectory(dir)) throw new IllegalArgumentException("Not a directory: " + path);

        List<FileItemDto> items = new ArrayList<>();
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir)) {
            for (Path entry : ds) {
                try { items.add(toDto(entry)); } catch (IOException ignored) {}
            }
        }

        Comparator<FileItemDto> comp = Comparator.comparing(FileItemDto::isDirectory).reversed();
        comp = comp.thenComparing(switch (sortBy != null ? sortBy : "name") {
            case "size"     -> Comparator.comparingLong(FileItemDto::getSizeBytes);
            case "modified" -> Comparator.comparing(FileItemDto::getLastModified);
            case "type"     -> Comparator.comparing(FileItemDto::getExtension);
            default         -> Comparator.comparing(i -> i.getName().toLowerCase());
        });
        if ("desc".equalsIgnoreCase(order)) comp = comp.reversed()
            .thenComparing(Comparator.comparing(FileItemDto::isDirectory).reversed());
        items.sort(comp);

        long totalSize = items.stream().mapToLong(FileItemDto::getSizeBytes).sum();
        String parentPath = dir.equals(baseDir()) ? null : toRelative(dir.getParent());

        return FileListDto.builder()
            .currentPath(toRelative(dir))
            .parentPath(parentPath)
            .totalItems(items.size())
            .totalSize(totalSize)
            .items(items)
            .build();
    }

    public List<FileItemDto> searchFiles(String path, String query, boolean recursive) throws IOException {
        Path root = jailed(path);
        if (query == null || query.isBlank()) {
            return List.of();
        }
        List<FileItemDto> results = new ArrayList<>();
        String lowerQ = query.toLowerCase();
        int maxResults = 200;

        if (recursive) {
            try (Stream<Path> walk = Files.walk(root)) {
                walk.filter(p -> !p.equals(root))
                    .filter(p -> {
                        String fname = p.getFileName() != null ? p.getFileName().toString() : "";
                        return fname.toLowerCase().contains(lowerQ);
                    })
                    .limit(maxResults)
                    .forEach(p -> {
                        try { results.add(toDto(p)); } catch (IOException ignored) {}
                    });
            }
        } else {
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(root)) {
                for (Path entry : ds) {
                    String fname = entry.getFileName() != null ? entry.getFileName().toString() : "";
                    if (fname.toLowerCase().contains(lowerQ)) {
                        try { results.add(toDto(entry)); } catch (IOException ignored) {}
                    }
                    if (results.size() >= maxResults) break;
                }
            }
        }
        return results;
    }

    public FileItemDto getInfo(String path) throws IOException {
        return toDto(jailed(path));
    }

    public void downloadFile(String path, HttpServletResponse response) throws IOException {
        Path file = jailed(path);
        if (!Files.isRegularFile(file)) throw new IllegalArgumentException("Not a file: " + path);
        String filename = URLEncoder.encode(file.getFileName().toString(), StandardCharsets.UTF_8)
            .replace("+", "%20");
        response.setContentType("application/octet-stream");
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + filename);
        response.setContentLengthLong(Files.size(file));
        try (InputStream in = Files.newInputStream(file);
             OutputStream out = response.getOutputStream()) {
            in.transferTo(out);
        }
    }

    public List<FileItemDto> uploadFiles(String path, MultipartFile[] files) throws IOException {
        Path dir = jailed(path);
        if (!Files.isDirectory(dir)) throw new IllegalArgumentException("Upload target is not a directory");
        List<FileItemDto> uploaded = new ArrayList<>();
        for (MultipartFile f : files) {
            String name = Path.of(Objects.requireNonNull(f.getOriginalFilename())).getFileName().toString();
            Path dest = jailed(path + "/" + name);
            f.transferTo(dest);
            uploaded.add(toDto(dest));
        }
        return uploaded;
    }

    public FileItemDto createDirectory(String parentPath, String name) throws IOException {
        Path parent = jailed(parentPath); // validates parentPath is within jail and exists
        if (!Files.isDirectory(parent)) throw new IllegalArgumentException("Parent path is not a directory: " + parentPath);
        if (name.contains("/") || name.contains("\\") || name.contains("..")) {
            throw new IllegalArgumentException("Invalid folder name: " + name);
        }
        Path newDir = jailed(parentPath + "/" + name);
        Files.createDirectory(newDir);
        return toDto(newDir);
    }

    public FileItemDto renameItem(String path, String newName) throws IOException {
        Path source = jailed(path);
        if (newName.contains("/") || newName.contains("\\") || newName.contains("..")) {
            throw new IllegalArgumentException("Invalid name: " + newName);
        }
        Path dest = jailed(toRelative(source.getParent()) + "/" + newName);
        if (Files.exists(dest)) throw new IllegalStateException("A file with that name already exists");
        try {
            Files.move(source, dest, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(source, dest);
        }
        return toDto(dest);
    }

    public FileItemDto moveItem(String sourcePath, String destinationPath) throws IOException {
        Path source = jailed(sourcePath);
        Path destDir = jailed(destinationPath);
        if (!Files.isDirectory(destDir)) throw new IllegalArgumentException("Destination must be a directory");
        Path dest = jailed(destinationPath + "/" + source.getFileName().toString());
        if (Files.exists(dest)) throw new IllegalStateException("A file with that name already exists in destination");
        try {
            Files.move(source, dest, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(source, dest);
        }
        return toDto(dest);
    }

    public FileItemDto copyItem(String sourcePath, String destinationPath) throws IOException {
        Path source = jailed(sourcePath);
        Path destDir = jailed(destinationPath);
        if (!Files.isDirectory(destDir)) throw new IllegalArgumentException("Destination must be a directory");
        Path dest = jailed(destinationPath + "/" + source.getFileName().toString());
        if (Files.isDirectory(source)) {
            copyDirRecursive(source, dest);
        } else {
            if (Files.exists(dest)) throw new IllegalStateException("A file with that name already exists in destination");
            Files.copy(source, dest);
        }
        return toDto(dest);
    }

    private void copyDirRecursive(Path src, Path dest) throws IOException {
        Files.createDirectories(dest);
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(src)) {
            for (Path child : ds) {
                Path childDest = dest.resolve(child.getFileName());
                if (Files.isDirectory(child)) copyDirRecursive(child, childDest);
                else Files.copy(child, childDest, StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }

    public void deleteItem(String path) throws IOException {
        Path target = jailed(path);
        if (!Files.exists(target)) throw new NoSuchFileException(path);
        if (Files.isDirectory(target)) {
            deleteDirectoryRecursive(target);
        } else {
            Files.delete(target);
        }
    }

    private void deleteDirectoryRecursive(Path dir) throws IOException {
        try (Stream<Path> walk = Files.walk(dir)) {
            List<Path> sorted = walk.sorted(Comparator.reverseOrder()).toList();
            for (Path p : sorted) {
                try {
                    Files.delete(p);
                } catch (IOException e) {
                    log.warn("Could not delete {}: {}", p, e.getMessage());
                    throw new IOException("Failed to delete " + p + ": " + e.getMessage(), e);
                }
            }
        }
    }
}
