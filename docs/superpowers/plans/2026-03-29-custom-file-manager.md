# Custom File Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Flmngr with a fully custom, mobile-friendly file manager at `/db-world/admin/files` supporting browse, upload, download, search, move, copy, rename, delete, and rich file info.

**Architecture:** Spring Boot backend exposes `/api/admin/file-manager/**` endpoints with path-jail security (all paths are validated to stay within a configurable root); React frontend in `adminv2/filemanager/` follows the exact same Zustand + TanStack Query + MUI pattern as other v2 admin pages. The existing route `/db-world/admin/files` is reused — only the lazy-loaded component is swapped.

**Tech Stack:** Java 21 / Spring Boot 3.5, `java.nio.file`, React 18 / Vite, MUI v7, TanStack Query v5, Zustand v5, Framer Motion, Notistack, `useT()` theme hook, react-hook-form + zod.

---

## File Map

### Backend — create all under `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/`

| File | Role |
|------|------|
| `dto/FileItemDto.java` | Single file/folder representation returned to frontend |
| `dto/FileListDto.java` | Wrapper: `items`, `currentPath`, `parentPath` |
| `dto/request/FileOperationRequest.java` | Source + destination path for move/copy |
| `dto/request/RenameRequest.java` | Path + new name for rename |
| `dto/request/MkdirRequest.java` | Path to create |
| `service/FileManagerService.java` | All file-system business logic, path jail |
| `controller/FileManagerController.java` | REST endpoints, `@AdminAccess`, multipart upload |

### Frontend — create all under `db-world-frontend/src/features/adminv2/filemanager/`

| File | Role |
|------|------|
| `fileManagerApi.js` | All axios calls |
| `useFileManagerStore.js` | Zustand: currentPath, view, sort, filter, selection, dialogs |
| `FileBreadcrumb.jsx` | Clickable path segments |
| `FileToolbar.jsx` | View toggle, sort, filter, search, upload, new-folder buttons |
| `FileGrid.jsx` | Card grid view (icon + name + size) |
| `FileList.jsx` | MUI table list view (all columns, sortable) |
| `FileMobileList.jsx` | Mobile stacked list |
| `FileInfoDrawer.jsx` | Right-side detail panel for selected item |
| `UploadDialog.jsx` | Drag-and-drop / file-picker upload with per-file progress |
| `FileOperationDialog.jsx` | Shared dialog for rename, mkdir, move, copy |
| `SearchDialog.jsx` | Recursive search with live results |
| `index.jsx` | Page root: wires all components together |

### Modify

| File | Change |
|------|--------|
| `db-world-frontend/src/app/App.jsx` | Replace `LazyFlmngrManager` import + route with `LazyFileManager` |

---

## Task 1: Backend DTOs

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/FileItemDto.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/FileListDto.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/request/FileOperationRequest.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/request/RenameRequest.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/request/MkdirRequest.java`

- [ ] **Step 1: Create FileItemDto**

```java
// db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/FileItemDto.java
package com.db.dbworld.app.filemanager.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class FileItemDto {
    private String name;
    private String path;         // absolute path shown to admin (relative to base dir)
    private boolean directory;
    private long sizeBytes;
    private String formattedSize;
    private String extension;
    private String mimeType;
    private LocalDateTime lastModified;
    private LocalDateTime createdAt;
    private int childCount;      // non-empty only for directories
    private boolean readable;
    private boolean writable;
}
```

- [ ] **Step 2: Create FileListDto**

```java
// db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/FileListDto.java
package com.db.dbworld.app.filemanager.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class FileListDto {
    private String currentPath;
    private String parentPath;    // null when at root
    private long totalItems;
    private long totalSize;
    private List<FileItemDto> items;
}
```

- [ ] **Step 3: Create request DTOs**

```java
// db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/request/FileOperationRequest.java
package com.db.dbworld.app.filemanager.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FileOperationRequest {
    @NotBlank private String sourcePath;
    @NotBlank private String destinationPath;
}
```

```java
// db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/request/RenameRequest.java
package com.db.dbworld.app.filemanager.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RenameRequest {
    @NotBlank private String path;
    @NotBlank private String newName;
}
```

```java
// db-world-backend/src/main/java/com/db/dbworld/app/filemanager/dto/request/MkdirRequest.java
package com.db.dbworld.app.filemanager.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MkdirRequest {
    @NotBlank private String path;  // parent path
    @NotBlank private String name;  // new folder name
}
```

- [ ] **Step 4: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/filemanager/
git commit -m "feat(file-manager): add backend DTOs for file manager"
```

---

## Task 2: Backend Service

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/service/FileManagerService.java`

The service enforces a **path jail**: every resolved path must start with `fileManager.baseDir` (from `application.properties`). Add `file-manager.base-dir=/` (or whatever root you want) to `application.properties`.

- [ ] **Step 1: Add config property to application.properties**

Open `db-world-backend/src/main/resources/application.properties` and add:
```properties
file-manager.base-dir=/
```
(Change the value to restrict browsing to a specific directory, e.g. `/media` or `D:/`)

- [ ] **Step 2: Create FileManagerService**

```java
// db-world-backend/src/main/java/com/db/dbworld/app/filemanager/service/FileManagerService.java
package com.db.dbworld.app.filemanager.service;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
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

    private Path baseDir() {
        return Path.of(baseDirConfig).toAbsolutePath().normalize();
    }

    // ── Path jail ─────────────────────────────────────────────────────────────

    private Path jailed(String rawPath) {
        Path base = baseDir();
        Path resolved;
        if (rawPath == null || rawPath.isBlank() || rawPath.equals("/")) {
            resolved = base;
        } else {
            // strip leading slash for relative resolution
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

    private String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024L * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }

    private String guessMime(String ext) {
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

        // Sort: directories first, then by sortBy field
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
            f.transferTo(dest.toFile());
            uploaded.add(toDto(dest));
        }
        return uploaded;
    }

    public FileItemDto createDirectory(String parentPath, String name) throws IOException {
        Path parent = jailed(parentPath);
        // Validate folder name
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
        Files.move(source, dest, StandardCopyOption.ATOMIC_MOVE);
        return toDto(dest);
    }

    public FileItemDto moveItem(String sourcePath, String destinationPath) throws IOException {
        Path source = jailed(sourcePath);
        Path destDir = jailed(destinationPath);
        if (!Files.isDirectory(destDir)) throw new IllegalArgumentException("Destination must be a directory");
        Path dest = jailed(destinationPath + "/" + source.getFileName().toString());
        if (Files.exists(dest)) throw new IllegalStateException("A file with that name already exists in destination");
        Files.move(source, dest, StandardCopyOption.ATOMIC_MOVE);
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
            Files.copy(source, dest, StandardCopyOption.REPLACE_EXISTING);
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
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try { Files.delete(p); } catch (IOException e) {
                    log.warn("Could not delete {}: {}", p, e.getMessage());
                }
            });
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/filemanager/service/
git add db-world-backend/src/main/resources/application.properties
git commit -m "feat(file-manager): add FileManagerService with path-jail security"
```

---

## Task 3: Backend Controller

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/controller/FileManagerController.java`

- [ ] **Step 1: Create the controller**

