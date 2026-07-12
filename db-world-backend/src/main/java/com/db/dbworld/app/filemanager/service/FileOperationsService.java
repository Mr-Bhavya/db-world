package com.db.dbworld.app.filemanager.service;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.mapper.FileMetadataMapper;
import com.db.dbworld.app.filemanager.path.PathJail;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/** Location-aware file operations: list/search/info/mkdir/rename/move/copy/delete. */
@Log4j2
@Service
@RequiredArgsConstructor
public class FileOperationsService {

    private static final int MAX_SEARCH_RESULTS = 200;
    private static final int MAX_SEARCH_DEPTH = 8;

    private final FileLocationService locationService;

    public FileListDto list(String locationId, String path, String sortBy, String order) throws IOException {
        log.debug("list locationId={} path={} sortBy={} order={}", locationId, path, sortBy, order);
        Path base = locationService.resolveBase(locationId);
        Path dir = PathJail.resolve(base, path);
        if (!Files.isDirectory(dir)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Not a directory: " + path);

        List<FileItemDto> items = new ArrayList<>();
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir)) {
            for (Path entry : ds) {
                try { items.add(FileMetadataMapper.toDto(locationId, base, entry, false)); } catch (IOException ignored) {}
            }
        }

        Comparator<FileItemDto> comp = getFileItemDtoComparator(sortBy, order);
        items.sort(comp);

        long totalSize = items.stream().mapToLong(FileItemDto::getSizeBytes).sum();
        String parentPath = dir.equals(base) ? null : PathJail.toRelative(base, dir.getParent());

