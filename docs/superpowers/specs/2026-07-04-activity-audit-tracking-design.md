# Activity & Audit Tracking — Event-Sourced Rebuild

- **Date:** 2026-07-04
- **Branch:** `feat/activity-audit-tracking` (off `development`)
- **Status:** Design — awaiting user review
- **Author:** Claude (Opus 4.8) with bhavya.dudhia

---

## 1. Problem & Context

DB World already has an extensive activity-tracking system, but it does not work in
practice. The user confirmed **all channels are broken**: numbers are wrong/blank, app
(aria2) downloads aren't tracked truthfully, browser + IDM/1DM downloads aren't
attributed, and streams/watch activity is unreliable.

### Why the current system fails

1. **Aggregate data model, not event-based.** `user_cinema_activity` has a unique key of
   `(user_id, file_path, activity_type)` → **exactly one row per user+file+type, forever.**
   A failed download + re-download + pauses + resumes all collapse into that single row's
   counters. It **structurally cannot represent a timeline** of attempts — which is exactly
   what we need.

2. **Wrong correlation id.** The nginx CDN log already carries a **unique-per-resolve**
   `request_id` (`$arg_requestId`), baked into the CDN URL and reused by every range
   request of a session. The old pipeline instead correlated on the **day-scoped**
   `download_id` (a hash of user+file+day), so re-downloads within a day merge and cannot
   be distinguished.

3. **Naive byte accounting.** Summing `body_bytes_sent` across range requests over-counts
   (overlapping ranges, seeks, resumed segments, retransmits), and malformed/missing
   `Content-Range` corrupts completion %. The user explicitly flagged that
   "byte-range and byte transfer is sometimes not proper."

### What already works and will be reused

- **nginx CDN logging** (`db-world-config/server_config/dbworld.conf`): the `cdn_json`
  log format already emits `request_id`, `download_id`, `content_range`, `range_header`,
  `bytes_sent`, `user_agent`, `type`, `status`, `duration_sec` to
  `/app/db_world/logs/nginx/cdn_access.log`. The shipper path already matches. **Every
  download and every stream — app, web, browser, IDM/1DM — is served by
  `cdn.db-world.in` and therefore produces these log lines.**
- **JWT/user context** (`JwtService`, `UserContext`) for identifying the current user.
- **Media model** (`RecordEntity` movie/TV, `MediaFileEntity` file + season/episode).
- **Android aria2 download manager** — already knows authoritative live speed,
  connections, pause/resume, retries, `completedLength`/`totalLength` on-device.
- **Orthogonal, working features kept as-is:** `LoginData` (login history),
  `WatchProgress` (playback position), `UserActivityLog` (generic HTTP request audit).

---

## 2. Goals & Non-Goals

### Goals
- Production-ready, event-sourced activity/audit tracking that answers, per user:
  - **Which file** was downloaded/streamed (media_file, record, season/episode).
  - **From where** — channel (APP / WEB / BROWSER / EXTERNAL) and client_app
    (DB World app, aria2, Chrome, Firefox, IDM, 1DM, VLC, MPV, wget, curl, …).
  - **How many connections** were used (peak concurrent).
  - **At what speed** (avg + max).
  - **Failed then re-downloaded** — discrete attempts with `attempt_count` and
    FAIL → RETRY events.
  - **Pause / resume** — discrete events + `pause_count`/`resume_count`.
  - **Is it still downloading** — live session state.
- **Accurate bytes/completion** despite noisy CDN range data.
- **Search-query tracking** + per-user recent-search history in the cinema search overlay,
  plus admin keyword analytics.
- **Admin "Activity" console** — overview dashboard, live sessions, session history with
  drill-down, per-user/per-file views, and the existing HTTP request audit folded in.
- Clean **cutover**: build new alongside old behind a flag, verify, then delete old code
  and drop old tables.

