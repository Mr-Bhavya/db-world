# File Manager Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin file manager with a production, multi-location, Drive/OneDrive-style manager supporting resumable 10 GB+ transfers, inline preview, and a polished responsive UI on web + Android.

**Architecture:** Decompose the 439-line `FileManagerService` monolith into single-responsibility backend units (`PathJail`, `FileMetadataMapper`, `FileLocationService`, `FileOperationsService`, `UploadSessionService`, `DownloadService`, preview services), each jailed to a DB-managed root location. Rebuild the React feature on the existing stack with a resumable chunk uploader, Zustand stores, TanStack Query hooks, and MUI + `useT()` components. Remove superseded code once verified.

**Tech Stack:** Spring Boot (JPA `ddl-auto: update`, Lombok, Log4j2), JUnit5 + Mockito + AssertJ; React + Vite, MUI, TanStack Query, Zustand, RHF + Zod, Framer Motion, Notistack, `useT()` theme, Capacitor; Vitest.

## Global Constraints

- **Backend build/test uses JDK 25.** Set `JAVA_HOME` to JDK 25 first; Maven wrapper is at `C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn`. Reference it as `$MVN`.
- **New tables via JPA auto-DDL** (`ddl-auto: update`). No migration file needed. Every `@Entity` uses `schema = "db_world"`, `@GeneratedValue(strategy = GenerationType.UUID)` `String` id `length 36`, Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`, `@CreationTimestamp/@UpdateTimestamp` `java.time.Instant`.
- **Authorization:** every management endpoint is class-level `@AdminAccess` (`hasAnyAuthority('OWNER','ADMIN')`). Only the ticket-gated public stream stays unauthenticated (added to `AppConstants.PUBLIC_APIS`).
- **Path safety:** every filesystem access goes through `PathJail` bound to a resolved location base — strip leading slashes, `normalize()`, `startsWith(base)`, and `toRealPath()` symlink guard. Names reject `/`, `\`, `..`.
- **Errors:** throw `new DbWorldException(HttpStatus.X, msg)`; wrap responses in `ApiResponse.success(...)`.
- **Backend tests:** plain JUnit5, mocks via `mock(Class.class)` in `@BeforeEach` (NO `@SpringBootTest`, NO `@ExtendWith`), AssertJ assertions.
- **Frontend:** unwrap envelope with `.then(r => r.data.data)`; TanStack Query keys namespaced `['file-manager', ...]`; snackbar variants `success|error|warning`; error text `e?.response?.data?.message ?? 'fallback'`; all colors from `useT()` tokens.
- **Chunk size default 8 MiB (8388608).** nginx `client_max_body_size` must be ≥ 16m (user infra action; NOT in this repo).
- **Upload collision default `fail`** (`onConflict ∈ {fail, rename, overwrite}`).
- DRY, YAGNI, TDD, frequent commits (one commit per task at minimum).

## File Structure

**Backend — `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/`**
- `path/PathJail.java` — reusable jail (base + rawPath → Path; toRelative).
- `mapper/FileMetadataMapper.java` — `Path` → `FileItemDto`; size/MIME helpers.
- `location/FileLocationEntity.java`, `FileLocationRepository.java`, `FileLocationService.java`, `FileLocationController.java`, `dto/FileLocationDto.java`, `dto/UpsertLocationRequest.java`.
- `service/FileOperationsService.java` — list/search/info/mkdir/rename/move/copy/delete (location-aware).
- `controller/FileManagerController.java` — rewritten, location-aware.
- `upload/UploadSessionEntity.java`, `UploadSessionRepository.java`, `UploadSessionService.java`, `UploadSweeper.java`, `FileUploadController.java`, `dto/InitUploadRequest.java`, `dto/UploadSessionDto.java`.
- `download/DownloadService.java`, `download/RangeStreamer.java`; `controller/FileDownloadStreamController.java` (ranged).
- `preview/ThumbnailService.java`, `preview/TextPreviewService.java`, `controller/FilePreviewController.java`.
- `dto/FileItemDto.java` — add `String locationId`. Keep `FileListDto`, `FileUploadResultDto`, `FileUploadErrorDto`.
- **Delete at end:** `service/FileManagerService.java`, old `dto/request/*` if unused.

**Frontend — `db-world-frontend/src/features/admin/filemanager/`**
- `api/fileManagerApi.js`; `upload/resumableUploader.js`; `store/useFileManagerStore.js`; `store/useUploadStore.js`.
- `hooks/useLocations.js`, `hooks/useDirectory.js`.
- `components/`: `LocationsRail.jsx`, `FolderTree.jsx`, `Breadcrumb.jsx`, `Toolbar.jsx`, `FileGrid.jsx`, `FileList.jsx`, `FileMobileList.jsx`, `ContextMenu.jsx`, `InfoDrawer.jsx`, `PreviewPanel.jsx`, `MoveCopyDialog.jsx`, `RenameDialog.jsx`, `NewFolderDialog.jsx`, `UploadTray.jsx`, `LocationManagerDialog.jsx`, `ConfirmDialog.jsx`, `fileIcons.js`.
- `index.jsx` — compose.
- `platform/android/walletDownload.js` — reuse `saveBlobNative` for Android download.
- **Delete at end:** old `fileManagerApi.js`, `useFileManagerStore.js`, `UploadDialog.jsx`, `FileOperationDialog.jsx`, `SearchDialog.jsx`, `FileBreadcrumb.jsx`, and any component with no successor.

---

## PHASE 1 — Backend foundation: PathJail + metadata mapper

### Task 1: `PathJail`

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/filemanager/path/PathJail.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/filemanager/path/PathJailTest.java`

**Interfaces:**
- Produces: `Path PathJail.resolve(Path base, String rawPath)`; `String PathJail.toRelative(Path base, Path p)`; `Path PathJail.resolveReal(Path base, String rawPath)` (follows symlinks, re-checks jail).

- [ ] **Step 1: Write the failing test**
```java
package com.db.dbworld.app.filemanager.path;

import org.junit.jupiter.api.Test;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.*;

class PathJailTest {
    final Path base = Path.of("/srv/dbworld").toAbsolutePath().normalize();

    @Test void resolvesRelativeUnderBase() {
        assertThat(PathJail.resolve(base, "/sub/dir")).isEqualTo(base.resolve("sub/dir"));
    }
    @Test void rootMapsToBase() {
        assertThat(PathJail.resolve(base, "/")).isEqualTo(base);
        assertThat(PathJail.resolve(base, null)).isEqualTo(base);
    }
    @Test void stripsLeadingSlashesSoNotAbsolute() {
        assertThat(PathJail.resolve(base, "//etc/passwd")).isEqualTo(base.resolve("etc/passwd"));
    }
    @Test void blocksTraversal() {
        assertThatThrownBy(() -> PathJail.resolve(base, "../../etc/passwd"))
            .isInstanceOf(SecurityException.class);
    }
    @Test void toRelativeRoundTrips() {
        Path p = base.resolve("a/b");
        assertThat(PathJail.toRelative(base, p)).isEqualTo("/a/b");
        assertThat(PathJail.toRelative(base, base)).isEqualTo("/");
    }
}
```
- [ ] **Step 2: Run to verify failure** — `JAVA_HOME=<jdk25> "$MVN" -pl db-world-backend test -Dtest=PathJailTest` → FAIL (class not found).
- [ ] **Step 3: Implement**
```java
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
```
- [ ] **Step 4: Run to verify pass** — same command → PASS.
- [ ] **Step 5: Commit** — `git add ...path/PathJail.java ...PathJailTest.java && git commit -m "feat(filemanager): reusable PathJail for per-location jailing"`

### Task 2: `FileMetadataMapper` + `FileItemDto.locationId`

**Files:**
- Modify: `db-world-backend/.../app/filemanager/dto/FileItemDto.java` (add `private String locationId;`)
- Create: `db-world-backend/.../app/filemanager/mapper/FileMetadataMapper.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/filemanager/mapper/FileMetadataMapperTest.java`

**Interfaces:**
- Consumes: `PathJail.toRelative`.
- Produces: `FileItemDto FileMetadataMapper.toDto(String locationId, Path base, Path p, boolean withChildCount) throws IOException`; `String formatSize(long)`; `String guessMime(String ext)`.

- [ ] **Step 1: Failing test**
```java
package com.db.dbworld.app.filemanager.mapper;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import org.junit.jupiter.api.*;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

class FileMetadataMapperTest {
    static Path base, file;
    @BeforeAll static void setup() throws Exception {
        base = Files.createTempDirectory("fm");
        file = Files.writeString(base.resolve("note.txt"), "hello");
    }
    @Test void mapsFileMetadata() throws Exception {
        FileItemDto d = FileMetadataMapper.toDto("loc1", base, file, false);
        assertThat(d.getName()).isEqualTo("note.txt");
        assertThat(d.getPath()).isEqualTo("/note.txt");
        assertThat(d.isDirectory()).isFalse();
        assertThat(d.getExtension()).isEqualTo("txt");
        assertThat(d.getMimeType()).isEqualTo("text/plain");
        assertThat(d.getLocationId()).isEqualTo("loc1");
        assertThat(d.getSizeBytes()).isEqualTo(5);
    }
    @Test void formatsSizes() {
        assertThat(FileMetadataMapper.formatSize(512)).isEqualTo("512 B");
        assertThat(FileMetadataMapper.formatSize(2048)).isEqualTo("2.0 KB");
    }
}
```
- [ ] **Step 2: Run → FAIL.** `... -Dtest=FileMetadataMapperTest`
- [ ] **Step 3: Implement** — port `toDto`/`formatSize`/`guessMime` from the old `FileManagerService` (lines 77–137) into a static utility, but parameterize on `(locationId, base, p, withChildCount)`, use `PathJail.toRelative(base, p)`, and only compute `childCount` via `Files.list().count()` when `withChildCount` is true (default false → fixes the per-row scan). Set `.locationId(locationId)` on the builder. Add `locationId` field to `FileItemDto`.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(filemanager): FileMetadataMapper + locationId on FileItemDto"`

---

## PHASE 2 — Locations (DB-managed roots)

### Task 3: `FileLocationEntity` + repository

**Files:**
- Create: `.../app/filemanager/location/FileLocationEntity.java`, `FileLocationRepository.java`

**Interfaces:**
- Produces: entity fields `{String id, String label, String absolutePath, boolean enabled, int sortOrder, Instant createdAt, updatedAt}`; repo `List<FileLocationEntity> findByEnabledTrueOrderBySortOrderAsc()`, `findAllByOrderBySortOrderAsc()`, `boolean existsByAbsolutePath(String)`.

- [ ] **Step 1: Implement entity** (mirror `WalletDocumentTypeEntity`)
```java
package com.db.dbworld.app.filemanager.location;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;

@Entity
@Table(name = "file_manager_location", schema = "db_world",
        uniqueConstraints = @UniqueConstraint(name = "uk_fm_location_path", columnNames = "absolute_path"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FileLocationEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;
    @Column(nullable = false, length = 120) private String label;
    @Column(name = "absolute_path", nullable = false, length = 1000) private String absolutePath;
    @Column(nullable = false) private boolean enabled;
    @Column(nullable = false) private int sortOrder;
    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;
}
```
```java
package com.db.dbworld.app.filemanager.location;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FileLocationRepository extends JpaRepository<FileLocationEntity, String> {
    List<FileLocationEntity> findByEnabledTrueOrderBySortOrderAsc();
    List<FileLocationEntity> findAllByOrderBySortOrderAsc();
    boolean existsByAbsolutePath(String absolutePath);
}
```
- [ ] **Step 2: Compile** — `... "$MVN" -pl db-world-backend compile -q` → succeeds.
- [ ] **Step 3: Commit** — `git commit -m "feat(filemanager): FileLocation entity + repository"`

### Task 4: `FileLocationService` (CRUD + validation + seed + resolve)

**Files:**
- Create: `.../location/FileLocationService.java`, `dto/FileLocationDto.java`, `dto/UpsertLocationRequest.java`
- Test: `src/test/java/com/db/dbworld/app/filemanager/location/FileLocationServiceTest.java`

**Interfaces:**
- Consumes: `FileLocationRepository`, `AppProperties.getDataPath()`.
- Produces: `List<FileLocationEntity> listAll()/listEnabled()`; `FileLocationEntity get(String id)`; `Path resolveBase(String id)` (throws `DbWorldException NOT_FOUND` if missing/disabled); `FileLocationEntity create(UpsertLocationRequest)`; `update(id, req)`; `void delete(id)`; `@PostConstruct seedDefault()`.

**DTOs:**
```java
// FileLocationDto.java
package com.db.dbworld.app.filemanager.location.dto;
import lombok.Builder; import lombok.Data; import java.time.Instant;
@Data @Builder
public class FileLocationDto {
    private String id; private String label; private String absolutePath;
    private boolean enabled; private int sortOrder; private boolean available; // available = path exists & readable now
    private Instant createdAt;
}
```
```java
// UpsertLocationRequest.java
package com.db.dbworld.app.filemanager.location.dto;
import jakarta.validation.constraints.NotBlank;
public record UpsertLocationRequest(@NotBlank String label, @NotBlank String absolutePath,
                                    Boolean enabled, Integer sortOrder) {}
```

- [ ] **Step 1: Failing test**
```java
package com.db.dbworld.app.filemanager.location;

import com.db.dbworld.app.filemanager.location.dto.UpsertLocationRequest;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.*;
import java.nio.file.*; import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FileLocationServiceTest {
    FileLocationRepository repo; AppProperties props; FileLocationService svc;
    Map<String, FileLocationEntity> store; Path realDir;

    @BeforeEach void setUp() throws Exception {
        repo = mock(FileLocationRepository.class); props = mock(AppProperties.class);
        realDir = Files.createTempDirectory("loc");
        store = new HashMap<>();
        when(repo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(repo.existsByAbsolutePath(any())).thenAnswer(a ->
            store.values().stream().anyMatch(l -> l.getAbsolutePath().equals(a.getArgument(0))));
        when(repo.save(any(FileLocationEntity.class))).thenAnswer(a -> {
            FileLocationEntity e = a.getArgument(0);
            if (e.getId() == null) e.setId("l-" + (store.size() + 1));
            store.put(e.getId(), e); return e;
        });
        svc = new FileLocationService(repo, props);
    }

    @Test void create_rejectsNonExistentPath() {
        assertThatThrownBy(() -> svc.create(new UpsertLocationRequest("Bad", "/no/such/dir", true, 0)))
            .isInstanceOf(DbWorldException.class);
    }
    @Test void create_acceptsRealDir_andResolvesBase() {
        FileLocationEntity e = svc.create(new UpsertLocationRequest("Data", realDir.toString(), true, 0));
        assertThat(svc.resolveBase(e.getId())).isEqualTo(realDir.toAbsolutePath().normalize());
    }
    @Test void resolveBase_missing_throwsNotFound() {
        assertThatThrownBy(() -> svc.resolveBase("nope")).isInstanceOf(DbWorldException.class);
    }
}
```
- [ ] **Step 2: Run → FAIL.** `... -Dtest=FileLocationServiceTest`
- [ ] **Step 3: Implement** — `@Log4j2 @Service @RequiredArgsConstructor`. `create`/`update` validate: `Path p = Path.of(req.absolutePath()).toAbsolutePath().normalize(); if (!Files.isDirectory(p) || !Files.isReadable(p)) throw new DbWorldException(HttpStatus.BAD_REQUEST, "Path is not a readable directory: " + p);` and reject duplicate `existsByAbsolutePath`. Store the normalized string. `resolveBase(id)` = `get(id)` (→ `NOT_FOUND` when absent) then require `enabled`, return `Path.of(absolutePath).toAbsolutePath().normalize()`. `@PostConstruct seedDefault()` — if `repo.count()==0`, save a location `label="Data"`, `absolutePath=props.getDataPath().toString()`, `enabled=true`, `sortOrder=0` (idempotent, try/catch-logged like `WalletTypeService.seedDefaults`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(filemanager): FileLocationService with validation, seed, resolveBase"`

### Task 5: `FileLocationController` + mapper method

**Files:**
- Create: `.../location/FileLocationController.java`
- Modify: `.../mapper/FileMetadataMapper.java` (add `FileLocationDto toLocationDto(FileLocationEntity)` computing `available` via `Files.isDirectory && isReadable`)
- Test: `src/test/java/com/db/dbworld/app/filemanager/location/FileLocationControllerTest.java` (thin — verify it delegates; mock service)

**Interfaces:**
- Endpoints (all `@AdminAccess`, base `/api/admin/file-manager/locations`): `GET ""` → `List<FileLocationDto>` (all); `POST ""` (`@Valid UpsertLocationRequest`) → created; `PUT "/{id}"` → updated; `DELETE "/{id}"` → `Void`.

- [ ] **Step 1: Implement controller** (mirror `WalletAdminController`): inject `FileLocationService` + `FileMetadataMapper`; each method wraps `ApiResponse.success(msg, mapper.toLocationDto(...))`; list maps `svc.listAll().stream().map(mapper::toLocationDto).toList()`.
- [ ] **Step 2: Test** — mock service, call controller methods directly, assert returned `ApiResponse.getData()` and that `svc.create(req)` is invoked. Run `-Dtest=FileLocationControllerTest` → PASS.
- [ ] **Step 3: Commit** — `git commit -m "feat(filemanager): locations CRUD endpoints"`

---

## PHASE 3 — File operations (location-aware)

### Task 6: `FileOperationsService`

**Files:**
- Create: `.../service/FileOperationsService.java`
- Test: `src/test/java/com/db/dbworld/app/filemanager/service/FileOperationsServiceTest.java`

**Interfaces:**
- Consumes: `FileLocationService.resolveBase`, `PathJail`, `FileMetadataMapper`.
- Produces: `FileListDto list(String locationId, String path, String sortBy, String order)`; `List<FileItemDto> search(locationId, path, q, recursive)`; `FileItemDto info(locationId, path)`; `FileItemDto mkdir(locationId, parentPath, name)`; `renameItem(locationId, path, newName)`; `moveItem(locationId, sourcePath, destDir)`; `copyItem(locationId, sourcePath, destDir)`; `void delete(locationId, path)`. (Move/copy are within a single location; cross-location is out of scope v1.)

- [ ] **Step 1: Failing test** — create a temp dir, mock `FileLocationService.resolveBase(anyId)` → temp dir; exercise the full lifecycle:
```java
// key cases (AssertJ, plain Mockito):
@Test void mkdir_then_list_shows_folder() { ... svc.mkdir("l","/","docs"); assertThat(names(svc.list("l","/","name","asc"))).contains("docs"); }
@Test void rename_changes_name() { ... }
@Test void move_relocates_into_subdir() { ... }
@Test void copy_duplicates_file() { ... }
@Test void delete_removes_file() { ... }
@Test void search_recursive_finds_nested() { ... }
@Test void mkdir_rejects_slash_in_name() { assertThatThrownBy(() -> svc.mkdir("l","/","a/b")).isInstanceOf(IllegalArgumentException.class); }
@Test void list_bad_location_throwsNotFound() { when(loc.resolveBase("x")).thenThrow(new DbWorldException(HttpStatus.NOT_FOUND,"x")); assertThatThrownBy(() -> svc.list("x","/","name","asc")).isInstanceOf(DbWorldException.class); }
```
Provide full bodies in the test file (use `Files.createTempDirectory`, `Files.writeString`, helper `List<String> names(FileListDto d)`).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — port the operation bodies from old `FileManagerService` (lines 141–438: list/search/info/mkdir/rename/move/copy/copyDirRecursive/delete/deleteDirectoryRecursive) but: resolve `base = locationService.resolveBase(locationId)` at the top of each method; replace every `jailed(x)` with `PathJail.resolve(base, x)` and symlink-sensitive reads/copies with `PathJail.resolveReal(base, x)`; replace `toRelative`/`toDto` with `PathJail.toRelative(base, p)` / `FileMetadataMapper.toDto(locationId, base, p, false)`; bound recursive search with `Files.walk(root, 8)` (max depth 8) keeping the 200 cap; keep the directories-first comparator (`getFileItemDtoComparator`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(filemanager): location-aware FileOperationsService"`

### Task 7: Rewrite `FileManagerController` (location-aware)

**Files:**
- Modify: `.../controller/FileManagerController.java`
- Modify request DTOs `dto/request/MkdirRequest`, `RenameRequest`, `FileOperationRequest` — add `@NotBlank String locationId`.
- Test: extend `FileManagerControllerTest` (mock `FileOperationsService`).

**Interfaces:** endpoints keep paths but add `locationId` param/body: `GET /list?locationId&path&sortBy&order`; `GET /search?locationId&q&path&recursive`; `GET /info?locationId&path`; `POST /mkdir` `{locationId,path,name}`; `POST /rename` `{locationId,path,newName}`; `POST /move` `{locationId,sourcePath,destinationPath}`; `POST /copy` `{...}`; `DELETE /delete?locationId&path`.

- [ ] **Step 1:** Swap the injected `FileManagerService` for `FileOperationsService`; add `locationId` to each signature; delegate. Remove the old `/upload`, `/download`, `/download-ticket` methods from this controller (they move to the upload/download controllers in Phases 4–5).
- [ ] **Step 2: Test** — controller test asserts delegation with `locationId`. Run → PASS.
- [ ] **Step 3: Compile** whole module → succeeds. **Commit** — `git commit -m "feat(filemanager): location-aware operation endpoints"`

---

## PHASE 4 — Resumable chunked uploads

### Task 8: `UploadSessionEntity` + repository

**Files:** Create `.../upload/UploadSessionEntity.java`, `UploadSessionRepository.java`

**Interfaces:** entity `{String id, String locationId, String targetPath, String fileName, long totalSize, int chunkSize, long receivedBytes, int nextIndex, String checksum, String onConflict, String status /* PENDING|COMPLETED */, Instant createdAt, updatedAt}`; repo extends `JpaRepository<..,String>`, `List<UploadSessionEntity> findByStatusAndUpdatedAtBefore(String status, Instant t)`.

- [ ] **Step 1: Implement** entity (schema `db_world`, table `file_upload_session`, `targetPath length 1000`) + repo. **Step 2: Compile.** **Step 3: Commit** — `git commit -m "feat(filemanager): upload session entity + repo"`

### Task 9: `UploadSessionService`

**Files:** Create `.../upload/UploadSessionService.java`, `dto/UploadSessionDto.java`, `dto/InitUploadRequest.java`; Test `UploadSessionServiceTest.java`

**Interfaces:**
- Consumes: `UploadSessionRepository`, `FileLocationService.resolveBase`, `AppProperties.getTempPath`, `FileMetadataMapper`.
- Produces: `UploadSessionDto init(InitUploadRequest)`; `void appendChunk(String uploadId, int index, byte[] data)`; `UploadSessionDto status(String uploadId)`; `FileItemDto complete(String uploadId)`; `void abort(String uploadId)`. `.part` file lives at `tempPath/uploads/{uploadId}.part`.
```java
// InitUploadRequest.java
public record InitUploadRequest(@NotBlank String locationId, @NotBlank String path, @NotBlank String fileName,
                                long totalSize, Integer chunkSize, String checksum, String onConflict) {}
