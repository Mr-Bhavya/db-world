# Android Download Manager — Design Spec

**Date:** 2026-06-06
**Status:** Approved design, pending implementation plan
**Component:** `db-world-frontend` Android (Capacitor native plugin + React UI)

---

## 1. Problem

The current Android download manager is unreliable: downloads auto-stop, are
unstable, disappear, and there is no persistent history. Pause/resume and the
queue do not work properly.

### Root causes (verified in `DbWorldDownloadPlugin.java`)

| Symptom | Cause |
|---|---|
| Auto-stops / unstable | Download runs on a bare `Executors.newSingleThreadExecutor` background thread, **not a foreground service**. Android kills the process when backgrounded or under memory pressure → the thread dies → download stops silently. |
| Downloads gone, no history | **Nothing is persisted.** `activeTasks`, `pendingQueue`, `finishedItems` are all in-memory. Process death wipes active, queued, *and* history. `listDownloads()` only reflects the current session. |
| Pause/resume flaky | Pause sleeps the thread while holding the TCP socket open (`while(paused) Thread.sleep(200)`), relying on back-pressure. No HTTP `Range` / saved offset, so a real pause or any disconnect loses progress and can never resume after restart. |
| Queue issues | Serial single-download, in-memory queue; queued items get unstable synthetic IDs (`queued_0`…) and **cancel is a no-op** for them. |
| Latent | No retry/backoff (one network blip = `failed`); legacy `WRITE_EXTERNAL_STORAGE` + public Downloads dir, fragile on Android 10+. |

### Enabling facts (verified)

- CDN (`cdn.db-world.in`) sends `Accept-Ranges: bytes` → resumable downloads are fully supported by the server.
- CDN URLs are **not signed or time-limited** — nginx serves files directly and the query params are only used for logging. A stored download URL keeps working indefinitely, so resume across restarts needs no token refresh.
- Android `minSdk 23`, `compileSdk/targetSdk 35`.
- App already bundles `okhttp:4.12.0` and `androidx.media3` (ExoPlayer). The native player (`DbWorldPlayer.launch({ url, ... })`) accepts a URL, so offline playback = pass it a local URI.
- Download trigger: `useMediaActions.handleDownload` → `resolveMediaUrl(mediaFileId, 'DOWNLOAD')` → `cdnUrl` → `DbWorldDownload.startDownload({ url, fileName, title, thumbnailUrl })`.

---

## 2. Goals

Produce a production-ready download manager with:

- Stable downloads that survive app backgrounding and process death.
- Persistent history and queue across restarts.
- Real pause / resume (HTTP `Range`, mid-session and across restarts).
- Queue with configurable concurrency.
- Delete, redownload.
- Auto-retry with backoff; auto-pause on network loss + auto-resume on reconnect.
- Wi-Fi-only / data-saver toggle.
- Notification with Pause / Resume / Cancel actions.
- Files both playable offline in-app **and** visible in the phone's Downloads.

### Non-goals (deferred to phase 2)

- Record-card "Downloaded" badges and automatic "play offline when present".
- HLS/DASH offline (current content is progressive files).
- At-rest encryption of downloaded files.

---

## 3. Architecture

```
JS (useDownloads + Download Manager page)
        │  Capacitor bridge (same method names, richer events)
        ▼
DbWorldDownloadPlugin (Java)  ──►  Fetch2  ──►  OkHttp (Range requests)
        │                          │  (its own SQLite DB = persistence)
        │                          ▼
        │                   .part temp in app-private dir (resumable)
        ▼                          │ on complete
DownloadForegroundService          ▼
(keeps process alive while         MediaStore "Download/DB-World" (API 29+)
 any download is active)           or public Downloads (≤28) — visible file
```