### Non-Goals
- Not a generic analytics/BI platform.
- Not replacing `WatchProgress`, `LoginData`, or the HTTP request audit (`UserActivityLog`).
- No per-frame or sub-second telemetry.
- No backfill from the old (unreliable) `user_cinema_activity` data — start fresh
  (assumption; see Open Questions).

---

## 3. Architecture Overview (Approach A — Hybrid)

Client-reported events (app + web) for rich lifecycle fidelity, **plus** the nginx CDN log
(keyed by `request_id`) as the authoritative transfer record for everything — including
external downloaders that never call the backend.

```
                    ┌──────────────────────────── SOURCES ────────────────────────────┐
  APP (aria2)   ──POST /api/track/events──►                                             
  WEB player    ──POST /api/track/events──►   TrackingIngestService ──►  activity_event  
  /stream/resolve ──(server emits RESOLVE)──►                             (append-only,   
                                                                           source of truth)
  nginx cdn_access.log ──TrackingLogShipper (key = request_id)──►  transfer samples ──┐  
                                                                                       │  
                                                              SessionAggregator  ◄─────┘  
                                                                     │                    
                            ┌────────────────────────────────────────┼───────────────────────────┐
                            ▼                                         ▼                            ▼
                     activity_session                       activity_daily_rollup           search_history
                (1 row/session: state, unique &            (per user/day/activity:        (per-user recent +
                 transferred bytes, peak conns,             counts, bytes, watch hours)    admin keyword stats)
                 avg/max speed, attempts, pauses,
                 ACTIVE/PAUSED/COMPLETED/FAILED/ABORTED)
```

### Ingestion channels & source precedence

| Session origin | Client events? | nginx log? | Authoritative for state / speed / completion | nginx contributes |
|---|---|---|---|---|
| **App (aria2)** | ✅ | ✅ | **Client** (aria2 `completedLength`, connections, pause/resume/retry) | `transferred_bytes`, corroborating peak connections |
| **Web player** | ✅ | ✅ | **Client** (player position, play/pause/seek) | `transferred_bytes` |
| **Browser direct download** | ❌ | ✅ | **nginx** (interval-union bytes) | everything |
| **External (IDM / 1DM / wget / VLC…)** | ❌ | ✅ | **nginx** (interval-union bytes, concurrent-request connections) | everything |

**Key rule:** client-reported cumulative bytes and nginx-derived bytes live in **separate
columns** (`client_bytes` / `nginx_transferred_bytes` / `unique_bytes`) and are **never
summed together**, so a dual-source session can never double-count. `has_client_events`
selects which source drives `state`, `completion_percent`, `avg_speed_bps`, and
`peak_connections`.

---

## 4. Data Model

New package: `com.db.dbworld.audit.tracking.*`. New Flyway migrations (additive first).

