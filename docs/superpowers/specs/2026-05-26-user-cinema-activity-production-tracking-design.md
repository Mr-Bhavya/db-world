# Design Spec: Production-Grade User Cinema Activity Tracking

**Date:** 2026-05-26
**Branch:** `fix/review-notifications-recipient-scope` already merged for the unrelated bell fix; new work goes on a fresh branch off `dev_acc` per project workflow rules.
**Status:** Approved (design phase complete, implementation plan pending)
**Hardware target:** Raspberry Pi 5

---

## Overview

Turn `user_cinema_activity` into the canonical, trustworthy source of user engagement data for db-world. Today the entity has all the right columns but most are written once at `/resolve` time and never updated — the per-chunk update methods exist as commented-out dead code. NGINX serves files directly with no callback into the app, so the lifecycle (start → progress → completion → aborted) is never closed.

This spec covers five sub-projects, designed as one document and implemented as five mergeable phases:

| Phase | Sub-project | Scope |
|---|---|---|
| 1 | **Schema cleanup** | Drop 5 unused columns; add `watch_progress_id` FK; add `log_shipper_state` table; backfill `record_id`/`media_file_id` |
| 2 | **NGINX log shipper + ABORTED sweeper** | Replace dead per-chunk upserts with a real lifecycle: tail NGINX JSON access log, aggregate per `download_id`, sweep stalled rows |
| 3 | **`watch_progress` ↔ `user_cinema_activity` bridge** | Dual-write the FK; unified read DTO; LEFT JOIN repository |
| 4 | **Frontend Activity surface** | New `/me/activity` user page + `/adminv2/analytics` admin dashboard |
| 5 | **Recommendation rails** | Genre-affinity (multi-instance) + site-wide rewatch trend |

Each phase is independently mergeable once predecessors land. No phase blocks the next's design, but each depends on the previous for data correctness.

## Non-goals

- Geographic / IP-based recommendations (no geoip dependency added).
- Time-of-day / session-length signals.
- Collaborative filtering or ML-based recommendations.
- Mobile-first redesign of the frontend (desktop-first; responsive but not phone-specific).
- A separate `/me/downloads` page (folded into `/me/activity`).
- Per-record "your history" inline widget on record detail pages.

---

## Architecture

```
                        ┌───────────────────────────────────────────┐
                        │           SPRING BOOT (Pi 5)              │
                        │                                           │
   client       /resolve │  ┌──────────────────┐                   │
   ─────────────────────►│  │ StreamController │                   │
                        │  └─────────┬────────┘                   │
                        │            │ writes STARTED row          │
                        │            ▼                              │
                        │  ┌──────────────────────────────────┐    │
                        │  │  USER_CINEMA_ACTIVITY            │    │
                        │  │  (id, user_id, downloadId, …)    │    │
                        │  └────────▲─────────────▲───────────┘    │
                        │           │ UPDATE      │ UPDATE          │
                        │           │             │ (set ABORTED)   │
                        │  ┌────────┴────────┐  ┌─┴───────────────┐ │
                        │  │ LogShipper      │  │ AbortedSweeper  │ │
                        │  │ (every ~5s)     │  │ @Scheduled 5min │ │
                        │  └────────▲────────┘  └─────────────────┘ │
                        │           │ reads + aggregates             │
                        │           │ per download_id                │
                        └───────────┼───────────────────────────────┘
                                    │
              CDN serves            │ tail JSON log + offset state
                  ▼                 │
          ┌────────────────┐        │
          │     NGINX      │────────┘
          │ cdn_access.json│
          └────────────────┘
              ▲
              │ client downloads/streams (downloadId in URL)
   ─────────────────────────────
   client (browser / aria2 / IDM / VLC / mpv / kodi)


   WATCH_PROGRESS (live cursor) ◄── FK from USER_CINEMA_ACTIVITY (nullable)
        ▲
        │ play-tick PUT /api/cinema/progress (unchanged hot path)
   browser/native player
```

**Two-stream write model**

| Event | Source | Recorded by |
|---|---|---|
| Start (row creation, user binding, recordId, mediaFileId, downloadId) | `/resolve` API | App, as today (`trackResolveActivity`) |
| Progress + Completion (bytes_transferred, completion_percent, completion_status, avg_speed_bps, connection_count) | NGINX access log | LogShipperService, batched every ~5s |
| ABORTED transitions | Time-based inference | AbortedSweeper, every 5 min |
| Watch position (position_ms, duration_ms, lang) | Player tick | `WatchProgressService` (unchanged) |