// UploadSessionDto.java  (@Data @Builder)
//   String uploadId; long totalSize; int chunkSize; long receivedBytes; int nextIndex; String status;
```

- [ ] **Step 1: Failing test** — mock repo (HashMap store) + `FileLocationService.resolveBase` → temp dir + `AppProperties.getTempPath` → temp dir. Cases:
```java
@Test void init_createsSession_withServerChunkSizeWhenNull() { UploadSessionDto s = svc.init(new InitUploadRequest("l","/","big.bin",20,null,null,null)); assertThat(s.getChunkSize()).isEqualTo(8388608); assertThat(s.getStatus()).isEqualTo("PENDING"); }
@Test void appendChunks_thenComplete_writesFileToLocation() throws Exception {
    UploadSessionDto s = svc.init(new InitUploadRequest("l","/","hi.txt",5,4,null,null)); // 5 bytes, 4-byte chunks
    svc.appendChunk(s.getUploadId(),0,new byte[]{'h','e','l','l'});
    svc.appendChunk(s.getUploadId(),1,new byte[]{'o'});
    FileItemDto out = svc.complete(s.getUploadId());
    assertThat(Files.readString(base.resolve("hi.txt"))).isEqualTo("hello");
    assertThat(out.getName()).isEqualTo("hi.txt");
}
@Test void status_reportsNextIndex_forResume() { ... appendChunk index0 ...; assertThat(svc.status(id).getNextIndex()).isEqualTo(1); }
@Test void complete_wrongSize_throws() { ... init totalSize=5, write only 4 ...; assertThatThrownBy(() -> svc.complete(id)).isInstanceOf(DbWorldException.class); }
@Test void complete_onConflictFail_whenExists_throws() { Files.writeString(base.resolve("hi.txt"),"x"); ... assertThatThrownBy(...).isInstanceOf(DbWorldException.class); }
@Test void appendChunk_isIdempotentPerIndex() { appendChunk(id,0,..); appendChunk(id,0,..); assertThat(status.getReceivedBytes()).isEqualTo(4); }
@Test void abort_deletesPartAndSession() { ... assertThat(Files.exists(part)).isFalse(); }
```
Fill full bodies in the test file.
- [ ] **Step 2: Run → FAIL.** `-Dtest=UploadSessionServiceTest`
- [ ] **Step 3: Implement:**
  - `init`: validate `resolveBase(locationId)`; chunkSize = `req.chunkSize()!=null? req.chunkSize() : 8388608`; onConflict = `req.onConflict()!=null? req.onConflict() : "fail"`; create `uploads/` dir under temp; create empty `.part` via `RandomAccessFile(part,"rw").setLength(0)`; save session (status PENDING, nextIndex 0, receivedBytes 0); return DTO.
  - `appendChunk`: load session (→ `DbWorldException NOT_FOUND`); open `.part` with `FileChannel`/`RandomAccessFile`, write `data` at offset `(long)index*chunkSize`; if `index >= nextIndex` (new data) increment `receivedBytes += data.length` and `nextIndex = index+1` (idempotent: re-writing an already-seen index does not re-add bytes); save.
  - `status`: return DTO from session.
  - `complete`: load session; verify `Files.size(part) == totalSize` else `DbWorldException(BAD_REQUEST,"size mismatch")`; if checksum given, verify SHA-256; resolve `base`, `dest = PathJail.resolve(base, path + "/" + safeName(fileName))`; apply onConflict: `fail`→throw if exists; `overwrite`→`REPLACE_EXISTING`; `rename`→append ` (n)` before extension until free; `Files.move(part, dest, ATOMIC_MOVE)` (fallback plain move); delete session; return `FileMetadataMapper.toDto(locationId, base, dest, false)`.
  - `abort`: delete `.part` + session.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(filemanager): resumable chunked upload session service"`

