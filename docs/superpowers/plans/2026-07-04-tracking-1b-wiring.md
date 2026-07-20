# Activity Tracking — Plan 1B: Wiring Implementation Plan

> **For agentic workers:** implement task-by-task on branch `feat/activity-audit-tracking`. Plan 1B wires the Plan 1A engine to live sources. Lighter process than 1A by design: **compile once per task (not per step)**; unit-test only the pure log-batch aggregation; one consolidated review at the end. Much of 1B (shipper file IO, resolve hook, scheduled jobs) can only be fully verified against a running app + MySQL + nginx, which is deferred to the user.

**Goal:** Make the tracking engine record real activity: emit a RESOLVE event on `/api/stream/resolve`, ingest the nginx CDN access log into sessions (covering browser + IDM/1DM/external), sweep stale sessions to ABORTED, prune old events, and add the tiny nginx `conn` log field.

**Architecture:** `StreamServiceImpl` emits a server-side `RESOLVE` `TrackEvent` (session_id = the per-resolve `requestId`) → `TrackingIngestService.ingest`. A new `TrackingLogShipper` (reusing the proven offset/rotation/truncation resilience of the existing `LogShipperService`) tails `cdn_access.log`, parses lines with `CdnLogLineParser`, groups them by `request_id` per tick into `NginxTickAggregate`s, and calls `TrackingIngestService.ingestNginxTick`. Scheduled sweeper + retention jobs maintain lifecycle. All gated by `dbworld.tracking.v2.enabled` (via `TrackingProperties`).

**Tech Stack:** Spring Boot 4 / Java 25, Spring Data JPA (MySQL, `ddl-auto: update`), Lombok, `@Scheduled`, `@ConfigurationProperties`. Build: `JAVA_HOME=/c/Program Files/Java/jdk-25.0.3`, offline Maven wrapper.

## Global Constraints
- Branch `feat/activity-audit-tracking`; commit per task; no push. Trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- New code under `com.db.dbworld.audit.tracking.*`. Reuse Plan 1A types (do not duplicate).
- **Concurrency decision:** both the resolve/client path and the shipper read-modify-write the same `activity_session` row. Add `@Version` optimistic locking to `ActivitySessionEntity` and retry the ingest transaction on `ObjectOptimisticLockingFailureException` (bounded, e.g. 3 attempts). Do NOT use SQL upsert (the merge is rich Java logic in `SessionAggregator`). `activity_event` is insert-only (no contention).
- **Do NOT remove or break the existing old tracking** (`UserCinemaActivityService`, `LogShipperService`) — new runs alongside old, gated by the flag; old is deleted at cutover (Phase 5).
- Build verification: one offline `compile` per task (`"$MVN" -q -o compile`); run the shipper unit test where specified. Full app/DB/nginx verification is the user's (deferred).
- Server config (`db-world-config/server_config/dbworld.conf`) is a SEPARATE repo the user deploys — I edit the file and provide the exact block; the user runs `nginx -t && systemctl reload nginx`.

---

### Task 1: `@Version` on `ActivitySessionEntity` + retry helper

**Files:** modify `.../entity/ActivitySessionEntity.java`; create `.../ingest/OptimisticRetry.java`.

- Add to `ActivitySessionEntity`: `@Version @Column(name = "row_version") private Long version;`
- Create a small helper to retry a `Runnable`/`Supplier` on `org.springframework.orm.ObjectOptimisticLockingFailureException` up to 3 times (then rethrow). Keep it dependency-free (no Spring Retry).
- Wire `TrackingIngestService.ingest` and `ingestNginxTick` to run their load-modify-save body inside the retry helper. (Because the `@Transactional(REQUIRES_NEW)` boundary must restart on retry, the retry wraps a call to a self-injected proxy method — or split the transactional body into a package method invoked via the bean. Simplest: give `TrackingIngestService` a `@Lazy` self-reference or move the transactional unit into a separate `@Component TrackingSessionWriter` and retry calls to it. Choose the cleaner of the two given the codebase; document the choice.)
- Verify: offline compile.

### Task 2: `TrackingShipperStateEntity` + repository + `NginxTick` batch builder (with unit test)

**Files:** create `.../shipper/TrackingShipperStateEntity.java`, `.../shipper/TrackingShipperStateRepository.java`, `.../shipper/NginxTickBuilder.java`; test `.../shipper/NginxTickBuilderTest.java`.