**Failure isolation**
- Shipper down → log keeps growing on disk; app keeps serving; rows resume updating when shipper returns. Catches up from saved offset.
- NGINX down → no new activity, no harm.
- MySQL down → shipper retries on next tick; absolute-value UPDATEs are idempotent.
- Player tick path → unchanged; not affected by shipper failures.

---

## Phase 1 — Schema cleanup

### Pre-deploy migration (`user_cinema_activity_v3_phase1_predeploy.sql`)

```sql
-- 1. Add watch_progress FK column
ALTER TABLE user_cinema_activity
    ADD COLUMN watch_progress_id BIGINT NULL,
    ADD INDEX idx_uca_watch_progress (watch_progress_id),
    ADD CONSTRAINT fk_uca_watch_progress
        FOREIGN KEY (watch_progress_id) REFERENCES watch_progress(id)
        ON DELETE SET NULL;

-- 2. Singleton state table for the log shipper
CREATE TABLE log_shipper_state (
    id                TINYINT      NOT NULL DEFAULT 1,
    file_path         VARCHAR(500) NOT NULL,
    inode             BIGINT       NOT NULL DEFAULT 0,
    byte_offset       BIGINT       NOT NULL DEFAULT 0,
    last_processed_at TIMESTAMP    NULL,
    PRIMARY KEY (id),
    CHECK (id = 1)
);

-- 3. Backfill record_id / media_file_id for orphan rows
UPDATE user_cinema_activity uca
JOIN media_files mf ON mf.file_path = uca.file_path
SET uca.record_id    = mf.record_id,
    uca.media_file_id = mf.id
WHERE uca.record_id IS NULL;
```

### Post-deploy migration (`user_cinema_activity_v3_phase2_postdeploy.sql`)

Runs only after Phase 2 code is live and writing to the new columns:

```sql
ALTER TABLE user_cinema_activity
    DROP COLUMN http_protocol,
    DROP COLUMN referer,
    DROP COLUMN country_code,
    DROP COLUMN error_code,
    DROP COLUMN update_count;
```

Rationale for dropping each column:
- `http_protocol` — never read; NGINX log doesn't expose `$server_protocol` in the current format.
- `referer` — never read; not in NGINX log format.
- `country_code` — never read; no geoip dependency (rejected non-goal).
- `error_code` — overlaps with `completion_status=ABORTED`; HTTP-status-as-error is too low-fidelity.
- `update_count` — derived counter, never read.

### Entity changes

`db-world-backend/src/main/java/com/db/dbworld/audit/activity/entity/UserCinemaActivityEntity.java`:
- Remove the 5 fields above.
- Add `@Column(name = "watch_progress_id") private Long watchProgressId;` (NOT a `@ManyToOne` — kept as a plain Long to avoid lazy-loading WatchProgress on every cinema_activity fetch).

---

## Phase 2 — NGINX log shipper + ABORTED sweeper

### Background: what's in the NGINX log

Sample line (confirmed against `server_config/dbworld.conf:315–379` log_format definition and against real samples provided 2026-05-26):

```json
{
  "time":"2026-05-23T19:39:32+05:30",
  "remote_addr":"172.69.178.111",
  "real_ip":"103.228.144.117",
  "method":"GET",
  "uri":"/id/1f8274eb-…?userId=…&type=ONLINE&downloadId=DL_5af9410d_65739&…",
  "status":206,
  "bytes_sent":12992921,
  "content_range":"bytes 740967-2541759867/2541759868",
  "range_header":"bytes=740967-",
  "file":"Butterfly.2022…mkv",
  "file_id":"/id/1f8274eb-…",
  "user":"pruthvishdudhia%40gmail.com",
  "download_id":"DL_5af9410d_65739",
  "request_id":"23ee4e9d-…",
  "type":"ONLINE",
  "event":"PARTIAL",
  "duration_sec":"0.399",
  "user_agent":"Dalvik/2.1.0 (Linux; U; Android 13; …)",
  "server":"cdn.db-world.in"
}
```

**Field-to-column mapping**