### Task 10: `FileUploadController` + public path stays admin

**Files:** Create `.../upload/FileUploadController.java`; Test extend as a thin delegation test.

**Interfaces (`@AdminAccess`, base `/api/admin/file-manager/uploads`):**
- `POST /init` (`@Valid InitUploadRequest`) → `UploadSessionDto`.
- `PUT /{uploadId}/chunk?index=N` — `@RequestBody byte[] data` (consumes `APPLICATION_OCTET_STREAM_VALUE`) → `UploadSessionDto status`.
- `GET /{uploadId}` → `UploadSessionDto`.
- `POST /{uploadId}/complete` → `FileItemDto`.
- `DELETE /{uploadId}` → `Void`.

- [ ] **Step 1: Implement** controller delegating to `UploadSessionService`, each wrapped in `ApiResponse.success`. For the chunk endpoint use `@PutMapping(value="/{uploadId}/chunk", consumes=MediaType.APPLICATION_OCTET_STREAM_VALUE)` and `@RequestBody byte[] data`.
- [ ] **Step 2: Test** delegation → PASS. **Step 3: Compile module. Commit** — `git commit -m "feat(filemanager): chunk upload endpoints"`

### Task 11: `UploadSweeper` (stale cleanup)

**Files:** Create `.../upload/UploadSweeper.java`; Test `UploadSweeperTest.java`