- `TrackingShipperStateEntity`: mirror the existing `LogShipperStateEntity` (singleton `@Id Byte id = 1`, `file_path`, `inode`, `byte_offset`, `last_processed_at`) but table `TRACKING_LOG_SHIPPER_STATE` (separate row so it never collides with the old shipper's state).
- `NginxTickBuilder` (PURE logic, unit-tested): accepts parsed `CdnLogLine`s and groups them by `requestId` into `List<NginxTickAggregate>`. Per session compute: `deliveredRanges` = inclusive `[rangeStart,rangeEnd]` for lines that have a range; `transferredBytes` = Σ `bytesSent`; `fileTotal` = last non-null `fileTotal`; `peakConnections` = `TransferMath.peakConcurrent` over each line's request-time window `[epochMillis(time) - round(durationSec*1000), epochMillis(time)]`; `maxSpeedBps` = max of `bytesSent / max(durationSec, ~0.001)`; `clientApp` = `ClientAppDetector.detect(userAgent)` of the session's lines; `realIp`/`userAgent` from any line; `lastEventAt` = max `time`; `sawComplete` = any line `isComplete()`; `activity` from the lines' `activity`.
- **Unit test** `NginxTickBuilderTest`: feed a handful of `CdnLogLine`s for two request_ids (one with overlapping ranges + parallel windows, one single-shot 200) and assert the resulting aggregates' `deliveredRanges`, `transferredBytes`, `peakConnections`, and `sawComplete`. This is the one piece worth TDD in 1B.
- Verify: `"$MVN" -q -o -Dtest=NginxTickBuilderTest test`.

### Task 3: `TrackingLogShipper` (file tailing + resilience)

**Files:** create `.../shipper/TrackingLogShipper.java`.

- Port the resilience structure VERBATIM in spirit from `com.db.dbworld.audit.activity.shipper.LogShipperService` (read that file): `@Scheduled(fixedDelayString = "${dbworld.tracking.batch-tick-ms:5000}")` `tick()`; missing-file/failure backoff (or simpler: guarded try/catch + debug logs); `runOneTick()` handling rotation (inode/marker change → drain rotated `+ rotatedSuffix`), truncation (size < offset → reset 0), forward read up to `maxBytesPerTick`; advance the persisted offset ONLY after the flush commits.
- Config from `TrackingProperties`: `cdnLogPath`, `rotatedSuffix`, `batchTickMs`, `maxBytesPerTick`, `maxAccumulatorEntries`; gate on `props.isEnabled()`.
- Per tick: read complete lines, `CdnLogLineParser.parse` each, collect the parsed lines, `NginxTickBuilder.build(lines)` → for each `NginxTickAggregate` call `trackingIngestService.ingestNginxTick(agg)`; then persist the new offset via `TrackingShipperStateRepository`.
- Fresh-install: start at end-of-file (like the old shipper) so we don't replay history; operator opts into backfill by setting `byte_offset = 0`.
- Verify: offline compile. (File-IO/rotation correctness is verified by the user against a real log; the pure grouping math is covered by Task 2's test.)

### Task 4: RESOLVE hook in `StreamServiceImpl`

**Files:** modify `.../app/stream/service/impl/StreamServiceImpl.java` (read it first).

- Inject `TrackingIngestService`. In BOTH `resolveById` and `resolveByPath`, after the existing `trackResolveActivity(...)` call (leave the old call intact), emit a new server-side RESOLVE event guarded by try/catch (never let tracking break streaming):
  - Build a `TrackEvent` with: `sessionId = requestId` (the per-resolve UUID — NOT downloadId), `activity` = STREAM if `inline` else DOWNLOAD, `type = RESOLVE`, `source = SERVER`, `channel = ClientAppDetector.channel(detect(userAgent), false)`, `clientApp = ClientAppDetector.detect(userAgent)`, `eventTime = Instant.now()`, `userId` (look up via the existing user service by email), `mediaFileId`/`recordId`/`seasonNumber`/`episodeNumber`/`fileName`/`fileSize` from the resolved `MediaFileDto` when present (null-safe for path-based unassigned files), `filePath`, `remoteAddr`, `userAgent`.
  - Call `trackingIngestService.ingest(event)`.
- `requestId` is already appended to the CDN URL by `CdnUrlBuilder.queryParams` (`&requestId=`), so nginx logs carry the same `request_id` → the shipper correlates to this session. No CdnUrlBuilder change needed.
- Verify: offline compile.

### Task 5: Staleness sweeper + retention pruner

**Files:** create `.../sweeper/TrackingSweeper.java`.

- `@Component`, two `@Scheduled` methods gated on `props.isEnabled()`:
  - `sweepStale()` — `fixedDelayString = "${dbworld.tracking.sweeper-tick-ms:60000}"`: for `ACTIVE`/`RESOLVING` DOWNLOAD sessions older than `downloadTimeoutMin`, and STREAM sessions older than `streamTimeoutMin` (use `ActivitySessionRepository.findByStateInAndLastEventAtBefore` with the appropriate cutoffs; filter by activity in Java or add a repo method), set state `ABORTED` and save.
  - `pruneOldEvents()` — `fixedDelayString` daily (e.g. `86400000`): `activityEventRepository.deleteByEventTimeBefore(now - eventRetentionDays days)`.
- Verify: offline compile.

### Task 6: nginx `cdn_json` `conn` field (config; user deploys)

**Files:** modify `db-world-config/server_config/dbworld.conf` (separate repo).

- In the `log_format cdn_json` block, add before the closing line: `'"conn":"$connection",'` and `'"conn_reqs":"$connection_requests",'`. Provide the user the exact updated block and the deploy command (`sudo nginx -t && sudo systemctl reload nginx`). No app change (parser already reads `conn`).

---

## Deferred beyond 1B (later phases)
- Phase 2: client `/api/track` ingest API + web-player reporting + search history UI + `/me/activity` repoint.
- Phase 3: admin Activity console + `activity_daily_rollup`.
- Phase 4: Android event reporting.
- Phase 5: cutover (enable flag in prod, verify, delete old code, drop old table).

## Review
After all tasks: one consolidated opus whole-branch review of the 1B diff, focused on the resolve-hook safety (must never break streaming), shipper resilience/offset correctness, and the `@Version`/retry concurrency wiring.