| Log field | Maps to entity | Per-line or aggregated |
|---|---|---|
| `bytes_sent` | `bytes_transferred` | aggregated (sum with byte-interval merge) |
| `content_range` | derives `file_size` + per-request byte coverage | per-line input |
| `status` | input to error/abort decision | per-line |
| `duration_sec` | input to `avg_speed_bps` | per-line |
| `user_agent` | `client_type` (enum mapper) | per-line |
| `real_ip` | `remote_addr` (NOT log's `remote_addr` — that's Cloudflare) | per-line |
| `download_id` | join key to existing row | per-line |
| `type` | maps to `ActivityType` (ONLINE→STREAM, DOWNLOAD→DOWNLOAD) | per-line |
| `time` | `last_updated` | aggregated (MAX) |

**Critical clarification:** the log's `event:"COMPLETE"` field marks per-HTTP-request completion (status 200), NOT logical session completion. A streaming player produces many `COMPLETE` lines as it issues range requests. Logical completion is inferred from cumulative byte coverage ≥ file_size, not from this field.

### Components

All under `db-world-backend/src/main/java/com/db/dbworld/audit/activity/shipper/`:

| File | Purpose |
|---|---|
| `LogShipperService.java` | `@Service`, `@Scheduled(fixedDelay=5000)`, owns the tick loop |
| `LogLineParser.java` | Jackson-based JSON line parser (selective fields, fail-soft on malformed lines) |
| `DownloadAccumulator.java` | Per-`download_id` rolling state; merges byte intervals |
| `LogShipperStateEntity.java` + `LogShipperStateRepository.java` | Wraps the singleton state row |
| `LogShipperProperties.java` | `@ConfigurationProperties("dbworld.log-shipper")` |
| `AbortedSweeper.java` | Separate `@Scheduled` sweeper |
| `AbortedSweeperProperties.java` | `@ConfigurationProperties("dbworld.aborted-sweeper")` |

### Per-tick algorithm

1. Load `log_shipper_state` row.
2. `Files.readAttributes(path, BasicFileAttributes.class)` → get current inode and size.
3. **Rotation detection:**
   - If `current_inode != state.inode`: read leftover `cdn_access.json.1` from `state.byte_offset` to its EOF (if exists), then switch to current file at offset 0. Update saved inode.
   - If `file_size < state.byte_offset`: file was truncated; reset offset to 0.
4. Open file with `FileChannel`, seek to `state.byte_offset`, read forward to EOF.
5. For each line: parse JSON → accumulate by `download_id`. Accumulator holds:
   ```
   downloadId → {
     byteIntervals: List<[start, end]>,
     sumBytesSent: long,
     sumDurationSec: double,
     maxTime: Instant,
     fileSizeFromContentRange: Long,
     requestIdsByTime: TreeMap<Instant, Set<String>>,  // for connection_count peak
     userAgent: String (latest),
     realIp: String (latest),
     type: String (ONLINE/DOWNLOAD),
     anyStatusAbove400: boolean
   }
   ```
6. After parsing all lines, for each `download_id`:
   - **Merge byte intervals** into disjoint coverage; `unique_bytes = sum of merged interval lengths`.
   - `bytes_transferred = unique_bytes`
   - `completion_percent = unique_bytes * 100 / file_size` (clamp 0–100)
   - `avg_speed_bps = sumBytesSent / sumDurationSec` (skip if duration ≈ 0)
   - `connection_count = max overlap count in any 1-sec window of requestIdsByTime`
   - `last_updated = maxTime`
   - If `completion_percent >= 100`: set `completion_status = COMPLETED`, `last_completed_at = maxTime`, increment `download_count` (DOWNLOAD) or `stream_count` (STREAM) — only on first transition into COMPLETED for this download_id (detected via `WHERE completion_status <> 'COMPLETED'` in the UPDATE).
   - Otherwise: set `completion_status = IN_PROGRESS`.
   - Set `client_type` (parsed from latest userAgent) only if currently UNKNOWN.
   - `remote_addr = realIp`.
7. **Bulk UPDATE** rows by `download_id` in one transaction.
8. **Atomic offset advance:** `UPDATE log_shipper_state SET byte_offset = :newOffset, inode = :inode, last_processed_at = NOW()`.

If step 7 fails: do NOT advance offset; accumulator is discarded; next tick re-reads same lines and re-runs UPDATEs (idempotent because all writes are absolute values, except the download_count increment guarded by the `<> 'COMPLETED'` predicate).

### ABORTED sweeper

`AbortedSweeper.java`, `@Scheduled(cron = "0 */5 * * * *")` (every 5 minutes), runs one SQL:

```sql
UPDATE user_cinema_activity
SET completion_status = 'ABORTED',
    last_updated      = NOW()
WHERE completion_status IN ('STARTED', 'IN_PROGRESS')
  AND completion_percent < 95
  AND activity_type IN ('STREAM', 'DOWNLOAD')
  AND last_updated < NOW() - INTERVAL
      CASE activity_type
        WHEN 'STREAM'   THEN :streamTimeoutMin
        WHEN 'DOWNLOAD' THEN :downloadTimeoutMin
      END MINUTE;
```

Defaults: `streamTimeoutMin=15`, `downloadTimeoutMin=30`. SEARCH activities are not swept (no transfer lifecycle).

### Dead code removal (same PR as Phase 2)

- Delete `trackDownloadActivity` and `trackStreamActivity` methods from `UserCinemaActivityService` and `UserCinemaActivityServiceImpl`.
- Delete commented-out callsites in `db-world-backend/src/main/java/com/db/dbworld/services/media/impl/StreamServiceImpl.java:308–311`.
- Delete `db-world-backend/src/main/java/com/db/dbworld/services/media/impl/StreamServiceImpl_BAK.java` entirely.

### Configuration

```yaml
dbworld:
  log-shipper:
    enabled: true
    log-file-path: /var/log/nginx/cdn_access.json
    rotated-suffix: ".1"
    batch-tick-ms: 5000
    max-accumulator-entries: 10000
    max-bytes-per-tick: 5242880   # 5 MB safety cap
  aborted-sweeper:
    enabled: true
    stream-timeout-min: 15
    download-timeout-min: 30
```

---

## Phase 3 — `watch_progress` ↔ `user_cinema_activity` bridge

### FK population — dual-write

Both write paths set `user_cinema_activity.watch_progress_id` when discoverable. Both are idempotent (no-op if already set).

**1. At `/resolve` time** — `app/stream/service/impl/StreamServiceImpl.java:69, 104`

After `trackResolveActivity` returns and the activity row is persisted:

```java
if (activityType == ActivityType.STREAM && mediaFileId != null) {
    watchProgressRepository.findByUserIdAndFileId(userId, mediaFileId)
        .ifPresent(wp -> activityRepository.setWatchProgressIdIfNull(activityRow.getId(), wp.getId()));
}
```

**2. At watch-progress save time** — `app/cinema/progress/service/impl/WatchProgressServiceImpl.java`, the `PUT /api/cinema/progress` path

After upserting `watch_progress`:

```java
activityRepository.findByUserIdAndMediaFileIdAndActivityType(userId, fileId, ActivityType.STREAM)
    .ifPresent(uca -> {
        if (uca.getWatchProgressId() == null) {
            activityRepository.setWatchProgressIdIfNull(uca.getId(), savedProgress.getId());
        }
    });
```

`setWatchProgressIdIfNull` is a custom `@Modifying` query: `UPDATE user_cinema_activity SET watch_progress_id = :wpId WHERE id = :ucaId AND watch_progress_id IS NULL` — concurrency-safe.

### Unified read DTO

`db-world-backend/src/main/java/com/db/dbworld/audit/activity/dto/UserActivityViewDto.java`:

```java
public record UserActivityViewDto(
    Long id,
    ActivityType activityType,
    Long recordId,
    String recordTitle,
    String recordType,
    String filePath,
    Long fileSize,
    String mediaFileId,
    CompletionStatus completionStatus,
    BigDecimal completionPercent,
    Integer downloadCount,
    Integer streamCount,
    ClientType clientType,
    Long avgSpeedBps,
    Instant lastUpdated,
    Instant lastCompletedAt,
    Long positionMs,        // from watch_progress, null for downloads
    Long durationMs,
    String audioLang,
    String subLang
) {}
```

### Repository query

New method on `UserCinemaActivityRepository`:

```sql
SELECT uca.id, uca.activity_type, uca.record_id, r.name AS record_title, r.type AS record_type,
       uca.file_path, uca.file_size, uca.media_file_id,
       uca.completion_status, uca.completion_percent, uca.download_count, uca.stream_count,
       uca.client_type, uca.avg_speed_bps, uca.last_updated, uca.last_completed_at,
       wp.position_ms, wp.duration_ms, wp.audio_lang, wp.sub_lang
FROM user_cinema_activity uca
LEFT JOIN watch_progress wp ON wp.id = uca.watch_progress_id
LEFT JOIN records r         ON r.id = uca.record_id
WHERE uca.user_id = :userId
  AND (:activityType IS NULL OR uca.activity_type = :activityType)
ORDER BY uca.last_updated DESC
LIMIT :limit OFFSET :offset
```