**Interfaces:** `@Scheduled(fixedDelayString = "${dbworld.filemanager.upload-sweep-ms:3600000}")` `void sweepStale()` — delete PENDING sessions older than `updatedAt < now-24h` and their `.part` files.

- [ ] **Step 1: Failing test** — mock repo returns one stale session pointing at a real temp `.part`; call `sweepStale()`; assert `.part` deleted + `repo.delete` called.
- [ ] **Step 2: Run → FAIL.** **Step 3: Implement** (`@Component @Log4j2 @RequiredArgsConstructor`; guard nothing—always safe; compute cutoff `Instant.now().minus(Duration.ofHours(24))`; `findByStatusAndUpdatedAtBefore("PENDING", cutoff)`; delete part via `Files.deleteIfExists`, then `repo.delete`). **Step 4: Run → PASS.** **Step 5: Commit** — `git commit -m "feat(filemanager): sweep stale upload sessions"`

---

## PHASE 5 — Downloads (range) + preview

### Task 12: `RangeStreamer` + `DownloadService` (tickets + range)

**Files:** Create `.../download/RangeStreamer.java`, `.../download/DownloadService.java`; Modify `.../controller/FileDownloadStreamController.java`; Test `RangeStreamerTest.java`, `DownloadServiceTest.java`

