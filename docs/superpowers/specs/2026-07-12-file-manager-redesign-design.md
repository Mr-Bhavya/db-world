# Admin File Manager — Production Redesign

- **Date:** 2026-07-12
- **Branch:** `feat/file-manager-redesign` (off `development`)
- **Status:** Design — awaiting user review
- **Scope owner:** Admin/Owner-only server file manager

## 1. Goals

Replace the current admin file manager with a production-grade, cross-platform manager comparable to Google Drive / OneDrive:

- **Multiple root locations** (e.g. `/srv/dbworld`, `/app/db_world`), admin-managed from the UI, each independently jailed.
- **Reliable 10 GB+ transfers**: resumable chunked uploads (pause / resume / retry / survive disconnects), range-enabled streaming downloads.
- **Inline preview** for images, audio, video (streamed), PDF, and text/code/logs.
- **Full operation set**: browse, single + multi select, open, download, upload, new folder, rename, move, copy, delete, info, search.
- **Responsive** across desktop web, mobile web, and the Capacitor Android app.
- **Polished, animated UI** matching the existing AMOLED-black + teal admin theme (`useT()` tokens), with Drive/OneDrive interaction patterns.
- **Owner/Admin-only**, enforced server-side and client-side.
- **Optimized, DRY code** using well-bounded modules; old code removed once the replacement is verified.

## 2. Non-Goals (YAGNI)