### 4.1 `activity_event` — append-only source of truth

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK auto | |
| `event_time` | TIMESTAMP(3) | when the action occurred (client clock or nginx `time`) |
| `received_at` | TIMESTAMP(3) | server ingest time |
| `user_id` | BIGINT FK users | resolved from JWT (client) or `$arg_userId` (nginx) |
| `session_id` | VARCHAR(64) | = resolve `request_id`; correlation key across sources |
| `activity` | ENUM | DOWNLOAD, STREAM, SEARCH |
| `event_type` | ENUM | RESOLVE, START, PROGRESS, PAUSE, RESUME, RETRY, FAIL, COMPLETE, ABORT, STREAM_START, STREAM_TICK, STREAM_PAUSE, SEEK, STREAM_STOP, SEARCH |
| `channel` | ENUM | APP, WEB, BROWSER, EXTERNAL, SERVER |
| `client_app` | VARCHAR(40) | DBWORLD_APP, ARIA2, CHROME, FIREFOX, SAFARI, EDGE, IDM, ONEDM, VLC, MPV, KODI, WGET, CURL, UNKNOWN |
| `source` | ENUM | CLIENT, NGINX, SERVER |
| `media_file_id` | VARCHAR(36) | nullable FK media_files |
| `record_id` | BIGINT | nullable |
| `season_number` / `episode_number` | INT | nullable (denormalized) |
| `file_path` | VARCHAR(1024) | nullable |
| `file_size` | BIGINT | nullable |
| `bytes_delta` | BIGINT | bytes for this event (nginx `body_bytes_sent`), nullable |
| `cumulative_bytes` | BIGINT | client-reported cumulative (aria2 completedLength), nullable |
| `range_start` / `range_end` | BIGINT | parsed from `Content-Range`, nullable |
| `speed_bps` | BIGINT | nullable |
| `connections` | INT | nullable |
| `position_ms` / `duration_ms` | BIGINT | stream cursor, nullable |
| `completion_percent` | DECIMAL(5,2) | nullable |
| `http_status` | INT | nginx, nullable |
| `error_code` / `error_message` | VARCHAR | nullable |
| `search_query` / `result_count` | VARCHAR(256) / INT | SEARCH only, nullable |
| `remote_addr` | VARCHAR(64) | |
| `user_agent` | VARCHAR(512) | |
| `client_event_id` | VARCHAR(64) | client-generated UUID for idempotent dedupe, nullable |
| `meta` | JSON | extensibility, nullable |

Indexes: `(user_id, event_time)`, `(session_id)`, `(media_file_id)`,
`(activity, event_time)`, `(event_type)`, unique `(session_id, client_event_id)` (dedupe).

### 4.2 `activity_session` — one maintained row per session

| Column | Type | Notes |
|---|---|---|
| `session_id` | VARCHAR(64) PK | |
| `user_id` | BIGINT | |
| `activity` | ENUM | DOWNLOAD, STREAM |
| `channel` / `client_app` | | resolved once, refined by nginx UA |
| `media_file_id` / `record_id` / `season_number` / `episode_number` | | |
| `file_path` / `file_name` / `file_size` | | |
| `state` | ENUM | RESOLVING, ACTIVE, PAUSED, COMPLETED, FAILED, ABORTED |
| `unique_bytes` | BIGINT | true file bytes delivered (interval union), clamped ≤ file_size |
| `client_bytes` | BIGINT | client-reported cumulative (authoritative when present) |
| `nginx_transferred_bytes` | BIGINT | raw sum of nginx `body_bytes_sent` (incl. retransmit) |
| `wasted_bytes` | BIGINT (derived) | `nginx_transferred_bytes − unique_bytes` |
| `completion_percent` | DECIMAL(5,2) | |
| `peak_connections` | INT | |
| `avg_speed_bps` / `max_speed_bps` | BIGINT | |
| `attempt_count` | INT | START + RETRY count (re-downloads) |
| `pause_count` / `resume_count` / `fail_count` | INT | |
| `has_client_events` | BOOLEAN | source-precedence flag |
| `last_error_code` / `last_error_message` | | |
| `started_at` / `last_event_at` / `completed_at` | TIMESTAMP(3) | |
| `watch_position_ms` / `watch_duration_ms` / `watch_progress_id` | | STREAM only |
| `remote_addr` / `user_agent` | | |
| `range_intervals` | JSON | coalesced delivered `[start,end)` set for unique-byte calc |

Indexes: `(user_id, last_event_at)`, `(state, last_event_at)`, `(media_file_id)`,
`(record_id)`, `(activity, state)`.

### 4.3 `activity_daily_rollup` — fast dashboards

`(bucket_date, user_id, activity)` PK + `download_count`, `stream_count`,
`completed_count`, `failed_count`, `unique_bytes`, `watch_ms`, `distinct_files`.
Maintained incrementally by the aggregator (and re-derivable from events).

### 4.4 `search_history` — recent searches + keyword analytics

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT | |
| `query_raw` | VARCHAR(256) | as typed |
| `query_norm` | VARCHAR(256) | trimmed/lowercased for dedupe & keyword stats |
| `result_count` | INT | |
| `opened_record_id` | BIGINT | nullable — set if the user opened a result |
| `channel` | ENUM | WEB, APP |
| `created_at` | TIMESTAMP(3) | |

