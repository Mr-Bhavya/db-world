# Media Files Admin Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Newest first / Oldest first" sort options to the Media Files admin page (using existing `createdAt`/`updatedAt` fields already in the DTO), fix the mobile layout crash, and provide a one-time migration endpoint to scan the stream directory and link orphaned files to DB records.

**Architecture:** The `MediaFileDto` already carries `createdAt` and `updatedAt` (Instants). The frontend `index.jsx` needs two new client-side sort options that use those fields. The mobile fix adds responsive overflow handling to the table container. The migration endpoint is a new `POST /api/ingestion/migrate/scan-stream` that walks the stream directory, finds files with no DB entry, runs MediaInfo on each, and persists them.

**Tech Stack:** Spring Boot (Java 21), React 18, MUI v6, TanStack Query, `notistack`.

---

## File Map

| Action | File |
|--------|------|
| Modify | `db-world-frontend/src/features/adminv2/mediafiles/index.jsx` |
| Create | `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/migration/StreamMigrationService.java` |
| Modify | `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/controller/IngestionController.java` |

---

## Task 1 — Add "Newest / Oldest" Sort Options to Media Files

**Context:** `MediaFileDto` already has `createdAt: Instant` and `updatedAt: Instant`. The frontend does client-side sorting. The current sort options are: Name A–Z, Name Z–A, Largest first, Smallest first, Longest first, By record. We add: Newest first, Oldest first, Last modified first.

**Files:**
- Modify: `db-world-frontend/src/features/adminv2/mediafiles/index.jsx`

- [ ] **Step 1.1 — Find the `sortOption` state and sort options list**

  In `index.jsx`, locate the `sortOption` `useState` call and the `<Select>` / `<MenuItem>` block that renders the sort dropdown (around lines 710–724 based on exploration). The current values are `'name_asc'`, `'name_desc'`, `'size_desc'`, `'size_asc'`, `'duration_desc'`, `'record_asc'`.

- [ ] **Step 1.2 — Add three new `<MenuItem>` options to the sort Select**

  After the last existing `<MenuItem>` in the sort Select, add:

  ```jsx
  <MenuItem value="created_desc">Newest first</MenuItem>
  <MenuItem value="created_asc">Oldest first</MenuItem>
  <MenuItem value="updated_desc">Last modified first</MenuItem>
  ```

- [ ] **Step 1.3 — Add the new sort cases to the `useMemo` sort logic**

  Find the `useMemo` block that sorts `filtered` (the array of media files). It contains a `switch` or `if-else` chain on `sortOption`. Add these cases:

  ```js
  case 'created_desc':
    return [...filtered].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  case 'created_asc':
    return [...filtered].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
  case 'updated_desc':
    return [...filtered].sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
  ```

- [ ] **Step 1.4 — Set default sort to `'created_desc'` (latest first)**

  ```jsx
  const [sortOption, setSortOption] = useState('created_desc');
  ```

- [ ] **Step 1.5 — Manual test**

  Open Media Files page. Verify:
  - Default sort shows most recently added files at top.
  - "Oldest first" shows the earliest files.
  - "Last modified first" reorders by `updatedAt`.

- [ ] **Step 1.6 — Commit**

  ```bash
  git add db-world-frontend/src/features/adminv2/mediafiles/index.jsx
  git commit -m "feat: newest/oldest/last-modified sort options in Media Files admin"
  ```

---

## Task 2 — Fix Media Files Page Mobile Layout