**Interfaces:**
- `RangeStreamer.stream(Path file, String rangeHeader, HttpServletResponse resp, boolean asAttachment)` — sets `Accept-Ranges`, parses `bytes=start-end`, writes `206`+`Content-Range` for partial or `200` for full; streams with an 8 KB buffer.
- `DownloadService`: `String issueTicket(String locationId, String path)` (in-memory `ConcurrentHashMap`, 60s TTL, validates via `FileLocationService`+`PathJail`); `void streamByTicket(String ticket, String rangeHeader, HttpServletResponse resp)`.

- [ ] **Step 1: Failing tests** — `RangeStreamerTest`: write a 100-byte temp file, call with `Range: bytes=0-9`, use `MockHttpServletResponse`, assert status 206, `Content-Range: bytes 0-9/100`, body length 10; and with null range → status 200, full body. `DownloadServiceTest`: issue ticket then stream, assert bytes; expired/invalid ticket → `410`/error.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — port the ticket record + TTL purge from old `FileManagerService` (lines 33–37, 287–313) into `DownloadService`, extend `DownloadTicket` to carry `locationId`; delegate byte writing to `RangeStreamer`. Controller: `@GetMapping("/download/stream")` reads `@RequestParam String ticket` + `@RequestHeader(value="Range", required=false) String range` and calls `service.streamByTicket(ticket, range, response)`. Add `POST /download-ticket?locationId&path` (admin) in `FileManagerController` delegating to `DownloadService.issueTicket`.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(filemanager): range-aware ticketed downloads"`