Indexes: `(user_id, created_at)`, `(query_norm)`.

---

## 5. Byte Accounting & Data-Quality Handling

Directly addresses "byte-range and byte transfer sometimes not proper."

1. **Interval-union for unique bytes.** For each session we maintain a coalesced set of
   delivered byte intervals `[start, end)` parsed from `Content-Range` (fallback
   `Range` header). `unique_bytes = Σ(merged interval lengths)`, clamped to `file_size`.
   `completion_percent = unique_bytes / file_size`. This defeats overlaps, seeks,
   resumed segments, and retransmits. Downloads coalesce to ~1 interval; streams with
   seeks stay to a handful — `range_intervals` JSON stays small.
2. **Retransmit visibility.** `nginx_transferred_bytes = Σ body_bytes_sent` (raw). The
   derived `wasted_bytes = transferred − unique` surfaces retransmission/overlap waste as
   a useful metric rather than corrupting completion.
3. **Malformed / missing ranges — fallbacks:**
   - `status 200`, no `Content-Range` → treat as full file `[0, file_size)`.
   - `status 206`, `body_bytes_sent` present but unparseable range → best-effort append
     `[prev_end, prev_end + bytes)`, flagged low-confidence in `meta`.
   - `file_size` unknown → `completion_percent = NULL` (don't guess).
   - Any computed `unique_bytes > file_size` → clamp and flag (indicates bad range data).
4. **Client wins for dual-source sessions.** When `has_client_events = true`
   (app/web), completion and speed come from the client's authoritative
   `cumulative_bytes` / `completedLength`; noisy nginx ranges only feed
   `nginx_transferred_bytes` and corroborate peak connections. So range weirdness cannot
   corrupt app/web completion.
5. **Connections.** App/web: reported by client (aria2 `connections`). External/browser:
   **peak concurrent** computed by a sweep-line over overlapping request time intervals
   sharing the session's `request_id` (plus optional nginx `$connection` id for precision
   — see §7).

---

## 6. Ingestion API (`/api/track`)

Authenticated (JWT). User resolved from token. `channel` derived from the
`X-DbWorld-Client: app` header (→ APP) else WEB.

```
POST /api/track/events
{
  "events": [
    {
      "clientEventId": "uuid",         // idempotency
      "sessionId": "<resolve requestId>",
      "activity": "DOWNLOAD|STREAM|SEARCH",
      "type": "START|PROGRESS|PAUSE|RESUME|RETRY|FAIL|COMPLETE|ABORT|
               STREAM_START|STREAM_TICK|STREAM_PAUSE|SEEK|STREAM_STOP|SEARCH",
      "occurredAt": "2026-07-04T10:00:00.000Z",
      "mediaFileId": "…", "recordId": 123,
      "clientApp": "DBWORLD_APP|ARIA2|CHROME|…",
      "cumulativeBytes": 12345678, "bytesDelta": 65536,
      "speedBps": 1048576, "connections": 4,
      "positionMs": 61000, "durationMs": 5400000, "completionPercent": 42.5,
      "errorCode": "…", "errorMessage": "…",
      "searchQuery": "dark", "resultCount": 7, "openedRecordId": null
    }
  ]
}
→ 202 Accepted { "accepted": N, "deduped": M }
```

- **Batching:** app flushes every ~5 s from its 1 Hz poller (PROGRESS coalesced;
  PAUSE/RESUME/RETRY/FAIL/COMPLETE sent immediately). Web sends STREAM_TICK periodically
  and uses `navigator.sendBeacon` on `pagehide` for STREAM_STOP.
- **Idempotency:** dedupe on `(session_id, client_event_id)`.
- **Guardrails:** payload size cap, per-user rate limit, event-type whitelist.