- Recycle bin / soft-delete (decision: permanent delete with a themed confirm dialog).
- Object storage / S3 / MinIO — stays a jailed server-filesystem manager.
- Electron desktop build; iOS build.
- Public share links (that is the Document Wallet's job), file versioning, real-time collaboration, per-location ACLs.

## 3. Decisions (from scoping)

| Topic | Decision |
|---|---|
| Transfer engine | Resumable chunked upload + range streaming download |
| Preview | Images, audio, video (streamed), PDF/docs, text/code/logs |
| Locations | Admin-managed in UI, stored in DB (label + absolute path) |
| Platforms | Responsive web + Capacitor Android |
| Visual | Existing admin theme + `useT()`, Drive/OneDrive UX |
| Delete | Permanent, with themed confirm dialog |
| Collision on upload | `onConflict = fail | rename | overwrite`, default `fail`, resolved by UI prompt |

## 4. Current State (what we replace)

**Frontend** — `db-world-frontend/src/features/admin/filemanager/` (14 files), route `/db-world/admin/files`, guarded by `PrivateRoute allowedRoles=[ADMIN,OWNER]`. Stack: MUI + TanStack Query + Zustand + RHF/Zod + Framer Motion + Notistack + `useT()`.

**Backend** — `db-world-backend/.../app/filemanager/`:
- `controller/FileManagerController.java` (`/api/admin/file-manager`, `@AdminAccess`).
- `controller/FileDownloadStreamController.java` (public, ticket-gated stream — in `PUBLIC_APIS`).
- `service/FileManagerService.java` — a **439-line monolith** mixing path-jailing, DTO mapping, MIME guessing, all file operations, and an in-memory download-ticket map.
- Single jailed base dir = `app.data-path` (prod `/srv/dbworld`).

**Known problems to fix:**
1. Uploads are a single multipart POST — no chunking, no resume; fails for large/flaky 10 GB transfers.
2. `UploadDialog` ignores `FileUploadResultDto` → per-file failures reported as success.
3. Fake per-file progress (one aggregate % applied to every row).
4. Native `window.confirm()` for deletes clashes with the UI.
5. Move/Copy destination is a free-text absolute path — error-prone.
6. No preview of any kind.
7. `toDto()` does `Files.list().count()` per directory entry — extra scan per row.
8. Recursive search has no depth limit.
9. Download tickets are per-instance in-memory (lost on restart).
10. Single location only.

## 5. Architecture

### 5.1 Backend decomposition (DRY, single-responsibility)

Split the monolith into focused, independently testable units under `app/filemanager/`:

| Unit | Responsibility | Depends on |
|---|---|---|
| `location/FileLocation` (entity) + `FileLocationRepository` | Persist locations (id, label, absolutePath, enabled, sortOrder, timestamps) | JPA |
| `location/FileLocationService` | Location CRUD + validation (path exists, is dir, readable); resolve `locationId` → base `Path`; startup seed of `app.data-path` | repository, `AppProperties` |
| `path/PathJail` (reusable) | Given a base dir + raw relative path: strip leading slashes, normalize, `startsWith` check, `toRealPath()` symlink guard, `toRelative()` | none |
| `mapper/FileMetadataMapper` | `Path` → `FileItemDto`; `formatSize`; `guessMime` (extension→MIME); optional lazy childCount | none |
| `service/FileOperationsService` | list, search (depth-bounded), info, mkdir, rename, move, copy, delete — all resolve `{locationId, relPath}` via `FileLocationService` + `PathJail` | location svc, jail, mapper |
| `upload/UploadSession` (entity) + `UploadSessionRepository` | Persist chunk-upload sessions (uploadId, locationId, targetPath, fileName, totalSize, chunkSize, receivedBytes, nextIndex, status, timestamps) | JPA |
| `upload/UploadSessionService` | init / append-chunk / status / complete (atomic move) / abort; collision policy; checksum verify | session repo, location svc, jail |
| `upload/UploadSweeper` | Scheduled purge of stale/incomplete `.part` files + sessions | session repo |
| `download/DownloadService` | One-time ticket issue/consume (in-memory, 60s TTL — adequate for the single-node Pi deployment) + **range-aware** streaming | location svc, jail |
| `preview/ThumbnailService` | On-demand, disk-cached thumbnails (image downscale, video first-frame, PDF first page) — reuse approach from `WalletThumbnailer` | jail, ffmpeg/pdf libs already present |
| `preview/TextPreviewService` | Bounded (first N KB) text read for code/log preview | jail |
| Controllers | `FileManagerController` (operations), `FileLocationController` (location CRUD), `FileUploadController` (chunk protocol), `FileDownloadStreamController` (public ranged stream + thumbnails) | services |

`PathJail` and `FileMetadataMapper` are the key de-duplication wins — the jail logic and DTO mapping currently repeated/inlined become one reusable unit each, parameterized by base dir so they work for any location.

### 5.2 Resumable upload protocol

All under `/api/admin/file-manager/uploads` (`@AdminAccess`):

1. `POST /init` — body `{locationId, path, fileName, totalSize, chunkSize, checksum?, onConflict}` → creates a `.part` file in `app.paths.temp/uploads/{uploadId}` + a DB `UploadSession`; returns `{uploadId, chunkSize}`.
2. `PUT /{uploadId}/chunk?index=N` — raw `application/octet-stream` body (one chunk). Server writes at offset `N*chunkSize`, updates `receivedBytes`/`nextIndex`. **Idempotent** per index (safe to re-send after a drop).
3. `GET /{uploadId}` — returns `{receivedBytes, nextIndex, status}` so the client resumes exactly where it left off (works across server restarts because the session is in the DB).
4. `POST /{uploadId}/complete` — verify total size (+ checksum if given), resolve collision per `onConflict`, **atomically move** the assembled file into the target location/path, delete the session, return the final `FileItemDto`.
5. `DELETE /{uploadId}` — abort: delete `.part` + session.

**Why this beats a 10 GB single POST:** each HTTP request carries only one ~8–16 MB chunk, so proxies/timeouts/memory are never stressed, progress is real per file, and any interruption resumes instead of restarting.

### 5.3 Downloads + streaming preview

- Add **HTTP Range** support (`Accept-Ranges: bytes`, `206 Partial Content`, `Content-Range`) to the streaming endpoint → video/audio seeking and resumable/large downloads via the browser or Android download manager.
- Keep the one-time-ticket → public `/download/stream` design (unchanged security model); ticket now also carries `locationId`.
- Thumbnails served from a cache dir; regenerated on demand.
- Text preview via bounded endpoint; client renders with syntax highlighting.

### 5.4 Frontend architecture

Rebuild `features/admin/filemanager/` keeping the stack. Module boundaries:

- `api/fileManagerApi.js` — operations + location CRUD (Axios, envelope `r.data.data`).
- `upload/resumableUploader.js` — framework-agnostic chunker: concurrency limit, retry w/ exponential backoff, resume via `GET /{uploadId}`, progress/speed/ETA events. Reads browser `File`/`Blob`; on Android reads via Capacitor Filesystem and chunks the same way.
- `store/useFileManagerStore.js` (Zustand) — nav (locationId + path), viewMode, sort/filter, **selection Set** (multi-select), clipboard (cut/copy), dialog state.
- `store/useUploadStore.js` (Zustand) — active uploads, per-file progress/state, tray visibility.
- Hooks (TanStack Query): `useDirectory`, `useLocations`, `useSearch`, `useFileInfo`; mutations for mkdir/rename/move/copy/delete/location-CRUD with cache invalidation keyed by `[locationId, path]`.
- Components:
  - `LocationsRail` + `FolderTree` (lazy-expanding) — desktop sidebar; `LocationsMenu` + breadcrumb on mobile.
  - `Breadcrumb`, `Toolbar` (upload / new folder / grid–list toggle / sort / filter / search).
  - `FileGrid` (thumbnail cards) + `FileList` (table) + `FileMobileList`.
  - `SelectionLayer` — checkbox + click/shift-click/ctrl-click range & toggle selection; long-press on mobile; select-all.
  - `ContextMenu` (right-click / long-press) and per-row/card actions: open, download, rename, move, copy, cut, info, delete.
  - `PreviewPanel` — desktop slide-in drawer / mobile full-screen sheet (reuse the no-drag bottom-sheet pattern): image (zoom/pan), `<video>`/`<audio>` (ranged), PDF, syntax-highlighted text.
  - `MoveCopyDialog` — **folder-tree picker** (not free-text) for destination.
  - `RenameDialog`, `NewFolderDialog` (RHF + Zod).
  - `UploadTray` — persistent, concurrent uploads, real per-file progress + speed + ETA, pause/resume/cancel/retry.
  - `LocationManagerDialog` — admin CRUD for locations with path validation feedback.
  - `ConfirmDialog` — themed, replaces `window.confirm`.
  - `InfoDrawer` — metadata + quick actions.
- Drag-and-drop: drag selected items onto a folder/tree node → move; drag files from OS into the window → upload. Framer Motion for grid/list transitions, drawer/sheet, tray, drag affordances, skeleton loaders.
- Keyboard (desktop): arrows, Enter (open), F2 (rename), Delete, Ctrl/Cmd+A (select all), Ctrl+C/X/V (copy/cut/paste), Esc (clear/close).

### 5.5 Data flow

- Listing/search/info/locations via TanStack Query (cache keyed by location+path; mutations invalidate).
- Uploads bypass React Query: `resumableUploader` → `useUploadStore` → `UploadTray`; on `complete`, invalidate the affected directory query so the new file appears.
- Downloads: ticket → anchor to public ranged stream (web); Capacitor Filesystem native save (Android), reusing the wallet download helper pattern.

## 6. Data model (new tables)

- `file_manager_location(id, label, absolute_path, enabled, sort_order, created_at, updated_at)`
- `file_upload_session(id, upload_id, location_id, target_path, file_name, total_size, chunk_size, received_bytes, next_index, checksum, on_conflict, status, created_at, updated_at)`

SQL migration files added under the project's existing migration location; startup seeding inserts the current `app.data-path` as the first location if the table is empty (preserves today's behavior).