LEFT JOINs because:
- `watch_progress` legitimately has no row for downloads or for streams the user hasn't ticked yet.
- `records` may have no row for activities whose backfill failed (orphan `file_path`).

### What does NOT change

- `WatchProgressRepository` — unchanged.
- `WatchProgressService` API and DTO — unchanged; only one internal `activityRepository.setWatchProgressIdIfNull(...)` call added to save path.
- `/api/cinema/progress` REST surface — unchanged.

---

## Phase 4 — Frontend surfaces

Both pages comply with the locked adminv2 stack: TanStack Query, MUI DataGrid, Notistack, Framer Motion, `useT()` theme hook inside component bodies.

### `/me/activity`

**Route constant:** `Constants.DB_MY_ACTIVITY_ROUTE = '/me/activity'`. Added to the cinema navbar for logged-in users.

**Backend endpoints (new), under `app/cinema/me/activity/`:**

| Endpoint | Returns |
|---|---|
| `GET /api/me/activity/summary` | `MyActivitySummaryDto`: `{ totalStreamHours, totalDownloadGB, completionRate, topGenres[] }` |
| `GET /api/me/activity/top-rewatches?limit=6` | `List<TopRewatchDto>`: `{ recordId, title, posterUrl, downloadCount, streamCount, lastCompletedAt }` |
| `GET /api/me/activity?type=&page=&size=` | `Page<UserActivityViewDto>` |

**Frontend component tree** under `db-world-frontend/src/features/cinema/me/activity/`:

```
MyActivityPage.jsx                — page shell, TanStack Query hooks
├── ActivitySummaryCard.jsx       — 4 metric stats + genre chip row
├── TopRewatchesStrip.jsx         — horizontal poster strip, up to 6 entries
├── ActivityFilterTabs.jsx        — All / Streams / Downloads / Searches
├── ActivityTimelineList.jsx      — virtualized infinite-scroll list
├── ActivityRow.jsx               — poster, title, completion bar,
│                                   "Resume from Xm:Ys" or "Completed Nx" or "Downloaded N times",
│                                   relative timestamp; tap → record detail
└── api/myActivityApi.js          — query keys + TanStack Query hooks
```

Empty states use the existing `<EmptyState>` component. Errors surface via Notistack.

### `/adminv2/analytics`

**Route:** `/adminv2/analytics`. Gated by existing admin role guard. Sidebar entry added to `AdminLayout` between existing nav items.

**Backend endpoints (new), under `app/adminv2/analytics/`:**

| Endpoint | Returns |
|---|---|
| `GET /api/adminv2/analytics/overview` | `{ activeUsers7d, gbTransferred7d, completedTransfers7d, abortedRate7d }` |
| `GET /api/adminv2/analytics/trend?days=30` | `List<DailyActivityDto>`: `{ date, streams, downloads, gb }` |
| `GET /api/adminv2/analytics/client-breakdown` | `List<{ clientType, count }>` |
| `GET /api/adminv2/analytics/top-records?limit=20` | `List<{ recordId, title, streamCount, downloadCount, uniqueUsers }>` |
| `GET /api/adminv2/analytics/top-users?limit=20` | `List<{ userId, email, lastActive, totalActivities, totalGB }>` |

**Frontend component tree** under `db-world-frontend/src/features/admin/analytics/`:

```
AnalyticsDashboard.jsx
├── OverviewCards.jsx            — 4 metric cards
├── ActivityTrendChart.jsx       — line chart, daily for last 30d
├── ClientBreakdownChart.jsx     — donut chart by client_type
├── TopRecordsTable.jsx          — MUI DataGrid
├── TopUsersTable.jsx            — MUI DataGrid
└── api/analyticsApi.js
```

### Charting library

Recommend `@mui/x-charts` to keep dependency surface on MUI. If the existing adminv2 codebase already standardizes on a different chart library (verified at plan-writing time), the plan will use that one instead.

### Responsive behavior

Desktop-first. Both pages are responsive via MUI breakpoints but admin analytics is not designed for phones. User activity page works on mobile (single-column collapse, tabs become a select).

