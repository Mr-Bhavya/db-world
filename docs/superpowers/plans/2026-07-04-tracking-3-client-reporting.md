# Activity Tracking — Plan 3: Client Event Reporting (Phase 4)

> Implement task-by-task on `feat/activity-audit-tracking`, subagent-driven. Backend: one offline compile/tracking-test per task. Android: NOT buildable in this environment (Gradle loopback failure) — write the code carefully; the USER builds/tests the APK. Consolidated review at the end.

**Goal:** Let clients report the rich lifecycle events only they can see (app: pause/resume/retry/live speed/connections; web: stream play/pause/seek/ticks; both: SEARCH). Backend `/api/track/events` ingest endpoint → the existing `TrackingIngestService`. Then wire the Android aria2 download manager to post events. Correlation is automatic: the client uses the resolve `requestId` as `sessionId`, so client events merge with the nginx-shipper data in the same `activity_session`.

**Architecture:** New `TrackController` (`POST /api/track/events`, authenticated — any role, NOT admin) accepts a batch of client event DTOs, maps each to a `TrackEvent` (`source=CLIENT`, `userId` from JWT via `UserContext`, `channel` from the `X-DbWorld-Client` header), and calls `TrackingIngestService.ingest(...)` (already dedupes on `clientEventId`, retries on optimistic-lock, gated by the flag). Android: capture `requestId` from the resolve response into the download meta, and post START/PROGRESS(throttled)/PAUSE/RESUME/RETRY/FAIL/COMPLETE from the plugin + poller.

**Tech:** Backend Spring Boot 4 / Java 25. Android: Capacitor Java plugin (`com.db.dbworld.download.*`) + JSON-RPC aria2 poller.

## Global Constraints
- Branch `feat/activity-audit-tracking`; commit per task; no push. Trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Backend new code under `com.db.dbworld.audit.tracking.ingest` (controller + request DTO). Reuse `TrackEvent`, enums, `TrackingIngestService`, `UserContext`. `/api/track/**` must be authenticated (default; NOT in `PUBLIC_APIS`, NOT `@AdminAccess`). JDK 25 offline build.
- Android is local-build-only (user). Keep the existing JS bridge surface stable; additions must be null-safe and never block/break a download if reporting fails (swallow errors, like the resolve hook).

---

### Task 1 (backend): `/api/track/events` ingest endpoint
**Files:** create `com.db.dbworld.audit.tracking.ingest.TrackController` + `com.db.dbworld.audit.tracking.ingest.dto.TrackEventRequest` (+ a `TrackBatchRequest` wrapper) ; test `TrackControllerTest` (MockMvc or a plain unit test of the mapping).
- `TrackEventRequest` record (all nullable except sessionId+type): `clientEventId, sessionId, activity (String), type (String), clientApp (String), occurredAt (Instant, nullable→now), mediaFileId, recordId (Long), seasonNumber (Integer), episodeNumber (Integer), fileName, fileSize (Long), cumulativeBytes (Long), speedBps (Long), connections (Integer), positionMs (Long), durationMs (Long), completionPercent (BigDecimal), errorCode, errorMessage, searchQuery, resultCount (Integer)`.
- `TrackController` `@RestController @RequestMapping("/api/track") @RequiredArgsConstructor` (inject `TrackingIngestService`, `UserContext`):
  - `POST /events` body `TrackBatchRequest { List<TrackEventRequest> events }`. Resolve `userId = userContext.userId()`. Derive `channel`: header `X-DbWorld-Client` == "app" → `TrackChannel.APP` else `TrackChannel.WEB`. Read `remoteAddr`/`userAgent` from `HttpServletRequest` (reuse the resolve controller's client-IP helper idiom).
  - Cap batch at 100 (ignore extras / 400 on oversize — pick one, document). For each event: safely parse `activity`→`ActivityKind`, `type`→`TrackEventType`, `clientApp`→`ClientApp` (unknown enum → skip that event, don't 500); build a `TrackEvent` (`source=CLIENT`, the resolved userId/channel/remoteAddr/userAgent, occurredAt→eventTime); call `trackingIngestService.ingest(event)`. Return `ApiResponse.success(Map.of("accepted", n))`.
  - Endpoint is authenticated but not admin (any logged-in user posts their own events).
- Test: verify a batch maps correctly (mock `TrackingIngestService`, assert `ingest` called with expected `TrackEvent` fields incl. `source=CLIENT` and the JWT userId; unknown-enum event skipped; oversize handled).
- [ ] Implement + test (tracking sweep) + compile. Commit.

### Task 2 (android): capture `requestId` into download meta
**Files:** Android `com.db.dbworld.download.*` (READ `DbWorldDownloadPlugin.java`, `DownloadMetaStore.java` first) + the JS/resolve call site that starts a download (find where the app calls `/api/stream/resolve` and then `startDownload`).
- Ensure the resolve `requestId` (present in `CdnResolveDto.requestId`) is passed into `startDownload(...)` and persisted in `DownloadMetaStore` per download (new `sessionId`/`requestId` field), keyed by gid. Null-safe (older downloads without it just won't report).
- [ ] Implement. (User compiles.) Commit.

### Task 3 (android): post lifecycle events from the plugin + poller
**Files:** Android `com.db.dbworld.download.*` (plugin + poller) + a small `TrackReporter` helper.
- Add a `TrackReporter` that POSTs batches to `${apiBase}/api/track/events` with the app's JWT (`Authorization: Bearer`) and header `X-DbWorld-Client: app`, `clientApp:"ARIA2"`. Fire-and-forget on a background thread; swallow failures.
- Emit events keyed by the download's `sessionId` (= requestId): `START` on enqueue, `PROGRESS` throttled (~every 5s from the 1 Hz poller, with `cumulativeBytes`=completedLength, `speedBps`=downloadSpeed, `connections`), `PAUSE`/`RESUME` on those actions, `RETRY` on retry, `FAIL` (with errorCode/message) and `COMPLETE` on finalization. Each event carries a client-generated `clientEventId` (UUID) for idempotency. Skip downloads with no `sessionId`.
- [ ] Implement. (User compiles + tests APK.) Commit.

## Deferred (later "user" phase)
- Web-player reporting (STREAM_START/TICK/PAUSE/SEEK/STOP via `navigator.sendBeacon`), in-search recent-searches UI + SEARCH events, `/me/activity` repoint. (These feed the same `/api/track` endpoint built in Task 1.)

## Review
Consolidated review at end: backend endpoint (auth is non-admin, enum parsing safe, batch cap, no 500 on bad input, correct TrackEvent mapping) + Android reporting (null-safe, non-blocking, correct sessionId correlation). Hand APK build/test to the user.