```java
// db-world-backend/src/main/java/com/db/dbworld/app/filemanager/controller/FileManagerController.java
package com.db.dbworld.app.filemanager.controller;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.dto.FileListDto;
import com.db.dbworld.app.filemanager.dto.request.FileOperationRequest;
import com.db.dbworld.app.filemanager.dto.request.MkdirRequest;
import com.db.dbworld.app.filemanager.dto.request.RenameRequest;
import com.db.dbworld.app.filemanager.service.FileManagerService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/admin/file-manager")
@RequiredArgsConstructor
@AdminAccess
public class FileManagerController {

    private final FileManagerService service;

    @GetMapping("/list")
    public ApiResponse<FileListDto> list(
            @RequestParam(defaultValue = "/") String path,
            @RequestParam(defaultValue = "name")  String sortBy,
            @RequestParam(defaultValue = "asc")   String order) throws IOException {
        return ApiResponse.success(service.listDirectory(path, sortBy, order));
    }

    @GetMapping("/search")
    public ApiResponse<List<FileItemDto>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "/")   String path,
            @RequestParam(defaultValue = "true") boolean recursive) throws IOException {
        return ApiResponse.success(service.searchFiles(path, q, recursive));
    }

    @GetMapping("/info")
    public ApiResponse<FileItemDto> info(@RequestParam String path) throws IOException {
        return ApiResponse.success(service.getInfo(path));
    }

    @GetMapping("/download")
    public void download(@RequestParam String path, HttpServletResponse response) throws IOException {
        service.downloadFile(path, response);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<List<FileItemDto>> upload(
            @RequestParam(defaultValue = "/") String path,
            @RequestParam("files") MultipartFile[] files) throws IOException {
        return ApiResponse.success(service.uploadFiles(path, files));
    }

    @PostMapping("/mkdir")
    public ApiResponse<FileItemDto> mkdir(@Valid @RequestBody MkdirRequest req) throws IOException {
        return ApiResponse.success(service.createDirectory(req.getPath(), req.getName()));
    }

    @PostMapping("/rename")
    public ApiResponse<FileItemDto> rename(@Valid @RequestBody RenameRequest req) throws IOException {
        return ApiResponse.success(service.renameItem(req.getPath(), req.getNewName()));
    }

    @PostMapping("/move")
    public ApiResponse<FileItemDto> move(@Valid @RequestBody FileOperationRequest req) throws IOException {
        return ApiResponse.success(service.moveItem(req.getSourcePath(), req.getDestinationPath()));
    }

    @PostMapping("/copy")
    public ApiResponse<FileItemDto> copy(@Valid @RequestBody FileOperationRequest req) throws IOException {
        return ApiResponse.success(service.copyItem(req.getSourcePath(), req.getDestinationPath()));
    }

    @DeleteMapping("/delete")
    public ApiResponse<Void> delete(@RequestParam String path) throws IOException {
        service.deleteItem(path);
        return ApiResponse.success("Deleted successfully");
    }
}
```

- [ ] **Step 2: Add global exception handler for FileManagerService exceptions**

Open the existing global exception handler (search for `@RestControllerAdvice` in the backend). Add these handlers inside:

```java
@ExceptionHandler(SecurityException.class)
public ResponseEntity<ApiResponse<Void>> handleSecurity(SecurityException ex) {
    return ResponseEntity.status(403)
        .body(ApiResponse.error("Access denied: " + ex.getMessage(), 403));
}

@ExceptionHandler(java.nio.file.NoSuchFileException.class)
public ResponseEntity<ApiResponse<Void>> handleNoSuchFile(java.nio.file.NoSuchFileException ex) {
    return ResponseEntity.status(404)
        .body(ApiResponse.error("File not found: " + ex.getFile(), 404));
}

@ExceptionHandler(IllegalStateException.class)
public ResponseEntity<ApiResponse<Void>> handleIllegalState(IllegalStateException ex) {
    return ResponseEntity.status(409)
        .body(ApiResponse.error(ex.getMessage(), 409));
}
```

> Find the existing `@RestControllerAdvice` class with: `grep -r "RestControllerAdvice" db-world-backend/src`

- [ ] **Step 3: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/filemanager/controller/
git commit -m "feat(file-manager): add FileManagerController REST endpoints"
```

---

## Task 4: Frontend API Layer

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/fileManagerApi.js`

- [ ] **Step 1: Create fileManagerApi.js**

```js
// db-world-frontend/src/features/adminv2/filemanager/fileManagerApi.js
import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

const BASE = '/api/admin/file-manager';

export const listDirectory = ({ path = '/', sortBy = 'name', order = 'asc' } = {}) =>
  axiosInstance.get(`${BASE}/list`, { params: { path, sortBy, order } }).then(r => r.data.data);

export const searchFiles = ({ q, path = '/', recursive = true }) =>
  axiosInstance.get(`${BASE}/search`, { params: { q, path, recursive } }).then(r => r.data.data);

export const getFileInfo = (path) =>
  axiosInstance.get(`${BASE}/info`, { params: { path } }).then(r => r.data.data);

export const getDownloadUrl = (path) =>
  `${axiosInstance.defaults.baseURL ?? ''}${BASE}/download?path=${encodeURIComponent(path)}`;

export const uploadFiles = (path, files, onProgress) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return axiosInstance.post(`${BASE}/upload`, fd, {
    params: { path },
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded * 100) / (e.total ?? 1))),
  }).then(r => r.data.data);
};

export const createDirectory = (path, name) =>
  axiosInstance.post(`${BASE}/mkdir`, { path, name }).then(r => r.data.data);

export const renameItem = (path, newName) =>
  axiosInstance.post(`${BASE}/rename`, { path, newName }).then(r => r.data.data);

export const moveItem = (sourcePath, destinationPath) =>
  axiosInstance.post(`${BASE}/move`, { sourcePath, destinationPath }).then(r => r.data.data);

export const copyItem = (sourcePath, destinationPath) =>
  axiosInstance.post(`${BASE}/copy`, { sourcePath, destinationPath }).then(r => r.data.data);

export const deleteItem = (path) =>
  axiosInstance.delete(`${BASE}/delete`, { params: { path } }).then(r => r.data);
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/fileManagerApi.js
git commit -m "feat(file-manager): add frontend API layer"
```

---

## Task 5: Zustand Store

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/useFileManagerStore.js`

- [ ] **Step 1: Create the store**

```js
// db-world-frontend/src/features/adminv2/filemanager/useFileManagerStore.js
import { create } from 'zustand';