## 7. Security

- All operation, location-CRUD, and upload endpoints keep `@AdminAccess` (OWNER/ADMIN). Public stream stays ticket-gated only.
- Every filesystem access goes through `PathJail` bound to the *resolved location base*: leading-slash strip, normalize, `startsWith(base)`, and `toRealPath()` symlink-escape guard (carried over from current copy logic and applied everywhere).
- Location creation validates + normalizes the absolute path (exists, directory, readable). **Explicitly acknowledged:** registering a location grants browse/write within it; this is intended for an owner managing their own server, and access can never escape a registered root.
- Names for mkdir/rename reject `/`, `\`, `..`.

## 8. Optimization & code-quality requirements

- **No duplication:** `PathJail` and `FileMetadataMapper` are shared by every operation; the frontend uses one `resumableUploader` for web + Android and one `ConfirmDialog`/`MoveCopyDialog` reused everywhere.
- Cheaper directory listing: avoid the per-row `Files.list().count()`; compute `childCount` lazily or via a single cheaper probe.
- Bounded recursive search (depth + result cap) and streamed (no full-tree materialization).
- Chunked, offset-based writes; streamed range reads (never buffer whole files in memory).
- Frontend: virtualized grid/list for large directories; lazy tree expansion; debounced search; thumbnail lazy-loading.
- Modern idioms consistent with the codebase (Java records/switch expressions/`Files.*`, React hooks + Suspense + Query).

## 9. Old-code removal

Once the redesign is implemented and verified (backend tests green, web UI verified in preview, build green), remove superseded code in the same branch:

- Frontend: replace the contents of `features/admin/filemanager/` (delete `UploadDialog.jsx` single-POST flow, `FileOperationDialog.jsx` free-text move/copy, and any files with no successor); keep the route.
- Backend: collapse `FileManagerService` into the new units and delete it; remove the old single-shot `/upload` multipart endpoint and the two-arg `downloadFile(path,name)` dead client calls; drop unused DTOs/requests.
- Verify no remaining imports reference deleted symbols before committing the removal.

## 10. Testing

- **Backend (JUnit, matching wallet rigor):** `PathJail` (traversal + symlink escape), `FileLocationService` (validation, resolve, seed), `FileOperationsService` (list/search/info/mkdir/rename/move/copy/delete + collisions), `UploadSessionService` (init/chunk/resume/complete/abort/checksum/collision), ranged `DownloadService`, `ThumbnailService`, security guards.
- **Frontend:** unit-test `resumableUploader` (chunking, retry, resume) and selection/clipboard store logic; component tests where practical.
- **Verification:** run the web UI in the browser-preview tools and exercise upload (incl. simulated interruption/resume), download (range), preview per type, and the full operation set. Android build handed to the user (per the Android build-loopback constraint).

## 11. Infra dependency (user action at deploy)

- nginx (separate `db-world-config` repo): set `client_max_body_size` ≥ ~32 MB (chunk + headroom) on the file-manager upload path. We do **not** need a 10 GB limit because each request is one chunk. Range download needs no special nginx config.

## 12. Migration / compatibility

- Route `/db-world/admin/files` and the `@AdminAccess` model are preserved.
- On first run, seed the existing `app.data-path` as location #1 so current file access is unchanged.
- Rollout is within the single feature branch; old endpoints are removed only after the new ones are verified.