---

## Phase 5 — Recommendation rails

Two new rail types plug into the existing `RailResolver` pattern (`app/cinema/rail/service/RailResolver.java`). No frontend changes — rails are rendered by the existing rail system.

### Rail 1 — "More \<Genre\> for you" (genre affinity, multi-instance)

**Engaged-record definition:** a record counts toward a genre's score if any of:
- `completion_status = COMPLETED`, OR
- `completion_percent >= 70`, OR
- `download_count >= 1` (a finished download is a strong intent signal)

**Algorithm (per user, per rail request, cached 1h):**

1. Query joined `user_cinema_activity` + `records.genres` for the user's engaged records.
2. Group by genre, count distinct records, take top **N=3** by count.
3. For each top genre, emit one rail instance: title `"More {genreName} for you"`. Records in that genre the user hasn't engaged with, ordered by record popularity (reuses existing rail ordering).
4. Tie-break on equal counts: most-recent `lastUpdated`.

**Files (new):**
- `audit/activity/recommend/GenreAffinityService.java` — computes top genres
- `app/cinema/rail/service/impl/GenreAffinityResolver.java` — implements `RailResolver`

**Cold start:** if user has <3 engaged records, returns empty → rail hidden by existing `hasContent()` guard.

### Rail 2 — "Popular rewatches this week" (site-wide trend)

**Algorithm — single SQL refreshed hourly, served from in-memory cache:**

```sql
SELECT record_id, SUM(download_count + stream_count) AS rewatch_score
FROM user_cinema_activity
WHERE last_updated >= NOW() - INTERVAL 7 DAY
  AND completion_status = 'COMPLETED'
  AND record_id IS NOT NULL
GROUP BY record_id
HAVING rewatch_score >= 3
ORDER BY rewatch_score DESC
LIMIT 30
```

**Files (new):**
- `audit/activity/recommend/RewatchTrendService.java` — `@Scheduled(cron = "0 0 * * * *")` hourly refresher; stores result in a `volatile List<Long>` (no new table, no DB hit on rail load)
- `app/cinema/rail/service/impl/RewatchTrendResolver.java` — implements `RailResolver`

**Cold start:** brand-new install with no history → query returns empty → rail hidden.

### Configuration

```yaml
dbworld:
  recommend:
    genre:
      enabled: true
      top-n: 3
      min-engaged-records: 3
      completion-threshold: 70
      cache-ttl-min: 60
    rewatch:
      enabled: true
      refresh-cron: "0 0 * * * *"
      window-days: 7
      min-score: 3
      top-n: 30
```

### Admin registration

Per the recently merged `admin rails by page` system (commit `4f38340`), new rails are registered in `TagDefinition` / `RailEntity` so admins can enable/disable per page from `TagsRails`. The two new resolvers are wired into the resolver registry; visibility is admin-toggleable.

### Cleanup of existing "Because You Watched" resolver

`RailResolverImpl.resolveBecauseYouWatchedSource()` currently dual-table-fallbacks (watch_progress → user_cinema_activity). After Phase 3, both are FK-joined, so this method simplifies to one query through the unified DTO. Behavior unchanged.

---

## Cross-cutting concerns

### Error handling

| Failure | Behavior |
|---|---|
| Shipper: malformed JSON line | `WARN` log once with line content + offset, advance offset, continue |
| Shipper: log file missing on startup | `ERROR` log, retry every tick, app stays up |
| Shipper: inode rotation mid-batch | Finish current file from old offset, switch to new at offset 0 |
| Shipper: MySQL write failure | Do not advance offset; accumulator discarded; next tick re-reads (idempotent) |
| Shipper: file truncated (size < saved offset) | Reset offset to 0, `WARN` log |
| Shipper: accumulator OOM risk | Cap at `max-accumulator-entries` (10000); flush before exceeding |
| Sweeper: DB down | `@Scheduled` re-fires next interval; no special handling |
| Frontend: API failure | Notistack toast; query auto-retries via TanStack Query defaults |
| Frontend: empty state | `<EmptyState>` component, no error styling |

### Feature flags (`application.yml`)

```yaml
dbworld:
  log-shipper:
    enabled: true
  aborted-sweeper:
    enabled: true
  recommend:
    genre:
      enabled: true
    rewatch:
      enabled: true
```

Each subsystem checks its flag at its entry point. Disabling one halts that component without touching others.