### Task 13: `ThumbnailService` + `TextPreviewService` + `FilePreviewController`

**Files:** Create `.../preview/ThumbnailService.java`, `.../preview/TextPreviewService.java`, `.../controller/FilePreviewController.java`; Test `TextPreviewServiceTest.java`, `ThumbnailServiceTest.java`

**Interfaces:**
- `TextPreviewService.readHead(String locationId, String path, int maxBytes)` → `String` (default cap 256 KB; reject files bigger only for text types by truncating with a flag). Return `{content, truncated}` via a small `TextPreviewDto`.
- `ThumbnailService.thumbnail(String locationId, String path)` → `byte[]` (JPEG). Images: downscale with `javax.imageio` + `Thumbnails`-style graphics to max 320px; PDF first page + video first-frame reuse the wallet approach (`WalletThumbnailer`) — inspect `app/wallet/service/WalletThumbnailer.java` and reuse its libraries (PDFBox / ffmpeg invocation). Cache to `tempPath/fm-thumbs/{sha1(locationId+path+mtime)}.jpg`.
- Endpoints (`@AdminAccess`, base `/api/admin/file-manager`): `GET /preview/text?locationId&path` → `TextPreviewDto`; `GET /thumbnail?locationId&path` → `image/jpeg` bytes (via `ResponseEntity<byte[]>`).

- [ ] **Step 1: Failing tests** — `TextPreviewServiceTest`: write a text file > cap, assert `truncated==true` and content length ≤ cap; small file → full content, `truncated==false`. `ThumbnailServiceTest`: generate a small `BufferedImage`, write PNG to temp, assert `thumbnail(...)` returns non-empty JPEG bytes and caches (second call reads cache).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** per interfaces above (reuse `WalletThumbnailer` helpers to avoid duplicating PDF/video logic — extract shared bits if needed). Video preview itself is served by the existing ranged stream (no new endpoint).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(filemanager): text preview + thumbnail endpoints"`

### Task 14: Backend integration compile + full test run

- [ ] **Step 1:** `JAVA_HOME=<jdk25> "$MVN" -pl db-world-backend test` → all green (new + existing). Fix any regressions.
- [ ] **Step 2: Commit** if fixes — `git commit -m "test(filemanager): backend suite green"`

---

## PHASE 6 — Frontend infrastructure (API, stores, uploader)

### Task 15: `api/fileManagerApi.js`

**Files:** Create `.../filemanager/api/fileManagerApi.js`; Test `.../filemanager/api/fileManagerApi.test.js` (vitest, mock `axiosInstance`).

**Interfaces (named exports):** `listDirectory({locationId,path,sortBy,order})`, `searchFiles({locationId,q,path,recursive})`, `getFileInfo({locationId,path})`, `mkdir({locationId,path,name})`, `renameItem({locationId,path,newName})`, `moveItem({locationId,sourcePath,destinationPath})`, `copyItem({...})`, `deleteItem({locationId,path})`, `listLocations()`, `createLocation(body)`, `updateLocation(id,body)`, `deleteLocation(id)`, `initUpload(body)`, `uploadChunk(uploadId,index,blob,{onProgress,signal})`, `uploadStatus(uploadId)`, `completeUpload(uploadId)`, `abortUpload(uploadId)`, `downloadTicketUrl({locationId,path})` (returns the public stream URL after POSTing for a ticket), `thumbnailUrl({locationId,path})`, `fetchTextPreview({locationId,path})`.

- [ ] **Step 1: Failing test** — mock the default export of `AxiosInstants`; assert `listDirectory` calls `GET /api/admin/file-manager/list` with params incl. `locationId`, and unwraps `r.data.data`; assert `uploadChunk` PUTs octet-stream to `/uploads/{id}/chunk?index=N`.
- [ ] **Step 2: Run → FAIL.** `cd db-world-frontend && npx vitest run src/features/admin/filemanager/api`
- [ ] **Step 3: Implement** — mirror the existing api conventions (const `BASE`, `.then(r=>r.data.data)`). `uploadChunk` uses `axiosInstance.put(url, blob, {headers:{'Content-Type':'application/octet-stream'}, params:{index}, onUploadProgress, signal})`. `downloadTicketUrl` POSTs `/download-ticket` then builds `${getApiBaseUrl()}${BASE}/download/stream?ticket=...`.
- [ ] **Step 4: Run → PASS.** **Step 5: Commit** — `git commit -m "feat(filemanager): new API layer (ops, locations, chunk upload, preview)"`

### Task 16: `store/useFileManagerStore.js` + `store/useUploadStore.js`

**Files:** Create both; Test `store/useFileManagerStore.test.js` (selection/clipboard logic).

**Interfaces:**
- `useFileManagerStore`: `{locationId, path, viewMode('grid'|'list'), sortBy, sortOrder, filter, selection:Set, clipboard:{mode,items}|null, setLocation, navigate(path), toggleSelect(pathId, {range,additive}), selectAll(items), clearSelection, setClipboard(mode,items), ...dialog flags}`.
- `useUploadStore`: `{uploads:{[id]:{name,total,sent,status('queued'|'uploading'|'paused'|'done'|'error'),speed,etaSec,error}}, addUpload, updateUpload, removeUpload, trayOpen}`.

- [ ] **Step 1: Failing test** — `toggleSelect` additive toggles membership; `selectAll` fills from items; `clearSelection` empties; range-select from an anchor selects the inclusive slice.
- [ ] **Step 2: Run → FAIL.** **Step 3: Implement** with Zustand `create`. **Step 4: Run → PASS.** **Step 5: Commit** — `git commit -m "feat(filemanager): fm + upload Zustand stores"`

### Task 17: `upload/resumableUploader.js`

**Files:** Create `.../upload/resumableUploader.js`; Test `.../upload/resumableUploader.test.js`

**Interfaces:** `createUpload({file, locationId, path, chunkSize, api, onProgress, onDone, onError})` → `{promise, pause(), resume(), cancel()}`. Behavior: `api.initUpload` → loop chunks from `nextIndex` (resume-aware via `api.uploadStatus` on resume); slice `file.slice(i*chunkSize,(i+1)*chunkSize)`; `api.uploadChunk` with per-chunk retry (3×, exponential backoff 500·2^n ms); track sent bytes → `onProgress({sent,total,speed,etaSec})`; on all chunks sent → `api.completeUpload` → `onDone(fileItem)`; `pause` stops after the in-flight chunk; `cancel` aborts (`AbortController`) + `api.abortUpload`.