        return FileListDto.builder()
            .currentPath(PathJail.toRelative(base, dir))
            .parentPath(parentPath)
            .totalItems(items.size())
            .totalSize(totalSize)
            .items(items)
            .build();
    }

    @Nonnull
    private static Comparator<FileItemDto> getFileItemDtoComparator(String sortBy, String order) {
        // Field comparator — optionally reversed for desc; directories always sort first
        Comparator<FileItemDto> field = switch (sortBy != null ? sortBy : "name") {
            case "size"     -> Comparator.comparingLong(FileItemDto::getSizeBytes);
            case "modified" -> Comparator.comparing(FileItemDto::getLastModified);
            case "type"     -> Comparator.comparing(FileItemDto::getExtension);
            default         -> Comparator.comparing(i -> i.getName().toLowerCase());
        };
        if ("desc".equalsIgnoreCase(order)) field = field.reversed();
        // Directories always first, regardless of sort direction
        return Comparator.comparing(FileItemDto::isDirectory).reversed().thenComparing(field);
    }

    public List<FileItemDto> search(String locationId, String path, String query, boolean recursive) throws IOException {
        log.debug("search locationId={} path={} query={} recursive={}", locationId, path, query, recursive);
        Path base = locationService.resolveBase(locationId);
        Path root = PathJail.resolve(base, path);
        if (query == null || query.isBlank()) {
            return List.of();
        }
        List<FileItemDto> results = new ArrayList<>();
        String lowerQ = query.toLowerCase();

        if (recursive) {
            try (Stream<Path> walk = Files.walk(root, MAX_SEARCH_DEPTH)) {
                walk.filter(p -> !p.equals(root))
                    .filter(p -> {
                        String fname = p.getFileName() != null ? p.getFileName().toString() : "";
                        return fname.toLowerCase().contains(lowerQ);
                    })
                    .limit(MAX_SEARCH_RESULTS)
                    .forEach(p -> {
                        try { results.add(FileMetadataMapper.toDto(locationId, base, p, false)); } catch (IOException ignored) {}
                    });
            }
        } else {
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(root)) {
                for (Path entry : ds) {
                    String fname = entry.getFileName() != null ? entry.getFileName().toString() : "";
                    if (fname.toLowerCase().contains(lowerQ)) {
                        try { results.add(FileMetadataMapper.toDto(locationId, base, entry, false)); } catch (IOException ignored) {}
                    }
                    if (results.size() >= MAX_SEARCH_RESULTS) break;
                }
            }
        }
        return results;
    }

    public FileItemDto info(String locationId, String path) throws IOException {
        Path base = locationService.resolveBase(locationId);
        return FileMetadataMapper.toDto(locationId, base, PathJail.resolve(base, path), false);
    }

    public FileItemDto mkdir(String locationId, String parentPath, String name) throws IOException {
        log.info("mkdir locationId={} parent={} name={}", locationId, parentPath, name);
        Path base = locationService.resolveBase(locationId);
        Path parent = PathJail.resolve(base, parentPath); // validates parentPath is within jail and exists
        if (!Files.isDirectory(parent)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Parent path is not a directory: " + parentPath);
        rejectUnsafeName(name);
        Path newDir = PathJail.resolve(base, parentPath + "/" + name);
        try {
            Files.createDirectory(newDir);
        } catch (IOException e) {
            log.error("Failed to create directory {} under {}", name, parentPath, e);
            throw e;
        }
        return FileMetadataMapper.toDto(locationId, base, newDir, false);
    }

    public FileItemDto renameItem(String locationId, String path, String newName) throws IOException {
        log.info("renameItem locationId={} path={} newName={}", locationId, path, newName);
        Path base = locationService.resolveBase(locationId);
        Path source = PathJail.resolve(base, path);
        rejectUnsafeName(newName);
        Path dest = PathJail.resolve(base, PathJail.toRelative(base, source.getParent()) + "/" + newName);
        if (Files.exists(dest)) throw new IllegalStateException("A file with that name already exists");
        try {
            Files.move(source, dest, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(source, dest);
        } catch (IOException e) {
            log.error("renameItem failed locationId={} path={} newName={}", locationId, path, newName, e);
            throw e;
        }
        return FileMetadataMapper.toDto(locationId, base, dest, false);
    }

    public FileItemDto moveItem(String locationId, String sourcePath, String destinationPath) throws IOException {
        log.info("moveItem locationId={} source={} dest={}", locationId, sourcePath, destinationPath);
        Path base = locationService.resolveBase(locationId);
        Path source = PathJail.resolve(base, sourcePath);
        Path destDir = PathJail.resolve(base, destinationPath);
        if (!Files.isDirectory(destDir)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Destination must be a directory");
        Path dest = PathJail.resolve(base, destinationPath + "/" + source.getFileName().toString());
        if (Files.exists(dest)) throw new IllegalStateException("A file with that name already exists in destination");
        try {
            Files.move(source, dest, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(source, dest);
        } catch (IOException e) {
            log.error("moveItem failed locationId={} source={} dest={}", locationId, sourcePath, destinationPath, e);
            throw e;
        }
        return FileMetadataMapper.toDto(locationId, base, dest, false);
    }

    public FileItemDto copyItem(String locationId, String sourcePath, String destinationPath) throws IOException {
        log.info("copyItem locationId={} source={} dest={}", locationId, sourcePath, destinationPath);
        Path base = locationService.resolveBase(locationId);
        Path source = PathJail.resolveReal(base, sourcePath); // symlink-sensitive: following a link must not escape the jail
        Path destDir = PathJail.resolve(base, destinationPath);
        if (!Files.isDirectory(destDir)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Destination must be a directory");
        Path dest = PathJail.resolve(base, destinationPath + "/" + source.getFileName().toString());
        try {
            if (Files.isDirectory(source)) {
                copyDirRecursive(base, source, dest);
            } else {
                if (Files.exists(dest)) throw new IllegalStateException("A file with that name already exists in destination");
                Files.copy(source, dest);
            }
        } catch (IOException e) {
            log.error("copyItem failed locationId={} source={} dest={}", locationId, sourcePath, destinationPath, e);
            throw e;
        }
        return FileMetadataMapper.toDto(locationId, base, dest, false);
    }

    private void copyDirRecursive(Path base, Path src, Path dest) throws IOException {
        Files.createDirectories(dest);
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(src)) {
            for (Path child : ds) {
                // Resolve real path to follow symlinks and then verify it stays within jail
                Path realChild = child.toRealPath();
                if (!realChild.startsWith(base)) {
                    throw new SecurityException("Symlink escape blocked during copy: " + child);
                }
                Path childDest = dest.resolve(child.getFileName());
                if (!childDest.normalize().startsWith(base)) {
                    throw new SecurityException("Path traversal blocked during copy: " + childDest);
                }
                if (Files.isDirectory(child)) copyDirRecursive(base, child, childDest);
                else Files.copy(child, childDest, StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }

    public void delete(String locationId, String path) throws IOException {
        log.info("delete locationId={} path={}", locationId, path);
        Path base = locationService.resolveBase(locationId);
        Path target = PathJail.resolve(base, path);
        if (!Files.exists(target)) throw new NoSuchFileException(path);
        try {
            if (Files.isDirectory(target)) {
                deleteDirectoryRecursive(target);
            } else {
                Files.delete(target);
            }
        } catch (IOException e) {
            log.error("delete failed locationId={} path={}", locationId, path, e);
            throw e;
        }
    }

    private void deleteDirectoryRecursive(Path dir) throws IOException {
        try (Stream<Path> walk = Files.walk(dir)) {
            List<Path> sorted = walk.sorted(Comparator.reverseOrder()).toList();
            for (Path p : sorted) {
                try {
                    Files.delete(p);
                } catch (IOException e) {
                    log.warn("Could not delete {}", p, e);
                    throw new IOException("Failed to delete " + p + ": " + e.getMessage(), e);
                }
            }
        }
    }

    private static void rejectUnsafeName(String name) {
        if (name == null || name.contains("/") || name.contains("\\") || name.contains("..")) {
            log.warn("Rejected invalid name: {}", name);
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Invalid name: " + name);
        }
    }
}