**Server-side RESOLVE hook:** `StreamServiceImpl.resolve*` emits a `RESOLVE` event
(`source=SERVER`) carrying the minted `session_id` (= `request_id`), user, media_file,
resolve-time channel/UA, and `type` (ONLINE→STREAM, DOWNLOAD→DOWNLOAD). This is what
creates the `activity_session` in `RESOLVING` state; subsequent client/nginx events move
it to `ACTIVE`/etc.

---

## 7. nginx Changes (minimal)

The `cdn_json` format already has everything except a precise per-connection id. **One
small, safe addition** to `db-world-config/server_config/dbworld.conf`:

```nginx
log_format cdn_json escape=json
    '…existing fields…'
    '"conn":"$connection",'            # nginx connection serial → distinct TCP conns
    '"conn_reqs":"$connection_requests",'
    '"bytes_sent_all":"$bytes_sent",'  # incl. headers, for sanity vs body_bytes_sent
    '…';
```

`request_id` is already unique-per-resolve and reused by every range request (it's in the
URL query string that aria2/IDM/browser all use), so **no new correlation field is
needed.** Deploying the log change is a `nginx -t && systemctl reload nginx`.

The **new `TrackingLogShipper`** replaces the old `LogShipperService`/`DownloadAccumulator`/
`LogLineParser`, reusing their proven resilience (byte-offset state, rotation/truncation
safety, crash-safe offset advance) but: keys on `request_id`, emits per-line
`activity_event`s + feeds the interval-union accumulator, and respects source precedence.

---

## 8. Live Sessions & Staleness

- `GET /api/admin/activity/live` → sessions in `ACTIVE`/`PAUSED` with recent
  `last_event_at` (the "who's downloading/streaming right now" view).
- **Sweeper** (scheduled job; reuse existing `aborted-sweeper` config knobs
  `stream-timeout-min` / `download-timeout-min`): `ACTIVE` with no events/log lines past
  the timeout → `ABORTED`.
- Optional real-time push to the admin console via the existing
  `UserCinemaActivityHandler` WebSocket pattern (nice-to-have; polling with TanStack Query
  `refetchInterval` is the baseline).

---

## 9. Search Tracking & History

- **Recording:** the cinema search overlay sends a `SEARCH` event via `/api/track/events`
  on the settled debounced term (and `openedRecordId` when a result is opened). Consecutive
  prefix queries within a short window are collapsed server-side (keep the longest of a
  prefix run) so "d → da → dar → dark" stores one meaningful entry.
- **User endpoints:**
  - `GET /api/me/search-history?limit=8` → distinct recent queries.
  - `DELETE /api/me/search-history` → clear all; `DELETE /api/me/search-history/{query}`
    → remove one.
- **Admin analytics:** `GET /api/admin/activity/search-keywords` → top keywords +
  zero-result queries.
- **UI:** the `SearchOverlay` empty-state (currently static "Trending" text) becomes
  **"Recent searches"** — clickable chips to re-run, an × to remove one, a "Clear" link.
  TanStack Query for fetch/mutate.
- **Privacy:** per-user clear, plus an optional "Save search history" toggle (default on).

---

## 10. Admin "Activity" Console

New route `/admin/activity`, using the established admin stack (TanStack Query, MUI
DataGrid v8, Zustand for UI state, Notistack, Framer Motion, theming via `useT()` /
`AdminThemeProvider`). Tabs:

1. **Overview** — KPI cards (active now, downloads/streams today, unique users, GB
   delivered, avg speed) + charts (activity over time, `client_app` breakdown, top
   content, peak hours, top search keywords, zero-result searches).
2. **Live** — real-time table: user, title, activity, channel/client, %, speed,
   connections, state, duration; auto-refresh (+ optional WS).
3. **Sessions** — DataGrid over `activity_session` with filters (user, activity, channel,
   client_app, state, date range, media) → row drill-down to the session's **event
   timeline** (from `activity_event`).