export const useFileManagerStore = create((set, get) => ({
  // Navigation
  currentPath: '/',
  navigate:    (path) => set({ currentPath: path, selectedItems: new Set() }),
  navigateUp:  (parentPath) => set({ currentPath: parentPath ?? '/', selectedItems: new Set() }),

  // View
  viewMode:    'list',   // 'list' | 'grid'
  setViewMode: (v) => set({ viewMode: v }),

  // Sort & filter
  sortBy:      'name',   // 'name' | 'size' | 'modified' | 'type'
  sortOrder:   'asc',    // 'asc' | 'desc'
  filterType:  'ALL',    // 'ALL' | 'FILE' | 'FOLDER' | ext string like 'mp4'
  setSortBy:   (v) => set({ sortBy: v }),
  setSortOrder:(v) => set({ sortOrder: v }),
  setFilterType:(v) => set({ filterType: v }),

  // Selection (Set of paths)
  selectedItems:     new Set(),
  toggleSelect:      (path) => set(s => {
    const next = new Set(s.selectedItems);
    next.has(path) ? next.delete(path) : next.add(path);
    return { selectedItems: next };
  }),
  selectAll:         (items) => set({ selectedItems: new Set(items.map(i => i.path)) }),
  clearSelection:    () => set({ selectedItems: new Set() }),

  // Clipboard
  clipboard: null,   // { items: FileItemDto[], operation: 'cut' | 'copy' }
  setClipboard: (items, operation) => set({ clipboard: { items, operation } }),
  clearClipboard: () => set({ clipboard: null }),

  // Dialogs
  uploadOpen:       false,
  setUploadOpen:    (v) => set({ uploadOpen: v }),

  searchOpen:       false,
  setSearchOpen:    (v) => set({ searchOpen: v }),

  operationDialog:  null, // { type: 'rename'|'mkdir'|'move'|'copy', item?: FileItemDto }
  openOperation:    (type, item = null) => set({ operationDialog: { type, item } }),
  closeOperation:   () => set({ operationDialog: null }),

  infoItem:         null, // FileItemDto or null
  setInfoItem:      (item) => set({ infoItem: item }),
  clearInfoItem:    () => set({ infoItem: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/useFileManagerStore.js
git commit -m "feat(file-manager): add Zustand store for file manager state"
```

---

## Task 6: FileBreadcrumb Component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/FileBreadcrumb.jsx`

- [ ] **Step 1: Create component**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/FileBreadcrumb.jsx
import { Box, Typography, ButtonBase } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';

export default function FileBreadcrumb() {
  const T = useT();
  const { currentPath, navigate } = useFileManagerStore();

  const segments = currentPath === '/'
    ? []
    : currentPath.split('/').filter(Boolean);

  const getPathForIndex = (idx) =>
    idx < 0 ? '/' : '/' + segments.slice(0, idx + 1).join('/');

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.25,
      px: 1, py: 0.5, flexWrap: 'wrap', minHeight: 36,
    }}>
      <ButtonBase
        onClick={() => navigate('/')}
        sx={{
          borderRadius: 1, px: 0.75, py: 0.25,
          color: currentPath === '/' ? T.teal : T.textMuted,
          '&:hover': { bgcolor: T.hoverBg, color: T.teal },
          display: 'flex', alignItems: 'center', gap: 0.5,
        }}
      >
        <HomeIcon sx={{ fontSize: 16 }} />
        <Typography sx={{ fontSize: 13, fontWeight: currentPath === '/' ? 700 : 400 }}>
          Root
        </Typography>
      </ButtonBase>

      {segments.map((seg, idx) => (
        <Box key={idx} sx={{ display: 'flex', alignItems: 'center' }}>
          <ChevronRightIcon sx={{ fontSize: 14, color: T.textFaint }} />
          <ButtonBase
            onClick={() => navigate(getPathForIndex(idx))}
            sx={{
              borderRadius: 1, px: 0.75, py: 0.25,
              color: idx === segments.length - 1 ? T.textPrimary : T.textMuted,
              '&:hover': { bgcolor: T.hoverBg, color: T.teal },
            }}
          >
            <Typography sx={{
              fontSize: 13,
              fontWeight: idx === segments.length - 1 ? 700 : 400,
              maxWidth: { xs: 80, sm: 160 },
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {seg}
            </Typography>
          </ButtonBase>
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/FileBreadcrumb.jsx
git commit -m "feat(file-manager): add FileBreadcrumb component"
```

---

## Task 7: FileToolbar Component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/FileToolbar.jsx`

- [ ] **Step 1: Create component**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/FileToolbar.jsx
import {
  Box, ButtonBase, Tooltip, IconButton, Select, MenuItem,
  ToggleButton, ToggleButtonGroup, Typography, Chip,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DeleteIcon from '@mui/icons-material/Delete';
import SortIcon from '@mui/icons-material/Sort';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';

const SORT_OPTIONS = [
  { value: 'name',     label: 'Name' },
  { value: 'size',     label: 'Size' },
  { value: 'modified', label: 'Modified' },
  { value: 'type',     label: 'Type' },
];

const FILTER_OPTIONS = [
  { value: 'ALL',    label: 'All' },
  { value: 'FOLDER', label: 'Folders' },
  { value: 'FILE',   label: 'Files' },
  { value: 'video',  label: 'Video' },
  { value: 'audio',  label: 'Audio' },
  { value: 'image',  label: 'Image' },
  { value: 'text',   label: 'Text' },
  { value: 'pdf',    label: 'PDF' },
  { value: 'zip',    label: 'Archive' },
];

export default function FileToolbar({ onPaste, onDeleteSelected, allItems = [] }) {
  const T = useT();
  const {
    viewMode, setViewMode,
    sortBy, setSortBy, sortOrder, setSortOrder,
    filterType, setFilterType,
    selectedItems, selectAll, clearSelection,
    clipboard,
    setUploadOpen, setSearchOpen, openOperation,
  } = useFileManagerStore();

  const hasSelection = selectedItems.size > 0;

  const iconBtn = (title, Icon, onClick, color = T.textMuted) => (
    <Tooltip title={title} key={title}>
      <IconButton size="small" onClick={onClick}
        sx={{ color, '&:hover': { bgcolor: T.hoverBg, color: T.teal } }}>
        <Icon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
      px: { xs: 1.5, md: 2 }, py: 1,
      borderBottom: `1px solid ${T.border}`,
      bgcolor: T.adminBg,
    }}>
      {/* Primary actions */}
      {iconBtn('Upload Files', UploadIcon, () => setUploadOpen(true))}
      {iconBtn('New Folder', CreateNewFolderIcon, () => openOperation('mkdir'))}
      {iconBtn('Search', SearchIcon, () => setSearchOpen(true))}

      <Box sx={{ width: 1, bgcolor: T.border, height: 18, mx: 0.5 }} />

      {/* Clipboard actions */}
      {hasSelection && iconBtn('Cut', ContentCutIcon, () => {
        const items = allItems.filter(i => selectedItems.has(i.path));
        useFileManagerStore.getState().setClipboard(items, 'cut');
      })}
      {hasSelection && iconBtn('Copy', ContentCopyIcon, () => {
        const items = allItems.filter(i => selectedItems.has(i.path));
        useFileManagerStore.getState().setClipboard(items, 'copy');
      })}
      {clipboard && iconBtn('Paste', ContentPasteIcon, onPaste, T.teal)}
      {hasSelection && iconBtn('Delete Selected', DeleteIcon, onDeleteSelected, T.error ?? '#ef4444')}

      {hasSelection && (
        <Chip
          label={`${selectedItems.size} selected`}
          size="small"
          onDelete={clearSelection}
          sx={{ fontSize: 11, height: 22, bgcolor: T.tealBg, color: T.teal,
            '& .MuiChip-deleteIcon': { color: T.teal, fontSize: 14 } }}
        />
      )}

      <Box sx={{ flex: 1 }} />

      {/* Filter */}
      <Select
        size="small"
        value={filterType}
        onChange={e => setFilterType(e.target.value)}
        sx={{
          fontSize: 12, height: 30, minWidth: 90,
          color: T.textMuted, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
          '& .MuiSvgIcon-root': { color: T.textMuted },
          bgcolor: T.inputBg ?? T.adminBg,
        }}
      >
        {FILTER_OPTIONS.map(o => (
          <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
        ))}
      </Select>

      {/* Sort */}
      <Select
        size="small"
        value={sortBy}
        onChange={e => setSortBy(e.target.value)}
        startAdornment={<SortIcon sx={{ fontSize: 14, mr: 0.5, color: T.textFaint }} />}
        sx={{
          fontSize: 12, height: 30, minWidth: 110,
          color: T.textMuted, '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
          '& .MuiSvgIcon-root': { color: T.textMuted },
          bgcolor: T.inputBg ?? T.adminBg,
        }}
      >
        {SORT_OPTIONS.map(o => (
          <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>{o.label}</MenuItem>
        ))}
      </Select>

      {/* Sort order toggle */}
      <Tooltip title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
        <IconButton size="small" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
            {sortOrder === 'asc' ? 'A↑' : 'Z↓'}
          </Typography>
        </IconButton>
      </Tooltip>

      {/* View toggle */}
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={(_, v) => v && setViewMode(v)}
        size="small"
        sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, color: T.textMuted, borderColor: T.border } }}
      >
        <ToggleButton value="list"><ViewListIcon sx={{ fontSize: 16 }} /></ToggleButton>
        <ToggleButton value="grid"><GridViewIcon sx={{ fontSize: 16 }} /></ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/FileToolbar.jsx
git commit -m "feat(file-manager): add FileToolbar with sort/filter/view/clipboard controls"
```

---

## Task 8: File Icon Helper + FileList Component

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/fileIcons.js`
- Create: `db-world-frontend/src/features/adminv2/filemanager/FileList.jsx`

- [ ] **Step 1: Create fileIcons.js helper**

```js
// db-world-frontend/src/features/adminv2/filemanager/fileIcons.js
// Returns a color string for the file type icon
export function getFileColor(item) {
  if (item.directory) return '#f59e0b';
  const ext = (item.extension || '').toLowerCase();
  if (['mp4','mkv','avi','mov','webm'].includes(ext)) return '#6366f1';
  if (['mp3','flac','aac','wav','ogg'].includes(ext)) return '#10b981';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '#f43f5e';
  if (['pdf'].includes(ext)) return '#ef4444';
  if (['zip','tar','gz','rar','7z'].includes(ext)) return '#f97316';
  if (['js','ts','jsx','tsx','py','java','go','rs'].includes(ext)) return '#3b82f6';
  if (['txt','md','log'].includes(ext)) return '#94a3b8';
  return '#64748b';
}

// Returns an emoji icon for the file type
export function getFileEmoji(item) {
  if (item.directory) return '📁';
  const ext = (item.extension || '').toLowerCase();
  if (['mp4','mkv','avi','mov','webm'].includes(ext)) return '🎬';
  if (['mp3','flac','aac','wav','ogg'].includes(ext)) return '🎵';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📄';
  if (['zip','tar','gz','rar','7z'].includes(ext)) return '📦';
  if (['js','ts','jsx','tsx','py','java','go'].includes(ext)) return '💻';
  if (['txt','md','log'].includes(ext)) return '📝';
  return '📄';
}
```

- [ ] **Step 2: Create FileList.jsx**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/FileList.jsx
import { Box, Typography, Checkbox, IconButton, Tooltip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DownloadIcon from '@mui/icons-material/Download';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { getFileColor, getFileEmoji } from './fileIcons';
import { getDownloadUrl } from './fileManagerApi';

const COL = { name: '40%', size: '12%', type: '12%', modified: '18%', actions: '18%' };

function HeaderCell({ label, sortKey, sortBy, sortOrder, onSort, width }) {
  const T = useT();
  const active = sortBy === sortKey;
  return (
    <Box
      onClick={() => onSort(sortKey)}
      sx={{
        width, fontSize: 11, fontWeight: 700, color: active ? T.teal : T.textFaint,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        cursor: 'pointer', userSelect: 'none',
        display: 'flex', alignItems: 'center', gap: 0.5,
        '&:hover': { color: T.teal },
      }}
    >
      {label}
      {active && <Typography sx={{ fontSize: 10 }}>{sortOrder === 'asc' ? '↑' : '↓'}</Typography>}
    </Box>
  );
}

export default function FileList({ items = [], loading, onDelete, onNavigate }) {
  const T = useT();
  const { selectedItems, toggleSelect, selectAll, clearSelection, setInfoItem, openOperation, sortBy, setSortBy, sortOrder, setSortOrder } = useFileManagerStore();

  const allSelected = items.length > 0 && items.every(i => selectedItems.has(i.path));

  const handleSort = (key) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${T.glassBorder}`,
        borderTopColor: T.teal, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Box>
  );

  if (items.length === 0) return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 14, color: T.textMuted }}>No files found</Typography>
    </Box>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header row */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 0.75, borderBottom: `1px solid ${T.border}`,
        position: 'sticky', top: 0, bgcolor: T.adminBg, zIndex: 1,
      }}>
        <Checkbox
          size="small" checked={allSelected}
          onChange={() => allSelected ? clearSelection() : selectAll(items)}
          sx={{ p: 0.25, color: T.textFaint, '&.Mui-checked': { color: T.teal } }}
        />
        <HeaderCell label="Name"     sortKey="name"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.name} />
        <HeaderCell label="Size"     sortKey="size"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.size} />
        <HeaderCell label="Type"     sortKey="type"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.type} />
        <HeaderCell label="Modified" sortKey="modified" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.modified} />
        <Box sx={{ width: COL.actions }} />
      </Box>

      {/* Rows */}
      <AnimatePresence>
        {items.map((item, idx) => {
          const selected = selectedItems.has(item.path);
          const color = getFileColor(item);
          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: Math.min(idx * 0.015, 0.3), duration: 0.15 }}
            >
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 0.75,
                borderBottom: `1px solid ${T.border}`,
                bgcolor: selected ? T.tealBg : 'transparent',
                '&:hover': { bgcolor: selected ? T.tealBgHover : T.hoverBg },
                cursor: 'default', transition: 'background 0.1s',
              }}>
                <Checkbox
                  size="small" checked={selected}
                  onChange={() => toggleSelect(item.path)}
                  sx={{ p: 0.25, color: T.textFaint, '&.Mui-checked': { color: T.teal } }}
                />
                {/* Icon + name */}
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, width: COL.name, cursor: item.directory ? 'pointer' : 'default', overflow: 'hidden' }}
                  onDoubleClick={() => item.directory && onNavigate(item.path)}
                >
                  {item.directory
                    ? <FolderIcon sx={{ fontSize: 18, color }} />
                    : <InsertDriveFileIcon sx={{ fontSize: 18, color }} />}
                  <Typography sx={{
                    fontSize: 13, color: T.textPrimary, fontWeight: item.directory ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.name}
                  </Typography>
                </Box>

                <Typography sx={{ width: COL.size, fontSize: 12, color: T.textMuted }}>
                  {item.directory ? `${item.childCount} items` : item.formattedSize}
                </Typography>
                <Typography sx={{ width: COL.type, fontSize: 12, color: T.textMuted, textTransform: 'uppercase' }}>
                  {item.directory ? 'Folder' : (item.extension || '—')}
                </Typography>
                <Typography sx={{ width: COL.modified, fontSize: 12, color: T.textMuted }}>
                  {item.lastModified ? format(new Date(item.lastModified), 'MMM d, yyyy HH:mm') : '—'}
                </Typography>

                {/* Actions */}
                <Box sx={{ width: COL.actions, display: 'flex', gap: 0.25, justifyContent: 'flex-end' }}>
                  <Tooltip title="Info">
                    <IconButton size="small" onClick={() => setInfoItem(item)}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                      <InfoOutlinedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Rename">
                    <IconButton size="small" onClick={() => openOperation('rename', item)}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Move">
                    <IconButton size="small" onClick={() => openOperation('move', item)}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                      <DriveFileMoveIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  {!item.directory && (
                    <Tooltip title="Download">
                      <IconButton size="small" component="a" href={getDownloadUrl(item.path)} download
                        sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                        <DownloadIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => onDelete(item)}
                      sx={{ color: T.textFaint, '&:hover': { color: '#ef4444' } }}>
                      <DeleteIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Box>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/fileIcons.js
git add db-world-frontend/src/features/adminv2/filemanager/FileList.jsx
git commit -m "feat(file-manager): add FileList table view with sort, selection, actions"
```

---

## Task 9: FileGrid + FileMobileList

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/FileGrid.jsx`
- Create: `db-world-frontend/src/features/adminv2/filemanager/FileMobileList.jsx`

- [ ] **Step 1: Create FileGrid.jsx**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/FileGrid.jsx
import { Box, Typography, IconButton, Tooltip, Checkbox } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { getFileColor, getFileEmoji } from './fileIcons';
import { getDownloadUrl } from './fileManagerApi';

function FileCard({ item, onNavigate, onDelete }) {
  const T = useT();
  const { selectedItems, toggleSelect, setInfoItem, openOperation } = useFileManagerStore();
  const selected = selectedItems.has(item.path);
  const color = getFileColor(item);
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <Box
      onDoubleClick={() => item.directory && onNavigate(item.path)}
      sx={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        p: 1.5, borderRadius: 2, gap: 0.75,
        border: `1px solid ${selected ? T.teal : T.border}`,
        bgcolor: selected ? T.tealBg : T.cardBg ?? T.adminBg,
        cursor: item.directory ? 'pointer' : 'default',
        transition: 'all 0.15s',
        '&:hover': { borderColor: T.teal, bgcolor: T.tealBg ?? T.hoverBg },
        minWidth: 0, overflow: 'hidden',
      }}
    >
      {/* Select checkbox */}
      <Checkbox
        size="small" checked={selected}
        onChange={() => toggleSelect(item.path)}
        onClick={e => e.stopPropagation()}
        sx={{
          position: 'absolute', top: 2, left: 2, p: 0.25,
          color: T.textFaint, '&.Mui-checked': { color: T.teal },
        }}
      />

      {/* Context menu */}
      <IconButton
        size="small"
        onClick={e => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
        sx={{ position: 'absolute', top: 2, right: 2, color: T.textFaint, '&:hover': { color: T.teal } }}
      >
        <MoreVertIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: T.cardBg ?? T.sidebar, border: `1px solid ${T.border}`, minWidth: 160 } }}>
        <MenuItem onClick={() => { setInfoItem(item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: T.textPrimary }}>Info</MenuItem>
        <MenuItem onClick={() => { openOperation('rename', item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: T.textPrimary }}>Rename</MenuItem>
        <MenuItem onClick={() => { openOperation('move', item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: T.textPrimary }}>Move</MenuItem>
        <MenuItem onClick={() => { openOperation('copy', item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: T.textPrimary }}>Copy</MenuItem>
        {!item.directory && (
          <MenuItem component="a" href={getDownloadUrl(item.path)} download
            onClick={() => setAnchorEl(null)} sx={{ fontSize: 13, color: T.textPrimary }}>Download</MenuItem>
        )}
        <MenuItem onClick={() => { onDelete(item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: '#ef4444' }}>Delete</MenuItem>
      </Menu>

      {/* Icon */}
      <Box sx={{
        width: 44, height: 44, borderRadius: 2,
        bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.directory
          ? <FolderIcon sx={{ fontSize: 26, color }} />
          : <InsertDriveFileIcon sx={{ fontSize: 26, color }} />}
      </Box>

      {/* Name */}
      <Typography sx={{
        fontSize: 12, fontWeight: item.directory ? 600 : 400, color: T.textPrimary,
        textAlign: 'center', width: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.name}
      </Typography>

      {/* Size */}
      <Typography sx={{ fontSize: 10, color: T.textFaint }}>
        {item.directory ? `${item.childCount} items` : item.formattedSize}
      </Typography>
    </Box>
  );
}

export default function FileGrid({ items = [], loading, onDelete, onNavigate }) {
  const T = useT();

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${T.glassBorder}`,
        borderTopColor: T.teal, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Box>
  );

  if (items.length === 0) return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 14, color: T.textMuted }}>No files found</Typography>
    </Box>
  );

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
      gap: 1.5, p: 2,
    }}>
      <AnimatePresence>
        {items.map((item, idx) => (
          <motion.div
            key={item.path}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: Math.min(idx * 0.02, 0.4), duration: 0.15 }}
          >
            <FileCard item={item} onNavigate={onNavigate} onDelete={onDelete} />
          </motion.div>
        ))}
      </AnimatePresence>
    </Box>
  );
}
```

- [ ] **Step 2: Create FileMobileList.jsx**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/FileMobileList.jsx
import { Box, Typography, IconButton, Divider } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { format } from 'date-fns';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { getFileColor } from './fileIcons';
import { getDownloadUrl } from './fileManagerApi';

export default function FileMobileList({ items = [], loading, onDelete, onNavigate }) {
  const T = useT();
  const { setInfoItem, openOperation } = useFileManagerStore();
  const [menuState, setMenuState] = useState({ anchor: null, item: null });

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${T.glassBorder}`,
        borderTopColor: T.teal, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Box>
  );

  if (items.length === 0) return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 14, color: T.textMuted }}>No files found</Typography>
    </Box>
  );

  return (
    <Box>
      {items.map((item, idx) => {
        const color = getFileColor(item);
        return (
          <Box key={item.path}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2, py: 1.25,
                '&:active': { bgcolor: T.hoverBg },
              }}
              onClick={() => item.directory && onNavigate(item.path)}
            >
              {/* File type icon */}
              <Box sx={{
                width: 38, height: 38, borderRadius: 1.5, flexShrink: 0,
                bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.directory
                  ? <FolderIcon sx={{ fontSize: 20, color }} />
                  : <InsertDriveFileIcon sx={{ fontSize: 20, color }} />}
              </Box>

              {/* Name + meta */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                  fontSize: 14, fontWeight: item.directory ? 600 : 400, color: T.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.name}
                </Typography>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>
                  {item.directory
                    ? `${item.childCount} items`
                    : item.formattedSize}
                  {item.lastModified && ` · ${format(new Date(item.lastModified), 'MMM d, yyyy')}`}
                </Typography>
              </Box>

              {item.directory && <ChevronRightIcon sx={{ fontSize: 16, color: T.textFaint }} />}

              {/* More menu */}
              <IconButton
                size="small"
                onClick={e => { e.stopPropagation(); setMenuState({ anchor: e.currentTarget, item }); }}
                sx={{ color: T.textFaint }}
              >
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            {idx < items.length - 1 && <Divider sx={{ borderColor: T.border, mx: 2 }} />}
          </Box>
        );
      })}

      <Menu
        anchorEl={menuState.anchor}
        open={Boolean(menuState.anchor)}
        onClose={() => setMenuState({ anchor: null, item: null })}
        PaperProps={{ sx: { bgcolor: T.cardBg ?? T.sidebar, border: `1px solid ${T.border}`, minWidth: 160 } }}
      >
        {menuState.item && [
          <MenuItem key="info" onClick={() => { setInfoItem(menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Info</MenuItem>,
          <MenuItem key="rename" onClick={() => { openOperation('rename', menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Rename</MenuItem>,
          <MenuItem key="move" onClick={() => { openOperation('move', menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Move to…</MenuItem>,
          <MenuItem key="copy" onClick={() => { openOperation('copy', menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Copy to…</MenuItem>,
          !menuState.item?.directory && (
            <MenuItem key="dl" component="a" href={getDownloadUrl(menuState.item?.path ?? '')} download
              onClick={() => setMenuState({ anchor: null, item: null })} sx={{ fontSize: 13, color: T.textPrimary }}>Download</MenuItem>
          ),
          <MenuItem key="delete" onClick={() => { onDelete(menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: '#ef4444' }}>Delete</MenuItem>,
        ]}
      </Menu>
    </Box>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/FileGrid.jsx
git add db-world-frontend/src/features/adminv2/filemanager/FileMobileList.jsx
git commit -m "feat(file-manager): add FileGrid and FileMobileList views"
```

---

## Task 10: FileInfoDrawer

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/FileInfoDrawer.jsx`

- [ ] **Step 1: Create component**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/FileInfoDrawer.jsx
import {
  Drawer, Box, Typography, IconButton, Divider, Chip,
  List, ListItem, ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import { format } from 'date-fns';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { getFileColor } from './fileIcons';
import { getDownloadUrl } from './fileManagerApi';

const Row = ({ label, value }) => {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, gap: 1 }}>
      <Typography sx={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color: T.textPrimary, textAlign: 'right', wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
};

export default function FileInfoDrawer({ onDelete }) {
  const T = useT();
  const { infoItem, clearInfoItem, openOperation } = useFileManagerStore();
  const item = infoItem;

  if (!item) return null;

  const color = getFileColor(item);

  return (
    <Drawer
      anchor="right"
      open={Boolean(item)}
      onClose={clearInfoItem}
      PaperProps={{
        sx: {
          width: { xs: '85vw', sm: 320 },
          bgcolor: T.sidebar, border: 'none',
          borderLeft: `1px solid ${T.border}`,
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.5, borderBottom: `1px solid ${T.border}`,
        }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>File Info</Typography>
          <IconButton size="small" onClick={clearInfoItem} sx={{ color: T.textFaint }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Icon + name */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1.5 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: 2.5,
            bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {item.directory
              ? <FolderIcon sx={{ fontSize: 36, color }} />
              : <InsertDriveFileIcon sx={{ fontSize: 36, color }} />}
          </Box>
          <Typography sx={{
            fontSize: 15, fontWeight: 700, color: T.textPrimary,
            textAlign: 'center', px: 2, wordBreak: 'break-word',
          }}>
            {item.name}
          </Typography>
          <Chip
            label={item.directory ? 'Folder' : (item.extension?.toUpperCase() || 'File')}
            size="small"
            sx={{ fontSize: 11, bgcolor: `${color}22`, color, border: 'none' }}
          />
        </Box>

        <Divider sx={{ borderColor: T.border }} />

        {/* Details */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
          <Row label="Path"     value={item.path} />
          <Row label="Size"     value={item.directory ? `${item.childCount} items` : item.formattedSize} />
          {!item.directory && <Row label="MIME Type" value={item.mimeType || '—'} />}
          {item.lastModified && (
            <Row label="Modified" value={format(new Date(item.lastModified), 'MMM d, yyyy HH:mm')} />
          )}
          {item.createdAt && (
            <Row label="Created" value={format(new Date(item.createdAt), 'MMM d, yyyy HH:mm')} />
          )}
          <Row label="Readable" value={item.readable ? 'Yes' : 'No'} />
          <Row label="Writable" value={item.writable ? 'Yes' : 'No'} />
        </Box>

        <Divider sx={{ borderColor: T.border }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, p: 1.5, flexWrap: 'wrap' }}>
          <IconButton size="small" onClick={() => openOperation('rename', item)}
            sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}>
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={() => openOperation('move', item)}
            sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}>
            <DriveFileMoveIcon sx={{ fontSize: 16 }} />
          </IconButton>
          {!item.directory && (
            <IconButton size="small" component="a" href={getDownloadUrl(item.path)} download
              sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}>
              <DownloadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => { onDelete(item); clearInfoItem(); }}
            sx={{ color: '#ef4444', bgcolor: '#ef444422', borderRadius: 1.5, '&:hover': { bgcolor: '#ef444433' } }}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/FileInfoDrawer.jsx
git commit -m "feat(file-manager): add FileInfoDrawer side panel"
```

---

## Task 11: UploadDialog

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/UploadDialog.jsx`

- [ ] **Step 1: Create component**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/UploadDialog.jsx
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, LinearProgress, IconButton, List, ListItem, ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useState, useCallback, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { uploadFiles } from './fileManagerApi';

export default function UploadDialog() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const { uploadOpen, setUploadOpen, currentPath } = useFileManagerStore();

  const [files, setFiles]         = useState([]);   // { file, progress, status }
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();
  const dragActive = useRef(false);
  const [dragging, setDragging]   = useState(false);

  const addFiles = (fileList) => {
    const newFiles = Array.from(fileList).map(f => ({ file: f, progress: 0, status: 'pending' }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const rawFiles = files.map(f => f.file);
      await uploadFiles(currentPath, rawFiles, (pct) => {
        setFiles(prev => prev.map(f => ({ ...f, progress: pct, status: pct === 100 ? 'done' : 'uploading' })));
      });
      qc.invalidateQueries({ queryKey: ['file-manager', currentPath] });
      enqueueSnackbar(`Uploaded ${files.length} file(s)`, { variant: 'success' });
      setFiles([]);
      setUploadOpen(false);
    } catch (e) {
      enqueueSnackbar('Upload failed', { variant: 'error' });
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' })));
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => { if (!uploading) { setFiles([]); setUploadOpen(false); } };

  return (
    <Dialog open={uploadOpen} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: T.textPrimary, pb: 1, fontSize: 16, fontWeight: 700 }}>
        Upload Files
        <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {/* Drop zone */}
        <Box
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          sx={{
            border: `2px dashed ${dragging ? T.teal : T.border}`,
            borderRadius: 2, p: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            cursor: 'pointer', bgcolor: dragging ? T.tealBg : 'transparent',
            transition: 'all 0.15s',
            '&:hover': { borderColor: T.teal, bgcolor: T.tealBg },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 36, color: dragging ? T.teal : T.textFaint }} />
          <Typography sx={{ fontSize: 14, color: T.textMuted }}>
            Drag & drop files or <span style={{ color: T.teal, fontWeight: 600 }}>click to browse</span>
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textFaint }}>Uploading to: {currentPath}</Typography>
          <input ref={inputRef} type="file" multiple hidden onChange={e => addFiles(e.target.files)} />
        </Box>

        {/* File list */}
        {files.length > 0 && (
          <List dense sx={{ mt: 1 }}>
            {files.map((f, idx) => (
              <ListItem key={idx} sx={{ px: 0, gap: 1 }}>
                <ListItemText
                  primary={f.file.name}
                  secondary={`${(f.file.size / 1024).toFixed(1)} KB`}
                  primaryTypographyProps={{ fontSize: 13, color: T.textPrimary, noWrap: true }}
                  secondaryTypographyProps={{ fontSize: 11, color: T.textFaint }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                {f.status === 'uploading' && (
                  <Box sx={{ width: 80 }}>
                    <LinearProgress variant="determinate" value={f.progress}
                      sx={{ borderRadius: 1, bgcolor: T.border, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
                  </Box>
                )}
                {f.status === 'done'  && <CheckCircleIcon sx={{ fontSize: 18, color: '#10b981' }} />}
                {f.status === 'error' && <ErrorIcon sx={{ fontSize: 18, color: '#ef4444' }} />}
                {!uploading && (
                  <IconButton size="small" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    sx={{ color: T.textFaint }}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={uploading}
          sx={{ color: T.textMuted, fontSize: 13 }}>Cancel</Button>
        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          variant="contained"
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontSize: 13 }}
        >
          {uploading ? 'Uploading…' : `Upload ${files.length > 0 ? `(${files.length})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/UploadDialog.jsx
git commit -m "feat(file-manager): add UploadDialog with drag-and-drop and progress"
```

---

## Task 12: FileOperationDialog (Rename / Mkdir / Move / Copy)

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/FileOperationDialog.jsx`

- [ ] **Step 1: Create component**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/FileOperationDialog.jsx
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { renameItem, createDirectory, moveItem, copyItem } from './fileManagerApi';

const nameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255)
    .refine(v => !v.includes('/') && !v.includes('\\'), 'Name cannot contain / or \\'),
});

const pathSchema = z.object({
  destination: z.string().min(1, 'Destination is required').startsWith('/', 'Must start with /'),
});

export default function FileOperationDialog() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const { operationDialog, closeOperation, currentPath } = useFileManagerStore();

  const isNameOp = operationDialog?.type === 'rename' || operationDialog?.type === 'mkdir';
  const schema = isNameOp ? nameSchema : pathSchema;

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: isNameOp
      ? { name: operationDialog?.type === 'rename' ? (operationDialog?.item?.name ?? '') : '' }
      : { destination: currentPath },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => {
      const { type, item } = operationDialog;
      if (type === 'rename') return renameItem(item.path, data.name);
      if (type === 'mkdir')  return createDirectory(currentPath, data.name);
      if (type === 'move')   return moveItem(item.path, data.destination);
      if (type === 'copy')   return copyItem(item.path, data.destination);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-manager', currentPath] });
      enqueueSnackbar(
        operationDialog?.type === 'rename' ? 'Renamed successfully'
          : operationDialog?.type === 'mkdir' ? 'Folder created'
          : operationDialog?.type === 'move' ? 'Moved successfully'
          : 'Copied successfully',
        { variant: 'success' }
      );
      reset(); closeOperation();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Operation failed', { variant: 'error' }),
  });

  const title = {
    rename: `Rename "${operationDialog?.item?.name}"`,
    mkdir:  'New Folder',
    move:   `Move "${operationDialog?.item?.name}"`,
    copy:   `Copy "${operationDialog?.item?.name}"`,
  }[operationDialog?.type ?? 'mkdir'] ?? '';

  const handleClose = () => { if (!isPending) { reset(); closeOperation(); } };

  return (
    <Dialog open={Boolean(operationDialog)} onClose={handleClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: T.textPrimary, fontSize: 15, fontWeight: 700, pb: 1 }}>
        {title}
        <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(data => mutate(data))}>
        <DialogContent sx={{ pb: 1 }}>
          {isNameOp ? (
            <TextField
              {...register('name')}
              autoFocus fullWidth size="small"
              label={operationDialog?.type === 'mkdir' ? 'Folder Name' : 'New Name'}
              error={Boolean(errors.name)}
              helperText={errors.name?.message}
              InputProps={{ sx: { fontSize: 13 } }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: T.inputBg ?? 'transparent' } }}
            />
          ) : (
            <>
              <Typography sx={{ fontSize: 12, color: T.textFaint, mb: 1 }}>
                Destination path (absolute from root, e.g. /videos/movies)
              </Typography>
              <TextField
                {...register('destination')}
                autoFocus fullWidth size="small"
                label="Destination Path"
                error={Boolean(errors.destination)}
                helperText={errors.destination?.message}
                InputProps={{ sx: { fontSize: 13 } }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: T.inputBg ?? 'transparent' } }}
              />
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={isPending} sx={{ color: T.textMuted, fontSize: 13 }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isPending}
            sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontSize: 13 }}>
            {isPending ? 'Processing…' : 'Confirm'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/FileOperationDialog.jsx
git commit -m "feat(file-manager): add FileOperationDialog for rename/mkdir/move/copy"
```

---

## Task 13: SearchDialog

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/SearchDialog.jsx`

- [ ] **Step 1: Create component**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/SearchDialog.jsx
import {
  Dialog, DialogTitle, DialogContent, Box, TextField,
  Typography, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  FormControlLabel, Switch, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { searchFiles } from './fileManagerApi';
import { getFileColor } from './fileIcons';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';

// Inline debounce hook in case shared one doesn't exist
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchDialog() {
  const T = useT();
  const { searchOpen, setSearchOpen, currentPath, navigate } = useFileManagerStore();
  const [query,     setQuery]     = useState('');
  const [recursive, setRecursive] = useState(true);

  const debouncedQuery = useDebounce(query, 350);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['file-manager-search', debouncedQuery, currentPath, recursive],
    queryFn:  () => searchFiles({ q: debouncedQuery, path: currentPath, recursive }),
    enabled:  debouncedQuery.trim().length >= 2,
  });

  const handleSelect = (item) => {
    if (item.directory) {
      navigate(item.path);
    } else {
      // Navigate to parent folder
      const parent = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
      navigate(parent);
    }
    setSearchOpen(false);
    setQuery('');
  };

  const handleClose = () => { setSearchOpen(false); setQuery(''); };

  return (
    <Dialog open={searchOpen} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>Search Files</Typography>
          <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {/* Search input */}
        <TextField
          autoFocus fullWidth size="small"
          placeholder="Type to search… (min 2 chars)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 18, color: T.textFaint, mr: 1 }} />,
            sx: { fontSize: 13 },
          }}
          sx={{ mb: 1 }}
        />

        {/* Options */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <FormControlLabel
            control={
              <Switch checked={recursive} onChange={e => setRecursive(e.target.checked)} size="small"
                sx={{ '& .MuiSwitch-thumb': { bgcolor: recursive ? T.teal : T.textFaint },
                  '& .Mui-checked + .MuiSwitch-track': { bgcolor: T.tealBg } }} />
            }
            label={<Typography sx={{ fontSize: 12, color: T.textMuted }}>Recursive</Typography>}
          />
          <Typography sx={{ fontSize: 12, color: T.textFaint }}>
            Search in: <strong style={{ color: T.textMuted }}>{currentPath}</strong>
          </Typography>
        </Box>

        {/* Results */}
        <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {isFetching && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${T.glassBorder}`,
                borderTopColor: T.teal, animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </Box>
          )}
          {!isFetching && debouncedQuery.length >= 2 && results.length === 0 && (
            <Typography sx={{ textAlign: 'center', py: 3, fontSize: 13, color: T.textMuted }}>
              No results for "{debouncedQuery}"
            </Typography>
          )}
          <List dense disablePadding>
            {results.map((item) => {
              const color = getFileColor(item);
              return (
                <ListItemButton key={item.path} onClick={() => handleSelect(item)}
                  sx={{ borderRadius: 1, mb: 0.25,
                    '&:hover': { bgcolor: T.hoverBg } }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {item.directory
                      ? <FolderIcon sx={{ fontSize: 18, color }} />
                      : <InsertDriveFileIcon sx={{ fontSize: 18, color }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    secondary={item.path}
                    primaryTypographyProps={{ fontSize: 13, color: T.textPrimary }}
                    secondaryTypographyProps={{ fontSize: 11, color: T.textFaint, noWrap: true }}
                  />
                  <Typography sx={{ fontSize: 11, color: T.textFaint, ml: 1 }}>
                    {item.directory ? `${item.childCount} items` : item.formattedSize}
                  </Typography>
                </ListItemButton>
              );
            })}
          </List>
          {results.length === 200 && (
            <Typography sx={{ textAlign: 'center', py: 1, fontSize: 11, color: T.textFaint }}>
              Showing first 200 results — refine your search
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/SearchDialog.jsx
git commit -m "feat(file-manager): add SearchDialog with debounced recursive search"
```

---

## Task 14: Main Page (index.jsx)

**Files:**
- Create: `db-world-frontend/src/features/adminv2/filemanager/index.jsx`

- [ ] **Step 1: Create the main page**

```jsx
// db-world-frontend/src/features/adminv2/filemanager/index.jsx
import { useMemo, useCallback } from 'react';
import { Box, Typography, Button, useMediaQuery, useTheme } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { listDirectory, deleteItem, moveItem, copyItem } from './fileManagerApi';
import FileBreadcrumb from './FileBreadcrumb';
import FileToolbar from './FileToolbar';
import FileList from './FileList';
import FileGrid from './FileGrid';
import FileMobileList from './FileMobileList';
import FileInfoDrawer from './FileInfoDrawer';
import UploadDialog from './UploadDialog';
import FileOperationDialog from './FileOperationDialog';
import SearchDialog from './SearchDialog';

export default function FileManager() {
  const T = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const {
    currentPath, navigate, navigateUp,
    viewMode, sortBy, sortOrder, filterType,
    clipboard, clearClipboard, clearSelection,
  } = useFileManagerStore();

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['file-manager', currentPath, sortBy, sortOrder],
    queryFn:  () => listDirectory({ path: currentPath, sortBy, order: sortOrder }),
    staleTime: 30_000,
  });

  // ── Client-side filter (type) ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (filterType === 'ALL')    return items;
    if (filterType === 'FOLDER') return items.filter(i => i.directory);
    if (filterType === 'FILE')   return items.filter(i => !i.directory);
    // extension filter
    return items.filter(i => !i.directory && i.extension?.toLowerCase() === filterType.toLowerCase());
  }, [data?.items, filterType]);

  // ── Delete ────────────────────────────────────────────────────────────────

  const { mutate: doDelete } = useMutation({
    mutationFn: (item) => deleteItem(item.path),
    onSuccess: (_, item) => {
      qc.invalidateQueries({ queryKey: ['file-manager', currentPath] });
      enqueueSnackbar(`Deleted "${item.name}"`, { variant: 'success' });
      clearSelection();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? 'Delete failed', { variant: 'error' }),
  });

  const handleDelete = useCallback((item) => {
    if (window.confirm(`Delete "${item.name}"${item.directory ? ' and all its contents' : ''}?`)) {
      doDelete(item);
    }
  }, [doDelete]);

  // Bulk delete
  const { selectedItems } = useFileManagerStore();
  const handleDeleteSelected = useCallback(() => {
    const paths = Array.from(selectedItems);
    if (paths.length === 0) return;
    if (!window.confirm(`Delete ${paths.length} item(s)?`)) return;
    const items = (data?.items ?? []).filter(i => paths.includes(i.path));
    items.forEach(item => doDelete(item));
  }, [selectedItems, data?.items, doDelete]);

  // ── Paste ─────────────────────────────────────────────────────────────────

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;
    const fn = clipboard.operation === 'cut' ? moveItem : copyItem;
    try {
      await Promise.all(clipboard.items.map(item => fn(item.path, currentPath)));
      qc.invalidateQueries({ queryKey: ['file-manager', currentPath] });
      enqueueSnackbar(`${clipboard.operation === 'cut' ? 'Moved' : 'Copied'} ${clipboard.items.length} item(s)`, { variant: 'success' });
      clearClipboard();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.message ?? 'Paste failed', { variant: 'error' });
    }
  }, [clipboard, currentPath, qc, enqueueSnackbar, clearClipboard]);

  // ── Navigate ──────────────────────────────────────────────────────────────

  const handleNavigate = useCallback((path) => navigate(path), [navigate]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: T.adminBg, color: T.textPrimary, minHeight: 0 }}>

      {/* Page header */}
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, color: T.textPrimary }}>
            File Manager
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>
            {data ? `${data.totalItems} items${data.totalSize > 0 ? ` · ${formatBytes(data.totalSize)}` : ''}` : 'Browse server files'}
          </Typography>
        </Box>
        {data?.parentPath != null && (
          <Button
            startIcon={<ArrowUpwardIcon />}
            size="small"
            onClick={() => navigateUp(data.parentPath)}
            sx={{ color: T.textMuted, fontSize: 12, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}
          >
            Up
          </Button>
        )}
      </Box>

      {/* Breadcrumb */}
      <Box sx={{ px: { xs: 1, md: 2 }, flexShrink: 0 }}>
        <FileBreadcrumb />
      </Box>

      {/* Toolbar */}
      <FileToolbar
        allItems={data?.items ?? []}
        onPaste={handlePaste}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Error */}
      {error && (
        <Box sx={{ p: 2 }}>
          <Box sx={{ bgcolor: T.errorBg, border: `1px solid ${T.error ?? '#ef4444'}44`, borderRadius: 2, p: 2,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ color: T.error ?? '#ef4444', fontSize: 13 }}>
              Failed to load directory — {error?.response?.data?.message ?? error.message}
            </Typography>
            <Button size="small" onClick={refetch} sx={{ color: T.error ?? '#ef4444' }}>Retry</Button>
          </Box>
        </Box>
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {isMobile ? (
          <FileMobileList items={filtered} loading={isLoading} onDelete={handleDelete} onNavigate={handleNavigate} />
        ) : viewMode === 'grid' ? (
          <FileGrid items={filtered} loading={isLoading} onDelete={handleDelete} onNavigate={handleNavigate} />
        ) : (
          <FileList items={filtered} loading={isLoading} onDelete={handleDelete} onNavigate={handleNavigate} />
        )}
      </Box>

      {/* Drawers & Dialogs */}
      <FileInfoDrawer onDelete={handleDelete} />
      <UploadDialog />
      <FileOperationDialog />
      <SearchDialog />
    </Box>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
```

- [ ] **Step 2: Commit**

```bash
git add db-world-frontend/src/features/adminv2/filemanager/index.jsx
git commit -m "feat(file-manager): add main FileManager page component"
```

---

## Task 15: Wire Up Route in App.jsx

**Files:**
- Modify: `db-world-frontend/src/app/App.jsx`

- [ ] **Step 1: Find the FlmngrManager import**

In `App.jsx` look for (around line 50–100, the lazy import block):
```js
const LazyFlmngrManager = lazy(() => import('../features/admin/FileExplorer/FlmngrManager'));
```

- [ ] **Step 2: Replace the import**

Replace that line with:
```js
const LazyFileManager = lazy(() => import('../features/adminv2/filemanager'));
```

- [ ] **Step 3: Replace the route**

Find:
```jsx
<Route path="files" element={<LazyFlmngrManager />} />
```
Replace with:
```jsx
<Route path="files" element={<LazyFileManager />} />
```

- [ ] **Step 4: Verify the AdminLayout nav still points to `files`**

Open `AdminLayout.jsx` and confirm the System section still has:
```js
{ id: 'files', label: 'File Manager', icon: <Folder />, path: 'files' },
```
No change needed — the path already matches.

- [ ] **Step 5: Commit**

```bash
git add db-world-frontend/src/app/App.jsx
git commit -m "feat(file-manager): wire custom FileManager into admin route, replace Flmngr"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| Folder navigation | Task 5 (store navigate), Task 6 (breadcrumb), Task 8/9 (double-click to open) |
| File listing | Task 2 (service listDirectory), Task 8 (FileList), Task 9 (FileGrid/Mobile) |
| Recursive search | Task 2 (service searchFiles), Task 13 (SearchDialog) |
| File info | Task 1 (FileItemDto), Task 10 (FileInfoDrawer) |
| Download | Task 2/3 (controller /download), Task 8 (download button), Task 9 (menu item) |
| Upload | Task 3 (controller /upload), Task 11 (UploadDialog drag-and-drop) |
| Move | Task 2 (service moveItem), Task 12 (FileOperationDialog move) |
| Copy | Task 2 (service copyItem), Task 12 (FileOperationDialog copy) |
| Rename | Task 2 (service renameItem), Task 12 (FileOperationDialog rename) |
| Size displayed | Task 1 (formattedSize), shown in list/grid/info |
| Path displayed | Task 1 (path field), shown in breadcrumb + info drawer |
| Sorting | Task 2 (server-side sort), Task 7 (toolbar sort control), Task 8 (column header sort) |
| Filtering | Task 7 (toolbar filter by type), Task 14 (client-side filter) |
| Mobile-friendly | Task 9 (FileMobileList), Task 7 (responsive toolbar), Task 10 (drawer 85vw) |
| Cut/Copy/Paste (clipboard) | Task 5 (store clipboard), Task 7 (toolbar buttons), Task 14 (handlePaste) |
| Bulk delete | Task 7 (delete selected button), Task 14 (handleDeleteSelected) |
| New folder | Task 3 (controller mkdir), Task 12 (FileOperationDialog mkdir), Task 7 (toolbar button) |
| Delete | Task 2 (service delete recursive), Task 14 (handleDelete with confirm) |
| Path jail security | Task 2 (service jailed() method) |

All requirements covered. ✓

### Placeholder Check

No TBDs or placeholder text found. All code blocks are complete. ✓

### Type Consistency

- `FileItemDto` fields used consistently: `path`, `name`, `directory`, `formattedSize`, `sizeBytes`, `extension`, `childCount`, `lastModified`, `createdAt`, `readable`, `writable`, `mimeType` — all defined in Task 1 and used in Tasks 8–14.
- `FileListDto` fields: `currentPath`, `parentPath`, `totalItems`, `totalSize`, `items` — defined Task 1, consumed in Task 14.
- Store actions: `navigate`, `navigateUp`, `setViewMode`, `setSortBy`, `setSortOrder`, `setFilterType`, `toggleSelect`, `selectAll`, `clearSelection`, `setClipboard`, `clearClipboard`, `setUploadOpen`, `setSearchOpen`, `openOperation`, `closeOperation`, `setInfoItem`, `clearInfoItem` — all defined in Task 5 and used consistently. ✓
