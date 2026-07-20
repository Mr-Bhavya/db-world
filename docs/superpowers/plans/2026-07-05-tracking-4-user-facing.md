# Activity Tracking — Plan 4: User-Facing (Search History + /me Activity)

> Subagent-driven on `feat/activity-audit-tracking`. Backend: one offline compile/tracking-test per task. Frontend: ESLint per task (React app build/run is the user's). Consolidated review at the end.

**Goal:** The remaining user-facing features: (1) record each user's cinema searches and show them their **recent searches** in the search overlay (clickable to re-run, with clear), which also powers admin **search-keyword** analytics; (2) repoint the personal **`/me/activity`** page to the new event-sourced backend.

**Scope/constraints reminder:** Jackson 3 (`tools.jackson.databind`) — never `com.fasterxml`. New backend under `com.db.dbworld.audit.tracking.*`. `@AdminAccess` for admin endpoints; per-user endpoints are authenticated (any role) and read `UserContext.userId()` (a user only sees/clears their OWN data). `ApiResponse<T>`. Old `/api/me/activity` + old `saveUserEventInfo` stub stay until Phase 5 cutover. Commit per task, no push, trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. JDK 25 offline Maven wrapper build.

---

### Task 1 (backend): `search_history` table + record/recent/clear + admin keywords
**Files:** create `com.db.dbworld.audit.tracking.entity.SearchHistoryEntity`, `...repository.SearchHistoryRepository`, `...search.SearchHistoryService`, `...search.MeSearchHistoryController`; extend `AdminActivityController`/`AdminActivityService` with a search-keywords endpoint. DTOs under `...admin.dto`/`...search.dto`.
- `SearchHistoryEntity` (`@Table(name="SEARCH_HISTORY", schema="new_db_world")`, Lombok, `Instant`): `id (IDENTITY)`, `user_id`, `query_raw (256)`, `query_norm (256)` (trimmed+lowercased), `result_count (Integer)`, `opened_record_id (Long, nullable)`, `channel (String, e.g. WEB/APP)`, `created_at`. Indexes: `(user_id, created_at)`, `(query_norm)`.
- `SearchHistoryRepository extends JpaRepository<SearchHistoryEntity, Long>`:
  - `record(...)` write via the service.
  - recent-distinct for a user: a native or JPQL query returning the most recent distinct `query_raw` per `query_norm` for a user, newest first, limited (e.g. `SELECT ... GROUP BY query_norm ORDER BY MAX(created_at) DESC` with `LIMIT`). Provide as a `@Query` returning a projection (queryRaw, lastAt) or `List<String>`.
  - delete-all-for-user and delete-one (`deleteByUserId(Long)`, `deleteByUserIdAndQueryNorm(Long,String)` — `@Modifying`/derived, in a `@Transactional` service method).
  - admin keywords: `@Query` grouping by `query_norm` over a window → (query, count, avgResultCount, zeroResultCount) projection.
- `SearchHistoryService` (`@Service`): `record(Long userId, String rawQuery, Integer resultCount, String channel)` — normalize; **prefix-collapse**: if the user's most recent entry (within a short window, e.g. `searchPrefixCollapseSec` from `TrackingProperties`) is a prefix of the new query (or vice-versa), UPDATE that row to the longer query instead of inserting (so "d→da→dark" keeps one "dark"). `recent(Long userId, int limit)` → distinct recent raw queries. `clearAll(Long userId)`, `clearOne(Long userId, String query)`. `topKeywords(int days, int limit)` for admin.
- `MeSearchHistoryController` `@RestController @RequestMapping("/api/me/search-history") @RequiredArgsConstructor` (authenticated, NOT admin):
  - `POST ""` body `{ query, resultCount, openedRecordId? }` → `service.record(userContext.userId(), ...)`, channel from `X-DbWorld-Client` header. Returns `ApiResponse.success(...)`. Never 500 on empty/blank query (ignore blanks).
  - `GET "?limit=8"` → recent distinct.
  - `DELETE ""` → clearAll. `DELETE "/{query}"` → clearOne.
- Admin: add `GET /api/admin/activity/search-keywords?days=30&limit=20` (`@AdminAccess`) → `service.topKeywords(...)` (in `AdminActivityController`, delegating to `SearchHistoryService`).
- Unit test (optional but preferred): `SearchHistoryServiceTest` for prefix-collapse logic (pure-ish; mock repo) — verify a prefix within window updates rather than inserts.
- [ ] Implement + compile + tracking-test sweep. Commit.

### Task 2 (backend): per-user activity read endpoints over new tables
**Files:** create `com.db.dbworld.audit.tracking.me.MeActivityController` (`/api/me/tracking`) + `MeActivityService` + DTOs.
- Endpoints (authenticated, `userId` from `UserContext`; a user sees only their own):
  - `GET /summary` → totals for the user: streams count, downloads count, unique titles, GB delivered (Σ unique_bytes), total watch time (Σ watch_duration or from STREAM sessions), completion rate. Native aggregate over `activity_session WHERE user_id=:uid`.
  - `GET /timeline?activity=&page=&size=` → the user's sessions (paginated), newest first, optional activity filter — reuse `ActivitySessionRepository.search(...)` with `userId` fixed to the caller.
- Keep the OLD `/api/me/activity` controller untouched (removed at cutover). New path `/api/me/tracking/*` avoids mapping conflicts.
- [ ] Implement + compile. Commit.

### Task 3 (frontend): cinema search — record + recent-searches UI
**Files:** cinema search overlay `db-world-frontend/src/features/cinema/screens/search/index.js` (READ it first) + a small `searchHistoryApi` (in `features/cinema/api/cinemaApi.js` or new module).
- On a settled debounced search (query length >= 2, results loaded), call `POST /api/me/search-history { query, resultCount }` (fire-and-forget, swallow errors). Also record `openedRecordId` when the user opens a result (optional; include if easy).
- Replace the static "Trending: …" empty-state (~line 534) with **Recent searches**: `GET /api/me/search-history?limit=8` via TanStack Query; render clickable chips (click → set the search term + run), each with an × to remove (`DELETE /api/me/search-history/{query}` + invalidate), and a "Clear" action (`DELETE /api/me/search-history` + invalidate). Themed to the cinema UI (match the overlay's existing styling, NOT the admin `useT()`). Empty → fall back to the trending hint.
- Remove reliance on the dead `saveUserEventInfo('SEARCH', …)` stub for this (leave the stub itself for cutover).
- ESLint clean.
- [ ] Implement. Commit.

### Task 4 (frontend): repoint `/me/activity` to new endpoints
**Files:** `db-world-frontend/src/features/cinema/me/activity/myActivityApi.js` + `ActivitySummaryCard.jsx` + `ActivityTimelineList.jsx` (READ them first).
- Repoint `myActivityApi.js` fetchers to the new `/api/me/tracking/summary` and `/api/me/tracking/timeline` endpoints (keep function names stable if the components import them). Map the new DTO field names into what the components render (adjust the components' field reads to the new shapes; keep the visual layout).
- Verify the summary card + timeline list render the new fields (streams/downloads/GB/watch-time/completion; timeline rows show title, activity, state, %, when). ESLint clean.
- [ ] Implement. Commit.

## Deferred
- Phase 5 cutover (destructive; after user prod-verifies): enable flag in prod, verify, delete old `UserCinemaActivity*`/`LogShipperService*`/`DownloadAccumulator`/`LogLineParser`/old analytics + old `/api/me/activity` + `saveUserEventInfo` stub, drop `user_cinema_activity` table.

## Review
Consolidated review at end: search prefix-collapse correctness + per-user data isolation (a user can only read/clear their own history/activity) + no-500 on blank input; frontend field wiring + fire-and-forget recording + cinema-theme consistency.