- [ ] **Step 1: Failing test** — inject a fake `api` whose `uploadChunk` fails twice then succeeds; assert the file completes and `onDone` fires with the fake FileItem; a fake that always fails → `onError` after retries; assert `initUpload` called once and chunk count = `ceil(total/chunkSize)`.
- [ ] **Step 2: Run → FAIL.** `npx vitest run src/features/admin/filemanager/upload`
- [ ] **Step 3: Implement.** **Step 4: Run → PASS.** **Step 5: Commit** — `git commit -m "feat(filemanager): resumable chunk uploader with retry/pause/resume"`

---

## PHASE 7 — Frontend UI

> All components use `const T = useT()` for colors, Framer Motion for transitions, and MUI primitives. Verify each visually in the browser preview (Phase 8) — no pixel snapshot tests. Commit per task.

### Task 18: `fileIcons.js` + `ConfirmDialog.jsx`

**Files:** Create `components/fileIcons.js` (port ext→icon/color map from the old `fileIcons.js`; keep the same export names), `components/ConfirmDialog.jsx`.
- `ConfirmDialog` props: `{open, title, message, confirmLabel='Delete', danger=true, onConfirm, onClose}`. MUI `Dialog` themed with `T.glass`/`T.border`/`T.error`; confirm button uses `T.error` when `danger`. Framer Motion fade/scale.
- [ ] Implement → mount a throwaway story in `index.jsx` later; **Commit** — `git commit -m "feat(filemanager): file icons + themed confirm dialog"`

### Task 19: `LocationsRail.jsx` + `FolderTree.jsx` + `hooks/useLocations.js`, `hooks/useDirectory.js`

**Files:** Create the four.
- `useLocations` = `useQuery(['file-manager','locations'], listLocations)`. `useDirectory(locationId,path,sortBy,order)` = `useQuery(['file-manager', locationId, path, sortBy, sortOrder], () => listDirectory(...), {enabled:!!locationId, staleTime:30_000})`.
- `LocationsRail`: lists locations from `useLocations`; active location highlighted (`T.tealBg`); a gear button opens `LocationManagerDialog`; contains `FolderTree` for the active location. Collapsible; hidden on mobile (`useMediaQuery(down('md'))`) where a `LocationsMenu` dropdown + breadcrumb is used instead.
- `FolderTree`: lazy-expanding tree; expanding a node fetches its dirs via `listDirectory` filtered to directories; clicking navigates (`store.navigate`). Drop target: dropping selected items onto a node calls move (wired in Task 24).
- [ ] Implement; **Commit** — `git commit -m "feat(filemanager): locations rail + lazy folder tree"`

### Task 20: `Breadcrumb.jsx` + `Toolbar.jsx`

**Files:** Create both.
- `Breadcrumb`: splits `path` into segments, each clickable → `navigate`; root chip shows the location label.
- `Toolbar`: buttons Upload (opens hidden `<input type=file multiple>`), New Folder, grid/list toggle (`ToggleButtonGroup` bound to `viewMode`), Sort menu (name/size/modified/type + asc/desc), Filter menu (all/folder/file/image/audio/video/text/pdf/zip), Search field (debounced 350 ms → `searchFiles`). Bulk actions appear when `selection.size>0`: Download, Copy, Cut, Move, Delete, Info, plus a count + Clear.
- [ ] Implement; **Commit** — `git commit -m "feat(filemanager): breadcrumb + toolbar with bulk actions"`

### Task 21: `FileGrid.jsx` + `FileList.jsx` + `FileMobileList.jsx` (with selection)

**Files:** Create the three (grid = thumbnail cards using `thumbnailUrl` for image/video/pdf, else icon; list = table; mobile = tap list). All read `selection` from the store and render a checkbox overlay; support click (open/navigate), ctrl/cmd-click (additive toggle), shift-click (range from anchor), long-press (mobile → enter select mode). Row/card right-click opens `ContextMenu`. Use Framer Motion `AnimatePresence` for enter/exit and skeletons while `isLoading`. Grid virtualization: render with `@tanstack/react-virtual` if directory length > 200 (dependency already present? if not, cap render + "load more"; do NOT add heavy deps — fall back to windowing via simple slice-on-scroll).
- [ ] Implement; **Commit** — `git commit -m "feat(filemanager): grid/list/mobile views with multi-select"`

### Task 22: `ContextMenu.jsx` + `InfoDrawer.jsx`

**Files:** Create both.
- `ContextMenu`: MUI `Menu` at cursor; actions Open, Download, Rename, Move, Copy, Cut, Info, Delete — each dispatches to handlers passed from `index.jsx`. Multi-select aware (acts on selection when the right-clicked item is selected).
- `InfoDrawer`: right `Drawer` showing name, path, location label, size, MIME, modified/created, readable/writable, thumbnail if previewable; quick actions Download/Rename/Delete.
- [ ] Implement; **Commit** — `git commit -m "feat(filemanager): context menu + info drawer"`

### Task 23: Dialogs — `NewFolderDialog`, `RenameDialog`, `MoveCopyDialog`, `LocationManagerDialog`

**Files:** Create the four (RHF + Zod).
- `NewFolderDialog`/`RenameDialog`: single validated text field (Zod: non-empty, no `/ \ ..`), submit → `mkdir`/`renameItem` mutation.
- `MoveCopyDialog`: mode `move|copy`; embeds a `FolderTree` destination **picker** for the current location; confirm → `moveItem`/`copyItem` for each selected item.
- `LocationManagerDialog`: table of locations from `useLocations` with add/edit (label + absolutePath, Zod non-empty) and delete (via `ConfirmDialog`); shows `available` badge; mutations call `createLocation`/`updateLocation`/`deleteLocation` and invalidate `['file-manager','locations']`.
- [ ] Implement; **Commit** — `git commit -m "feat(filemanager): folder/rename/move-copy/location dialogs"`

### Task 24: `UploadTray.jsx` + upload wiring