**Engine:** [Fetch2 (tonyofrancis/Fetch)](https://github.com/tonyofrancis/Fetch) is
the single source of truth. Its persisted SQLite DB tracks every download (url,
bytes downloaded, total, status) and carries our metadata in per-download
`extras`. No separate Room DB.

**Process survival:** a lightweight `DownloadForegroundService` is started when
the first download becomes active and stopped when none remain. Fetch performs
the actual downloading on its own threads; the service exists only to keep the
process alive and host the summary notification. This is the core fix for
"auto-stops".

**Visibility:** completed files are moved into the public Downloads collection so
they appear in the Files app while remaining the in-app playback source.

---

## 4. Storage & offline playback

1. Fetch downloads into a `.part` file in the **app-private external dir**
   (`getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)/DB-World/`). No storage
   permission required on any Android version; this is the resumable scratch file.
2. On completion the file is **moved** (rename, not copy — no 2× disk) into:
   - **API ≥ 29:** `MediaStore.Downloads`, `RELATIVE_PATH = Download/DB-World/`.
   - **API ≤ 28:** public `Environment.DIRECTORY_DOWNLOADS/DB-World/` via file path
     (requires `WRITE_EXTERNAL_STORAGE`, which is only requested on these versions).
3. The resulting **content URI** (API 29+) or **file path** (≤28) is stored in the
   Fetch download's `extras` as `localUri`.
4. Playback: a completed item calls the existing
   `launchNativePlayer({ url: localUri, title, fileName, fileId })`. ExoPlayer/Media3
   plays both `content://` and `file://` URIs, reusing the current resume-position
   save logic.

**Naming/collisions:** if a file of the same name already exists in DB-World,
suffix with ` (1)`, ` (2)`, … to avoid clobbering.

---

## 5. State model

Statuses surfaced to JS: `queued`, `downloading`, `paused`, `completed`,
`failed`, `cancelled`.

Mapping from Fetch `Status`:

| Fetch Status | JS status |
|---|---|
| `QUEUED`, `ADDED` | `queued` |
| `DOWNLOADING` | `downloading` |
| `PAUSED` | `paused` |
| `COMPLETED` | `completed` |
| `FAILED` | `failed` |
| `CANCELLED`, `REMOVED`, `DELETED` | `cancelled` (then dropped) |

**Restart behavior:** on `plugin.load()` we initialize Fetch and read all
downloads from its DB, emitting the full list. Incomplete downloads auto-resume
from their saved byte offset (subject to the network policy). Completed downloads
remain as history until explicitly deleted.

---

## 6. Behaviors

- **Pause / Resume** — `fetch.pause(id)` / `fetch.resume(id)`; real `Range` resume
  from the persisted offset, mid-session and across restarts.
- **Queue + concurrency** — `FetchConfiguration.setDownloadConcurrentLimit(2)`
  (configurable). Remaining downloads queue; priority is reorderable.
- **Auto-retry** — `setAutoRetryMaxAttempts(3)` with Fetch's backoff on transient
  errors.
- **Auto-resume on reconnect** — Fetch monitors connectivity and resumes downloads
  waiting on network when it returns.
- **Wi-Fi-only toggle** — persisted app setting → `fetch.setGlobalNetworkType(...)`
  (`WIFI_ONLY` vs `ALL`); auto-pauses on mobile data when enabled. Exposed via
  `setNetworkPolicy({ wifiOnly })`.
- **Notifications** — Fetch's `FetchNotificationManager` renders per-download
  progress with **Pause / Resume / Cancel** actions and tap-to-open; the foreground
  service hosts a group summary.
- **Redownload** — `fetch.retry(id)` for `failed`/`cancelled`; for a `completed`
  item whose file was deleted, re-enqueue a fresh request from the stored URL.
- **Delete** — remove the MediaStore entry (or file) **and** the Fetch DB row.

---

## 7. JS ↔ native API contract

Method names preserved for backward compatibility; additions marked **new**.

| Method | Args | Returns |
|---|---|---|
| `ensurePermissions()` | — | `{}` (requests POST_NOTIFICATIONS on 33+, WRITE_EXTERNAL_STORAGE on ≤28) |
| `startDownload(opts)` | `{ url, fileName, title, thumbnailUrl, mediaFileId?, recordId? }` | `{ downloadId, queued, alreadyDownloaded? }` |
| `listDownloads()` | — | `{ downloads: [DownloadDTO] }` |
| `pauseDownload(opts)` | `{ downloadId }` | `{}` |
| `resumeDownload(opts)` | `{ downloadId }` | `{}` |
| `cancelDownload(opts)` | `{ downloadId }` | `{}` (stops + discards partial) |
| `deleteDownload(opts)` | `{ downloadId }` | `{}` (removes file + record) |
| `retryDownload(opts)` **new** | `{ downloadId }` | `{ downloadId }` |
| `setNetworkPolicy(opts)` **new** | `{ wifiOnly: boolean }` | `{}` |
| `getSettings()` **new** | — | `{ wifiOnly, concurrentLimit }` |

**DownloadDTO** (stable shape consumed by `normalizeDownload`):
`downloadId, title, fileName, status, progress, bytesDownloaded, bytesTotal,
speedBytesPerSec, etaSeconds, localUri, playableUri, mimeType, thumbnailUrl,
canPlay`.

**Events** (Capacitor `notifyListeners`):
`downloadAdded`, `downloadProgress`, `downloadStateChanged`, `downloadComplete`,
`downloadError`, `downloadRemoved` — each carrying a `DownloadDTO`.

`downloadId` is now the stable Fetch integer ID (as string) for the lifetime of
the download, including while queued — fixing the old unstable `queued_N` IDs.

---

## 8. UI changes (React)

- **`useDownloads.js`** — drive entirely off events (drop the 2s polling loop); add
  `retry` action and Wi-Fi-only setting read/write. Keep `normalizeDownload`.
- **`download-queue/index.jsx`** — rebuild into a Download Manager with sections:
  **Active / Queued**, **Completed**, **Failed**. A header control for the
  Wi-Fi-only toggle.
- **`DownloadItem.jsx`** — show progress bar, speed, ETA, and contextual action
  buttons (pause/resume/cancel for active; play/delete/redownload for completed;
  retry/delete for failed). Completed item → `launchNativePlayer({ url: localUri })`.
- **`useMediaActions.handleDownload`** — pass `mediaFileId` and `recordId` through
  to `startDownload` so they land in Fetch `extras`.

---

## 9. Android manifest / Gradle

**Gradle (`android/`):**
- Add JitPack repo (`maven { url 'https://jitpack.io' }`).
- Add `com.github.tonyofrancis.Fetch:fetch2:3.1.6` and
  `:fetch2okhttp:3.1.6` (latest published; reuses bundled OkHttp 4.12). Pin
  exactly and verify the build against SDK 35 during the first plan step.

**Manifest:**
- Add `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `ACCESS_NETWORK_STATE`.
- Keep `POST_NOTIFICATIONS`; scope `WRITE_EXTERNAL_STORAGE` to `maxSdkVersion="28"`.
- Declare `DownloadForegroundService` with `foregroundServiceType="dataSync"`.

---

## 10. Migration

- The native plugin is replaced wholesale; method names and event names remain
  compatible, so the JS bridge keeps working during the transition.
- No persisted state exists today (in-memory only), so there is nothing to migrate.
  Files already sitting in `Downloads/DB-World` from the old plugin are picked up
  lazily: on first `listDownloads()` we scan that directory and register any
  untracked files as `completed` history entries.

---

## 11. Risks & mitigations

- **Fetch2 maintenance** — mature but lightly maintained since ~2021. Works on
  AndroidX / SDK 35. Mitigation: pin a known-good version; the integration surface
  is small and behind our plugin, so it can be swapped if needed.
- **Foreground-service limits (Android 14/15)** — `dataSync` FGS is time-limited
  (~6h/day on Android 15). Acceptable for video downloads; if a session is killed
  by the limit, Fetch's persisted state + auto-resume recover it on next launch.
- **Scoped storage** — avoided during the long download by using the app-private
  `.part` file; MediaStore is touched only for the final, quick move.
- **Large-file move** — use rename within the same volume where possible; fall back
  to a streamed copy + delete if crossing volumes.

---

## 12. Acceptance criteria

1. A download continues when the app is backgrounded and when the WebView is
   evicted from memory (foreground service holds the process).
2. Killing and relaunching the app shows the same downloads with correct status;
   in-progress downloads resume from their saved offset.
3. Pause then resume (including after a relaunch) continues from the saved byte
   offset, not from zero.
4. Two downloads run concurrently; a third queues and starts automatically.
5. Toggling Wi-Fi-only pauses active mobile-data downloads and resumes them on
   Wi-Fi.
6. The ongoing notification shows working Pause / Resume / Cancel buttons.
7. A completed file appears in the phone's Files app under Download/DB-World and
   plays offline in the in-app player.
8. Delete removes both the file and the history entry; redownload re-fetches.
9. Transient network errors retry automatically; dropping the network auto-pauses
   and reconnecting auto-resumes.