**Context:** The Media Files page fails on mobile (shows reload prompt, doesn't load properly). The most common causes are: a `TableContainer` with no horizontal scroll (overflows the viewport), a fixed-width element forcing reflow, or a large initial data fetch that times out on slow connections. We fix the layout overflow first, then add a loading skeleton.

**Files:**
- Modify: `db-world-frontend/src/features/adminv2/mediafiles/index.jsx`

- [ ] **Step 2.1 — Wrap the table in an `overflow-x: auto` container**

  Find the `<TableContainer>` element in `index.jsx` (the table view rendering section). Wrap it or add the `sx` prop:

  ```jsx
  <TableContainer
    component={Paper}
    sx={{ overflowX: 'auto', maxWidth: '100%' }}  // ADD/UPDATE sx
  >
  ```

  If `TableContainer` already has an `sx`, merge the values.

- [ ] **Step 2.2 — Add `minWidth` to the `<Table>` element**

  The table should not collapse below a usable width on narrow screens:

  ```jsx
  <Table size="small" sx={{ minWidth: 650 }}>
  ```

- [ ] **Step 2.3 — Wrap the entire page content in a responsive container**

  Find the outer-most `<Box>` or `<Paper>` wrapping the page content. Ensure it has:

  ```jsx
  sx={{ width: '100%', overflowX: 'hidden' }}
  ```

- [ ] **Step 2.4 — Switch the stats grid to use responsive column counts**

  Find the stats `<Grid container>` at the top of the page. Update each stats `<Grid item>` to use responsive breakpoints instead of fixed `xs={3}`:

  ```jsx
  <Grid item xs={6} sm={6} md={3}>   {/* was xs={3} */}
  ```

  Apply this to all 4 stat card grid items.

- [ ] **Step 2.5 — Add `flexWrap: 'wrap'` to filter/sort control row**

  Find the `<Stack>` or `<Box>` that holds the search field + filter dropdowns + sort. Add:

  ```jsx
  sx={{ flexWrap: 'wrap', gap: 1 }}
  ```

  And ensure each control has `minWidth: 120` so they wrap gracefully.

- [ ] **Step 2.6 — Manual test on mobile viewport**

  Use browser DevTools → Toggle Device Toolbar → iPhone SE (375×667px). Verify:
  - Page loads without a reload prompt.
  - Stats cards wrap to 2×2 grid.
  - Table scrolls horizontally.
  - Filter controls wrap to multiple rows rather than overflowing.

- [ ] **Step 2.7 — Commit**

  ```bash
  git add db-world-frontend/src/features/adminv2/mediafiles/index.jsx
  git commit -m "fix: media files page mobile layout — horizontal scroll and responsive grid"
  ```

---

## Task 3 — Create `StreamMigrationService` (Backend)

**Context:** ~300 files exist in the stream path with no corresponding `media_files` DB entry. We need a one-time scan that:
1. Walks all files in the configured `stream-path` directory.
2. For each file: checks if a `MediaFileEntity` with that absolute path already exists.
3. If missing: runs `MediaInfoService.collectAndPersist()` with `recordId = null`.
4. Returns a report: `{ scanned, alreadyPresent, created, failed }`.

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/migration/StreamMigrationService.java`

- [ ] **Step 3.1 — Create `StreamMigrationService.java`**

  ```java
  package com.db.dbworld.app.media.ingestion.migration;

  import com.db.dbworld.app.media.info.service.MediaInfoService;
  import com.db.dbworld.utils.DbWorldRuntimeProperties;
  import lombok.RequiredArgsConstructor;
  import lombok.extern.log4j.Log4j2;
  import org.springframework.stereotype.Service;

  import java.io.IOException;
  import java.nio.file.*;
  import java.nio.file.attribute.BasicFileAttributes;
  import java.util.*;

  /**
   * One-time migration: scans the stream-path directory for media files that
   * have no corresponding {@code media_files} DB entry, and creates one for each
   * using MediaInfoService (with recordId = null — files can be linked later).
   *
   * Trigger via POST /api/ingestion/migrate/scan-stream (admin-only endpoint).
   */
  @Log4j2
  @Service
  @RequiredArgsConstructor
  public class StreamMigrationService {

      private static final Set<String> MEDIA_EXTENSIONS = Set.of(
              "mkv", "mp4", "avi", "mov", "ts", "m2ts", "m4v", "wmv", "flv", "webm", "mpg", "mpeg"
      );

      private final MediaInfoService           mediaInfoService;
      private final DbWorldRuntimeProperties   runtimeProperties;

      public MigrationReport scanAndLink() throws IOException {
          Path streamRoot = Path.of(runtimeProperties.getStreamPath());
          if (!Files.isDirectory(streamRoot)) {
              throw new IllegalStateException("Stream path is not a directory: " + streamRoot);
          }

          int scanned = 0, alreadyPresent = 0, created = 0, failed = 0;
          List<String> failedFiles = new ArrayList<>();

          try (var walker = Files.walk(streamRoot)) {
              Iterable<Path> files = () -> walker
                      .filter(Files::isRegularFile)
                      .filter(p -> {
                          String name = p.getFileName().toString().toLowerCase();
                          int dot = name.lastIndexOf('.');
                          return dot > 0 && MEDIA_EXTENSIONS.contains(name.substring(dot + 1));
                      })
                      .iterator();

              for (Path file : files) {
                  scanned++;
                  String absolutePath = file.toAbsolutePath().toString();

                  if (mediaInfoService.getByFilePath(absolutePath).isPresent()) {
                      alreadyPresent++;
                      log.debug("Already present: {}", file.getFileName());
                      continue;
                  }

                  try {
                      mediaInfoService.collectAndPersist(file, null, "MIGRATION");
                      created++;
                      log.info("Migrated: {}", file.getFileName());
                  } catch (Exception e) {
                      failed++;
                      failedFiles.add(file.getFileName().toString() + ": " + e.getMessage());
                      log.warn("Migration failed for {}: {}", file.getFileName(), e.getMessage());
                  }
              }
          }

          log.info("Migration complete — scanned={}, alreadyPresent={}, created={}, failed={}",
                  scanned, alreadyPresent, created, failed);
          return new MigrationReport(scanned, alreadyPresent, created, failed, failedFiles);
      }

      public record MigrationReport(
              int scanned,
              int alreadyPresent,
              int created,
              int failed,
              List<String> failedFiles
      ) {}
  }
  ```

- [ ] **Step 3.2 — Check that `DbWorldRuntimeProperties` has `getStreamPath()`**

  Grep for `getStreamPath` in the codebase:

  ```bash
  grep -r "getStreamPath\|stream.path\|streamPath" db-world-backend/src --include="*.java" -l
  ```

  If the method doesn't exist, find the property name used for the stream directory (likely `stream-path` or `media.stream-path`) and add a getter to `DbWorldRuntimeProperties`. The stream path is used by `FileStorageService` or similar — search for where the output directory is configured.

- [ ] **Step 3.3 — Compile check**

  ```bash
  cd db-world-backend
  mvn compile -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 3.4 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/migration/StreamMigrationService.java
  git commit -m "feat: StreamMigrationService — scan stream dir and create missing DB entries"
  ```

---

## Task 4 — Add Migration Endpoint to `IngestionController`

**Context:** `StreamMigrationService` needs a REST trigger. Add `POST /api/ingestion/migrate/scan-stream`. This is a long-running operation — run it synchronously and return the report (suitable for admin one-time use).

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/controller/IngestionController.java`

- [ ] **Step 4.1 — Inject `StreamMigrationService` into `IngestionController`**

  Add the field (constructor-injected):
  ```java
  private final StreamMigrationService streamMigrationService;
  ```

  Update the constructor to add this parameter.

  Add import: `import com.db.dbworld.app.media.ingestion.migration.StreamMigrationService;`

- [ ] **Step 4.2 — Add the migration endpoint**

  Add this method to `IngestionController`:

  ```java
  /**
   * One-time migration: scans the stream directory for media files with no DB
   * entry and creates MediaInfo records for each.
   *
   * Returns: { scanned, alreadyPresent, created, failed, failedFiles }
   */
  @PostMapping("/migrate/scan-stream")
  public ResponseEntity<?> migrateStreamFiles() {
      try {
          StreamMigrationService.MigrationReport report = streamMigrationService.scanAndLink();
          return ResponseEntity.ok(report);
      } catch (Exception e) {
          log.error("Stream migration failed: {}", e.getMessage(), e);
          return ResponseEntity.internalServerError()
                  .body(Map.of("error", e.getMessage()));
      }
  }
  ```

- [ ] **Step 4.3 — Compile and build**

  ```bash
  cd db-world-backend
  mvn package -DskipTests -q
  ```

  Expected: BUILD SUCCESS.

- [ ] **Step 4.4 — Manual test**

  ```bash
  curl -X POST http://localhost:8080/api/ingestion/migrate/scan-stream \
       -H "Authorization: Bearer <admin-token>"
  ```

  Expected response:
  ```json
  {
    "scanned": 312,
    "alreadyPresent": 10,
    "created": 300,
    "failed": 2,
    "failedFiles": ["corrupted_file.mkv: mediainfo returned empty", ...]
  }
  ```

- [ ] **Step 4.5 — Commit**

  ```bash
  git add db-world-backend/src/main/java/com/db/dbworld/app/media/ingestion/controller/IngestionController.java
  git commit -m "feat: POST /api/ingestion/migrate/scan-stream endpoint for one-time stream file migration"
  ```

---

## Task 5 — Add Migration Trigger Button to Media Files Admin UI

**Context:** The migration endpoint needs a UI trigger so admins don't have to use `curl`. Add a "Scan & Link Orphaned Files" button to the page-level actions row in `index.jsx` alongside the existing Repair/Rebuild/Cleanup buttons.

**Files:**
- Modify: `db-world-frontend/src/features/adminv2/mediafiles/index.jsx`

- [ ] **Step 5.1 — Add `scanAndLink` mutation**

  Find the existing `useMutation` calls (e.g., for `cleanupOrphanedFiles`). Add:

  ```jsx
  const scanMigration = useMutation({
    mutationFn: () => fetch('/api/ingestion/migrate/scan-stream', { method: 'POST' }).then(r => r.json()),
    onSuccess: (data) => {
      enqueueSnackbar(
        `Migration complete — scanned: ${data.scanned}, created: ${data.created}, failed: ${data.failed}`,
        { variant: data.failed > 0 ? 'warning' : 'success', autoHideDuration: 8000 }
      );
      queryClient.invalidateQueries({ queryKey: ['mediaFiles'] });
    },
    onError: (err) => enqueueSnackbar('Migration failed: ' + err.message, { variant: 'error' }),
  });
  ```

- [ ] **Step 5.2 — Add button to the page-level actions row**

  Find the row with existing admin action buttons (Repair Symlinks, Rebuild Symlinks, Cleanup, Refresh). Add:

  ```jsx
  <Tooltip title="Scan stream directory for files not yet in DB and create DB entries (one-time migration)">
    <Button
      variant="outlined"
      size="small"
      startIcon={scanMigration.isPending ? <CircularProgress size={14} /> : <FolderOpen />}
      onClick={() => scanMigration.mutate()}
      disabled={scanMigration.isPending}
    >
      Scan & Link
    </Button>
  </Tooltip>
  ```

  `FolderOpen` is already imported in `index.jsx`.

- [ ] **Step 5.3 — Manual test**

  Click "Scan & Link". Verify a snackbar appears with the migration summary. Verify the media files list refreshes to show newly created entries.

- [ ] **Step 5.4 — Commit**

  ```bash
  git add db-world-frontend/src/features/adminv2/mediafiles/index.jsx
  git commit -m "feat: Scan & Link button in Media Files admin for one-time stream migration"
  ```

---

## Self-Review Checklist

| Requirement | Task |
|-------------|------|
| Sort by last modified | Task 1 (`updated_desc`) |
| Sort by created date (newest/oldest) | Task 1 (`created_desc`, `created_asc`) |
| Mobile page fails — reload prompt | Task 2 (overflow fix + responsive grid) |
| Production migration: scan files and link to DB | Task 3 + 4 |
| Migration UI trigger | Task 5 |