**Files:** Create `components/UploadTray.jsx`; wire upload trigger in `Toolbar`/drag-drop.
- Selecting files (or OS drag-drop onto the content area) creates one `resumableUploader` per file, registers it in `useUploadStore`, and opens the tray. Tray (bottom-right, Framer Motion slide-up) lists each upload with name, animated progress bar (`T.teal`), speed + ETA, and pause/resume/cancel/retry buttons bound to the uploader handle. On `onDone`, invalidate `['file-manager', locationId, path]` so the file appears; on `onError`, show retry.
- [ ] Implement; **Commit** — `git commit -m "feat(filemanager): upload tray + drag-drop resumable uploads"`

### Task 25: `PreviewPanel.jsx` (image/video/audio/pdf/text)

**Files:** Create `components/PreviewPanel.jsx` (+ inline sub-viewers).
- Desktop: right slide-in `Drawer`; mobile: full-screen sheet (reuse the no-drag bottom-sheet pattern used by the cinema Record Detail Sheet). Chooses a viewer by MIME: image (`<img>` from `thumbnailUrl` full/zoom-pan), video/audio (`<video>/<audio>` `src` = ticketed stream URL, which now supports range/seek), pdf (`<iframe>`/`<embed>` of the stream URL), text/code (`fetchTextPreview` → syntax-highlighted `<pre>`; show "truncated" note when applicable). Prev/next navigates within the current listing. Framer Motion transitions.
- [ ] Implement; **Commit** — `git commit -m "feat(filemanager): inline preview panel for all types"`

### Task 26: `index.jsx` — compose + handlers + keyboard

**Files:** Create `index.jsx` (replaces old).
- Compose rail + breadcrumb + toolbar + view + tray + dialogs + preview. Own the mutation handlers (mkdir/rename/move/copy/delete via TanStack `useMutation` with snackbar + `['file-manager', locationId, path]` invalidation, mirroring the existing conventions). Delete routes through `ConfirmDialog` (no `window.confirm`). Download: web → `downloadTicketUrl` anchor click; Android (`Capacitor.isNativePlatform()`) → fetch blob then `saveBlobNative` (from `platform/android/walletDownload.js`). Keyboard: F2 rename, Delete, Ctrl/Cmd+A, Ctrl+C/X/V, Enter open, Esc clear/close (desktop only).
- [ ] Implement; **Commit** — `git commit -m "feat(filemanager): compose page, handlers, keyboard shortcuts"`

---

## PHASE 8 — Wiring, verification, cleanup

### Task 27: Route/nav unchanged sanity + build

**Files:** verify `App.jsx:394` (`files` route) and `AdminLayout.jsx:67` (nav) still import `@features/admin/filemanager` (index default export). No change expected.
- [ ] **Step 1:** `cd db-world-frontend && npx vitest run src/features/admin/filemanager` → green.
- [ ] **Step 2:** `npm run build` → succeeds (no unused-import/lint breakage).
- [ ] **Step 3: Commit** if fixes.

### Task 28: Browser-preview verification (web)

- [ ] Start the dev server via preview_start (`.claude/launch.json` `dev`/`dev:local`), sign in as admin, open `/db-world/admin/files`.
- [ ] Verify with read_console_messages / read_network_requests / read_page + screenshots:
  1. Locations rail shows the seeded "Data" location; add a second location via the manager dialog; switch between them.
  2. Browse, grid/list toggle, sort, filter, breadcrumb, folder tree expand.
  3. Multi-select (click/shift/ctrl), context menu, rename, new folder, move (tree picker), copy, delete (themed confirm).
  4. Upload a large file; confirm chunked PUTs in the network panel, real progress, pause/resume, and the file appears on completion.
  5. Preview each type (image/video seek/audio/pdf/text).
  6. Download a file (network shows ranged stream).
  7. resize_window mobile — locations menu, mobile list, long-press select, full-screen preview sheet.
- [ ] Fix any issues (edit source → re-verify). **Commit** fixes.

### Task 29: Remove superseded code

- [ ] **Step 1:** Delete old backend `service/FileManagerService.java` and any now-unused `dto/request/*`. Grep for remaining references: `grep -rn "FileManagerService" db-world-backend/src` → only test/imports you intend; fix imports.
- [ ] **Step 2:** Delete old frontend files with no successor: `UploadDialog.jsx`, `FileOperationDialog.jsx`, `SearchDialog.jsx`, old `fileManagerApi.js`, old `useFileManagerStore.js`, `FileBreadcrumb.jsx`, and any leftover old view files. Grep `grep -rn "filemanager/UploadDialog\|FileOperationDialog\|SearchDialog" db-world-frontend/src`.
- [ ] **Step 3:** `JAVA_HOME=<jdk25> "$MVN" -pl db-world-backend test` and `cd db-world-frontend && npx vitest run && npm run build` → all green.
- [ ] **Step 4: Commit** — `git commit -m "refactor(filemanager): remove superseded monolith + legacy UI"`

### Task 30: Final review + docs

- [ ] Run superpowers:requesting-code-review on the branch diff; address findings.
- [ ] Note the nginx `client_max_body_size ≥ 16m` deploy dependency in the PR description (user's `db-world-config` repo).
- [ ] Summarize verification evidence (screenshots, network traces) for the user.

---

## Self-Review (author)

- **Spec coverage:** multi-location (Tasks 3–5,7), resumable 10 GB upload (8–11,17,24), range download (12), preview all types (13,25), full op set incl. select/multi-select/copy/move/rename/info/delete/search (6,7,20–23,26), responsive + Android (21,25,26,28), admin-only (`@AdminAccess` throughout), DRY decomposition (1,2,6,12; reuse `WalletThumbnailer` in 13), old-code removal (29), infra note (12,30) — all mapped.
- **Placeholders:** UI tasks (18–26) intentionally specify interfaces + key logic rather than full JSX, because they are verified visually in Task 28 and must follow `useT()` tokens; no vague "add error handling" — error paths are concrete (snackbar text, retry, confirm dialog). Backend tasks carry complete code/tests.
- **Type consistency:** `locationId` threads through DTOs, service signatures, API params, and store; `resolveBase(id)`, `PathJail.resolve/toRelative/resolveReal`, `FileMetadataMapper.toDto(locationId, base, p, withChildCount)`, uploader `createUpload({...})` names are used consistently across tasks.
