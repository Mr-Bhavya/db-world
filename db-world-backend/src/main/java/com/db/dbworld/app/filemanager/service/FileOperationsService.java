package com.db.dbworld.app.filemanager.service;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.mapper.FileMetadataMapper;
import com.db.dbworld.app.filemanager.path.PathJail;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.infrastructure.storage.MediaDiskGuard;
import jakarta.annotation.Nonnull;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.FileVisitResult;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Location-aware file operations: list/search/info/mkdir/rename/move/copy/delete. */
@Log4j2
@Service
@RequiredArgsConstructor
public class FileOperationsService {

    private static final int DEFAULT_SEARCH_RESULTS = 200;
    private static final int MAX_SEARCH_RESULTS = 1000;
    private static final int MAX_SEARCH_DEPTH = 8;

    private final FileLocationService locationService;
    private final MediaDiskGuard mediaDiskGuard;

    public FileListDto list(String locationId, String path, String sortBy, String order) throws IOException {
        log.debug("list locationId={} path={} sortBy={} order={}", locationId, path, sortBy, order);
        Path base = locationService.resolveBase(locationId);
        Path dir = PathJail.resolve(base, path);
        if (!Files.isDirectory(dir)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Not a directory: " + path);

        List<FileItemDto> items = new ArrayList<>();
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir)) {
            for (Path entry : ds) {
                try { items.add(FileMetadataMapper.toDto(locationId, base, entry, false)); } catch (IOException ignored) { /* Skip an entry that vanished or is unreadable; the rest of the listing stands. */ }
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
        return search(locationId, path, query, recursive, DEFAULT_SEARCH_RESULTS);
    }

    /** {@code limit} is clamped to 1..{@value #MAX_SEARCH_RESULTS}; a result list of exactly {@code limit} means "maybe more". */
    public List<FileItemDto> search(String locationId, String path, String query, boolean recursive, int limit) throws IOException {
        log.debug("search locationId={} path={} query={} recursive={} limit={}", locationId, path, query, recursive, limit);
        Path base = locationService.resolveBase(locationId);
        Path root = PathJail.resolve(base, path);
        if (query == null || query.isBlank()) {
            return List.of();
        }
        int max = Math.clamp(limit, 1, MAX_SEARCH_RESULTS);
        List<FileItemDto> results = new ArrayList<>();
        String lowerQ = query.toLowerCase();

        if (recursive) {
            // walkFileTree (not Files.walk) so one unreadable sub-folder is skipped instead of
            // throwing UncheckedIOException and failing the whole search.
            Files.walkFileTree(root, java.util.EnumSet.noneOf(java.nio.file.FileVisitOption.class), MAX_SEARCH_DEPTH,
                new SimpleFileVisitor<>() {
                    @Override
                    public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                        if (!dir.equals(root)) collect(dir);
                        return results.size() >= max ? FileVisitResult.TERMINATE : FileVisitResult.CONTINUE;
                    }

                    @Override
                    public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                        collect(file);
                        return results.size() >= max ? FileVisitResult.TERMINATE : FileVisitResult.CONTINUE;
                    }

                    @Override
                    public FileVisitResult visitFileFailed(Path file, IOException exc) {
                        log.debug("search skipped unreadable {}: {}", file, exc.getMessage());
                        return FileVisitResult.CONTINUE;
                    }

                    private void collect(Path p) {
                        String fname = p.getFileName() != null ? p.getFileName().toString() : "";
                        if (!fname.toLowerCase().contains(lowerQ)) return;
                        try { results.add(FileMetadataMapper.toDto(locationId, base, p, false)); } catch (IOException ignored) { /* Skip an entry that vanished or is unreadable; the rest of the results stand. */ }
                    }
                });
        } else {
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(root)) {
                for (Path entry : ds) {
                    String fname = entry.getFileName() != null ? entry.getFileName().toString() : "";
                    if (fname.toLowerCase().contains(lowerQ)) {
                        try { results.add(FileMetadataMapper.toDto(locationId, base, entry, false)); } catch (IOException ignored) { /* Skip an entry that vanished or is unreadable; the rest of the results stand. */ }
                    }
                    if (results.size() >= max) break;
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
        PathJail.resolveReal(base, parentPath);
        requireMediaDisk("Creating the folder", parent);
        if (!Files.isDirectory(parent)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Parent path is not a directory: " + parentPath);
        rejectUnsafeName(name);
        Path newDir = PathJail.resolve(base, parentPath + "/" + name);
        if (Files.exists(newDir)) throw new DbWorldException(HttpStatus.CONFLICT, "A folder with that name already exists");
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
        requireSafeParent(base, source);
        requireMediaDisk("Renaming", source);
        rejectUnsafeName(newName);
        Path dest = PathJail.resolve(base, PathJail.toRelative(base, source.getParent()) + "/" + newName);
        if (Files.exists(dest, LinkOption.NOFOLLOW_LINKS)) {
            throw new DbWorldException(HttpStatus.CONFLICT, "A file with that name already exists");
        }
        try {
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
        requireSafeParent(base, source);
        requireMediaDisk("Moving", source, PathJail.resolve(base, destinationPath));
        Path destDir = PathJail.resolveReal(base, destinationPath); // dest dir must exist for a move, so symlink-following is safe
        if (!Files.isDirectory(destDir)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Destination must be a directory");
        Path dest = PathJail.resolve(base, destinationPath + "/" + source.getFileName().toString());
        if (Files.exists(dest, LinkOption.NOFOLLOW_LINKS)) {
            throw new DbWorldException(HttpStatus.CONFLICT, "A file with that name already exists in destination");
        }
        try {
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
        requireMediaDisk("Copying", PathJail.resolve(base, sourcePath), PathJail.resolve(base, destinationPath));
        Path source = PathJail.resolveReal(base, sourcePath); // symlink-sensitive: following a link must not escape the jail
        Path destDir = PathJail.resolveReal(base, destinationPath); // dest dir must exist for a copy, so symlink-following is safe
        if (!Files.isDirectory(destDir)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Destination must be a directory");
        Path dest = PathJail.resolve(base, destinationPath + "/" + source.getFileName().toString());
        if (Files.isDirectory(source) && destDir.startsWith(source)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Cannot copy a folder into itself or its descendants");
        }
        if (Files.exists(dest, LinkOption.NOFOLLOW_LINKS)) {
            throw new DbWorldException(HttpStatus.CONFLICT, "A file with that name already exists in destination");
        }
        try {
            if (Files.isDirectory(source)) {
                Path realDest = destDir.resolve(source.getFileName());
                copyDirRecursive(base.toRealPath(), source, realDest, realDest, new HashSet<>());
            } else {
                Files.copy(source, dest);
            }
        } catch (IOException e) {
            log.error("copyItem failed locationId={} source={} dest={}", locationId, sourcePath, destinationPath, e);
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Copy failed; an incomplete destination may remain in " + destinationPath, e);
        } catch (SecurityException e) {
            log.warn("copyItem blocked locationId={} source={} dest={}", locationId, sourcePath, destinationPath, e);
            throw new SecurityException("Copy blocked; an incomplete destination may remain in " + destinationPath, e);
        }
        return FileMetadataMapper.toDto(locationId, base, dest, false);
    }

    private void copyDirRecursive(Path base, Path src, Path dest, Path copyRoot, Set<Path> ancestors) throws IOException {
        Path realSource = src.toRealPath();
        if (!realSource.startsWith(base)) {
            throw new SecurityException("Symlink escape blocked during copy: " + src);
        }
        if (realSource.startsWith(copyRoot) || copyRoot.startsWith(realSource)) {
            throw new IOException("Copy source links to the destination: " + src);
        }
        if (!ancestors.add(realSource)) {
            throw new IOException("Symlink cycle detected during copy: " + src);
        }
        try {
            Files.createDirectory(dest);
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(realSource)) {
                for (Path child : ds) {
                    Path realChild = child.toRealPath();
                    if (!realChild.startsWith(base)) {
                        throw new SecurityException("Symlink escape blocked during copy: " + child);
                    }
                    Path childDest = dest.resolve(child.getFileName());
                    if (Files.isDirectory(realChild)) copyDirRecursive(base, realChild, childDest, copyRoot, ancestors);
                    else Files.copy(realChild, childDest);
                }
            }
        } finally {
            ancestors.remove(realSource);
        }
    }

    public void delete(String locationId, String path) throws IOException {
        log.info("delete locationId={} path={}", locationId, path);
        Path base = locationService.resolveBase(locationId);
        Path target = PathJail.resolve(base, path);
        requireMediaDisk("Deleting", target);
        if (target.equals(base.toAbsolutePath().normalize())) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Cannot delete the location root");
        }
        requireSafeParent(base, target);
        if (!Files.exists(target, LinkOption.NOFOLLOW_LINKS)) throw new NoSuchFileException(path);
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
        Files.walkFileTree(dir, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Files.delete(file);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult postVisitDirectory(Path directory, IOException error) throws IOException {
                if (error != null) throw error;
                Files.delete(directory);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private static void requireSafeParent(Path base, Path target) throws IOException {
        Path normalizedBase = base.toAbsolutePath().normalize();
        if (!target.equals(normalizedBase)) {
            PathJail.resolveReal(base, PathJail.toRelative(base, target.getParent()));
        }
    }

    /**
     * Refuses a write that touches the media tree while the media disk is missing: it would land
     * on the SD card under the empty mount point. Locations on other storage are not affected.
     */
    private void requireMediaDisk(String operation, Path... targets) {
        for (Path target : targets) mediaDiskGuard.requireMountedFor(target, operation);
    }

    private static void rejectUnsafeName(String name) {
        if (name == null || name.contains("/") || name.contains("\\") || name.contains("..")) {
            log.warn("Rejected invalid name: {}", name);
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Invalid name: " + name);
        }
    }
}