### Testing strategy per phase

| Phase | Tests |
|---|---|
| 1 | Flyway dry-run against prod schema copy; verify FK constraint; assert no orphan record_id references after backfill |
| 2 | Unit tests with the real log lines provided 2026-05-26 as fixtures (Butterfly DL_5af9410d_65739 multi-PARTIAL, Dhurandhar DL_4ba8bb48_49879 single 200, Love.Insurance DL_fb9d770_21302 long-running, Undekhi PARTIAL). Coverage: byte-range merge correctness, connection_count peak detection, completed-vs-aborted transitions, inode-rotation handling, restart-from-offset, file-truncation recovery. Integration test for sweeper using H2 / testcontainers |
| 3 | Integration test: `/resolve` + `PUT /api/cinema/progress` in both orders → FK populated; idempotent on retry |
| 4 | Vitest component tests with TanStack Query mocked; manual run via `run` skill against local stack for golden path on `/me/activity` and `/adminv2/analytics` |
| 5 | Unit tests on resolvers with fixture activity data; verify cold-start hides rails via `hasContent()`; verify cache refresh updates rewatch list |

### Rollback story per phase

| Phase | Action | Data risk |
|---|---|---|
| 1 | Redeploy old code; keep an undo SQL ready to re-add the 5 dropped columns | None — dropped data was never read |
| 2 | Set `dbworld.log-shipper.enabled=false` and `dbworld.aborted-sweeper.enabled=false`, redeploy | None — existing rows keep last-written state |
| 3 | UPDATE FK to null; remove setter calls; redeploy | None — FK is nullable, readers tolerate null |
| 4 | Revert routes + components | None — pure read views |
| 5 | Toggle off in `TagsRails` admin UI (no redeploy needed) | None — rails are independently registered |

### Observability

Slf4j INFO logs via existing logback config (no new monitoring stack):

- Shipper per tick: `linesParsed`, `batchSizeBytes`, `accumulatorSize`, `flushDurationMs`, `currentOffset`.
- Shipper hourly aggregate: `linesPerHour`, `parsedFailures`, `mysqlRetries`.
- Sweeper per run: `rowsMarkedAborted`.
- Rail resolvers: cache hit/miss counts, refresh duration.

### Performance budgets on Pi 5

| Component | Target |
|---|---|
| Log shipper tick (idle, no new lines) | <10 ms |
| Log shipper tick (100 new lines) | <100 ms |
| ABORTED sweeper run | <200 ms |
| Genre affinity per user (uncached) | <200 ms |
| Genre affinity per user (cached) | <5 ms |
| Rewatch trend refresh (hourly job) | <1 s |
| `GET /api/me/activity` (paged) | <300 ms |
| `GET /api/adminv2/analytics/overview` | <500 ms |

If real-world numbers exceed these, fallback knobs in priority order: increase batch-tick-ms; raise max-bytes-per-tick; materialize per-user genre affinity into a small table refreshed off-hours; precompute analytics overview into a daily snapshot table.

---

## Open implementation details to resolve at plan-writing time

1. **Charting library:** verify whether adminv2 already standardizes on a specific chart lib. If yes, use that; if no, use `@mui/x-charts`.
2. **`watch_progress.id` type:** confirmed Long; FK column type is BIGINT.
3. **`MediaFileEntity.id` type:** confirmed varchar(36) UUID. The `media_file_id` column on `user_cinema_activity` is already varchar(36).
4. **NGINX log file location on the Pi:** confirm `/var/log/nginx/cdn_access.json` and that the Spring Boot process has read permission. If not, add a one-line `chmod`/`adduser` instruction to the rollout doc.
5. **Existing admin sidebar nav file:** identify which file owns the AdminLayout sidebar nav array for inserting the analytics link.

These are mechanical lookups; none affects the design.

---

## Out of scope (explicit)

- Mobile app changes (Android player path is untouched).
- Real-time WebSocket push of activity events (the shipper is pull-based by design).
- Replacing watch_progress with absorb-into-cinema-activity (explicitly rejected to protect the play-tick hot path on Pi 5).
- Geoip / country recommendation signals.
- Time-of-day / session-length signals.
- Collaborative-filtering or ML-based recommendations.
- A separate `/me/downloads` page.
- Per-record "your history" inline widget on record detail pages.

---

**Next step:** implementation plan via the writing-plans skill.