4. **Per-user / per-file** drill-downs.
5. **Request Log** — the existing HTTP request audit (`/api/admin/activity-logs`,
   `UserActivityLog`) folded in as its own tab.

User-facing `/me/activity` (existing `ActivitySummaryCard`, `ActivityTimelineList`)
is repointed to the new session/event model; the recent-searches UI is added to the
search overlay.

---

## 11. Rollout, Migration & Removing Old Code

Feature flag `dbworld.tracking.v2.enabled` (default on in dev, gated in prod).

1. **Additive migrations** create `activity_event`, `activity_session`,
   `activity_daily_rollup`, `search_history`. No drops yet.
2. **Build new alongside old**, flag-gated. Old writers can be disabled immediately since
   they're broken.
3. **Wire clients:** RESOLVE hook + new shipper (backend) → web reporting → Android
   reporting.
4. **Verify** on real traffic (live dashboard shows correct speed/connections/state;
   external IDM/1DM download attributed; app pause/resume/retry reflected; bytes/completion
   correct on noisy ranges).
5. **Cutover & cleanup (separate PR):** delete old code —
   `UserCinemaActivityEntity`/service/repo/controllers, `LogShipperService`,
   `DownloadAccumulator`, `LogLineParser`, old analytics endpoints, stubbed
   `saveUserEventInfo` — and a later migration **drops `user_cinema_activity`**.
   **Kept:** `LoginData`, `WatchProgress`, `UserActivityLog`.

**Build notes:** backend compile requires `JAVA_HOME` = JDK 25 (default is 21); use the
Maven wrapper path in `CLAUDE.md`. Android is **local-build only** — the user builds/tests
the APK for the event-reporting changes.

---

## 12. Phasing

1. **Backend foundation** — schema/entities, `TrackingIngestService`,
   `SessionAggregator` + interval-union byte accounting, new `TrackingLogShipper`
   (reuse `cdn_json` + add `conn`), RESOLVE hook, sweeper, flag.
2. **Ingestion API + web** — `/api/track/events`, web-player reporting
   (stream ticks/pause/seek/stop via `sendBeacon`), search events, `/me/activity`
   repoint, recent-searches UI.
3. **Admin Activity console** — overview, live, sessions + timeline drill-down,
   per-user/per-file, request-log tab.
4. **Android event reporting** — plugin posts lifecycle events against `/api/track`
   (user builds APK).
5. **Cutover** — enable in prod, verify, delete old code + drop old table.

---

## 13. Testing Strategy

- **Unit:** interval-union accumulator (overlaps, seeks, out-of-order, malformed/missing
  ranges, clamp-to-size); UA → client_app parser; source-precedence merge (dual-source no
  double-count); prefix-collapse for search history.
- **Integration:** `/api/track/events` (auth, dedupe, batch); RESOLVE→session lifecycle;
  shipper parses a sample `cdn_access.log` into correct sessions; sweeper transitions.
- **Manual:** admin live dashboard on real traffic across app, web, browser, IDM/1DM.

---

## 14. Retention & Privacy

- `activity_event` pruned after a configurable window (default 90 days) via scheduled job;
  `activity_session` + rollups retained longer.
- `search_history` capped per user (e.g., last 200) + global retention; user-clearable;
  optional per-user opt-out.
- Tracking data is admin-only (`OWNER_ADMIN_AUTHORIZE`); users see only their own via
  `/me/*`.

---

## 15. Open Questions / Assumptions

1. **No backfill** from old `user_cinema_activity` (start fresh; old data unreliable).
   — assumed; confirm.
2. Adding `conn`/`conn_reqs` to the nginx `cdn_json` format is acceptable (tiny change).
   — assumed yes.
3. Search recording on the **client-committed debounced term** (not every keystroke,
   not server-side on the search endpoint). — proposed; confirm.
4. Real-time admin updates via WebSocket are **nice-to-have**; polling is the baseline.
   — assumed acceptable.
