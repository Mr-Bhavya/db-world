# Activity Tracking — Plan 2: Admin Activity Console

> **For agentic workers:** implement task-by-task on branch `feat/activity-audit-tracking`, subagent-driven. Backend tasks: one offline `mvn compile`/tracking-test per task. Frontend tasks: the React app isn't built per-step here — implement carefully following the cited existing patterns; full build/runtime verification is the USER's (like Android). One consolidated review at the end.

**Goal:** Rebuild the existing admin `activity-center` page to read the new event-sourced tracking backend, with 4 responsive tabs (Overview / Live / Sessions+timeline / Request Log), plus the backend admin read APIs that feed it.

**Scope note:** Admin-only. User-facing pieces (personal `/me/activity`, in-search recent-searches dropdown) are deferred to a later "user" phase per the user. Search-keyword analytics + app-reported pause/resume/retry will populate once the client/Android phases land; columns are present now and fill in then. Data available NOW comes from the RESOLVE hook + nginx shipper (covers app/browser/IDM/1DM downloads AND streams).

**Architecture:** New `AdminActivityController` (`/api/admin/activity/*`, `@AdminAccess`) → `AdminActivityService` → repository queries over `activity_session`/`activity_event` (Spring Data interface projections for aggregates; `JpaSpecificationExecutor` on `ActivitySessionRepository` for the filtered paginated sessions list). Frontend: rebuilt `features/admin/activity-center` consuming these via `activityApi.js`, responsive via the `useT()` + `useMediaQuery` breakpoint idiom, reusing `features/admin/analytics` chart components repointed to the new data.

**Tech Stack:** Backend Spring Boot 4 / Java 25 (JDK 25 build). Frontend React + Vite, TanStack Query v5, MUI + MUI X Charts (LineChart), MUI DataGrid/Table, `useT()`/`useThemeMode()` theming, axios `axiosInstance`, Notistack, Framer Motion.

## Global Constraints
- Branch `feat/activity-audit-tracking`; commit per task; no push. Trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Backend: `@AdminAccess` on every endpoint; return `ApiResponse<T>.success(...)`; date ranges via `Instant` + `ChronoUnit` (Java) / MySQL `INTERVAL` (SQL); interface projections → record DTOs in the service; `JpaSpecificationExecutor` for dynamic filters (case-insensitive LIKE, exact enum match, date range) returning `Page<..>`. New code under `com.db.dbworld.audit.tracking.admin.*`. JDK 25 offline Maven wrapper build.
- Frontend: follow the admin idiom exactly — `const T = useT();`, `useMediaQuery(theme.breakpoints.down('md'))` for `isMobile`, `up('lg')`/`up('xl')` for extra columns; conditional mobile-cards vs desktop-table render; TanStack Query hooks with sensible `staleTime`/`refetchInterval`; API modules return `r.data.data`. New/edited files under `features/admin/activity-center/`. Reuse `features/admin/analytics/components/*` charts (repoint props to new API shapes). Do NOT delete the old `analytics` folder or old endpoints (removed at Phase 5 cutover).
- Verification: backend = one offline `"$MVN" -q -o compile` (and tracking test sweep if tests touched) per task; frontend = careful implementation per cited patterns, build/runtime deferred to user.

---

### Task 1 (backend): read DTOs + repository queries + `AdminActivityService`
**Files:** create under `com.db.dbworld.audit.tracking.admin.dto` the record DTOs + projection interfaces; add query methods to `ActivitySessionRepository` (+ make it extend `JpaSpecificationExecutor<ActivitySessionEntity>`) and `ActivityEventRepository`; create `com.db.dbworld.audit.tracking.admin.AdminActivityService`.

Provide (model on `AdminAnalyticsService` + `UserCinemaActivityRepository` patterns — READ those):
- **Overview** (`ActivityOverviewDto`): activeNow (count of sessions in ACTIVE/PAUSED with recent lastEventAt), downloadsToday, streamsToday, uniqueUsers (window), gbDelivered (Σ unique_bytes/1e9 over window), avgSpeedBps, completionRate. One or two native aggregate queries over `activity_session`.
- **Live sessions** (`LiveSessionDto`): list of ACTIVE/PAUSED sessions with recent `last_event_at`; join `users`(email) + `records`(name/type) via LEFT JOIN native projection → fields: sessionId, userEmail, title, activity, channel, clientApp, state, completionPercent, avgSpeedBps/maxSpeedBps, peakConnections, uniqueBytes, fileSize, startedAt, lastEventAt.
- **Sessions list**: on `ActivitySessionRepository` add a `default Page<ActivitySessionEntity> search(...)` using `JpaSpecificationExecutor` with optional filters: userId, activity (enum), channel (enum), clientApp (string), state (enum), recordId, from/to (Instant on lastEventAt). (Enrich user email/title in the service or via a follow-up lookup — simplest: expose the entity fields + resolve recordName in the service by a batch lookup, OR add a native projection variant `findSessionRows(...)`; choose the simpler given the codebase and document it.)
- **Session events** (`SessionEventDto`): `activityEventRepository`-backed ordered list of events for a `sessionId` (eventTime, eventType, source, bytesDelta, cumulativeBytes, speedBps, connections, positionMs, completionPercent, errorCode/message) — the timeline.
- **Trend** (reuse shape `DailyActivityDto`-like): daily streams/downloads over N days from `activity_session` (or `activity_event`).
- **Client breakdown** (`clientApp`, count) and **top-content** (recordId/title/type/streamCount/downloadCount/uniqueUsers) and **top-users** (userId/email/lastActive/totalSessions/gb) over the window.
- [ ] Implement projections + DTOs + repo queries + service methods (transform projection→record). Compile: `"$MVN" -q -o compile`. Commit.

### Task 2 (backend): `AdminActivityController`
**Files:** create `com.db.dbworld.audit.tracking.admin.AdminActivityController` (`@RestController @RequestMapping("/api/admin/activity") @RequiredArgsConstructor`).
Endpoints (all `@AdminAccess`, return `ApiResponse<..>`):
- `GET /overview?days=7`
- `GET /live?withinMinutes=30`
- `GET /sessions?userId=&activity=&channel=&clientApp=&state=&recordId=&from=&to=&page=&size=` → `Page<..>`
- `GET /sessions/{sessionId}/events`
- `GET /trend?days=30`
- `GET /client-breakdown?days=30`
- `GET /top-content?days=30&limit=20`
- `GET /top-users?days=30&limit=20`
- [ ] Wire to the service. Compile. Commit. (Runtime/DB verification deferred to user.)

### Task 3 (frontend): `activityApi.js` client for the new endpoints
**Files:** edit `features/admin/activity-center/activityApi.js` (READ it first; it currently calls the OLD endpoints).
- Add functions hitting the new `/api/admin/activity/*` endpoints, each returning `r.data.data` via `axiosInstance` (see `features/admin/api/adminApi.js` for the idiom): `fetchActivityOverview(days)`, `fetchLiveSessions(withinMinutes)`, `fetchSessions(params)`, `fetchSessionEvents(sessionId)`, `fetchActivityTrend(days)`, `fetchClientBreakdown(days)`, `fetchTopContent(days,limit)`, `fetchTopUsers(days,limit)`.
- Keep any Request-Log fetch used by `ApiLogsFeed` (it reads the separate working audit) intact.
- [ ] Implement. Commit. (No build here.)

### Task 4 (frontend): rebuild `activity-center/index.jsx` as a 4-tab responsive shell
**Files:** rebuild `features/admin/activity-center/index.jsx` (READ current version first to preserve tab/store patterns).
- 4 tabs: **Overview**, **Live**, **Sessions**, **Request Log**. Use the existing tab mechanism if present; else MUI `Tabs`. Responsive: on mobile use a compact tab bar / scrollable tabs.
- Lazy-render each tab's feed component. Keep `useT()` theming; page container respects `T.adminBg`/`T.glass`/`T.border`. Ensure it works mobile/desktop/monitor (max-width container, `p:{xs,sm}` padding).
- Route already exists (`activity-center`); no router change needed.
- [ ] Implement shell. Commit.

### Task 5 (frontend): Overview tab
**Files:** create `features/admin/activity-center/OverviewTab.jsx` (or rebuild `OverviewFeed.jsx`).
- KPI cards (active now, downloads/streams today, unique users, GB delivered, avg speed, completion rate) — responsive grid (`Grid`/`Box` with `xs=6 sm=4 md=2` etc.).
- Charts: reuse `features/admin/analytics/components/ActivityTrendChart.jsx` (repoint to `fetchActivityTrend`) and `ClientBreakdownChart.jsx` (repoint to `fetchClientBreakdown`); reuse `TopRecordsTable`/`TopUsersTable` repointed. TanStack Query with `staleTime: 30_000`.
- [ ] Implement. Commit.

### Task 6 (frontend): Live tab
**Files:** create `features/admin/activity-center/LiveTab.jsx`.
- TanStack Query `fetchLiveSessions` with `refetchInterval: 5000`. Responsive: desktop table (user, title, activity, channel/client, %, speed, connections, state, duration) with `isLg`/`isXl` extra columns; mobile cards. Show a live "•" indicator; empty state when none active.
- [ ] Implement. Commit.

### Task 7 (frontend): Sessions tab + event-timeline drill-down
**Files:** create `features/admin/activity-center/SessionsTab.jsx` + `SessionDetailModal.jsx`.
- Filter bar (user search, activity, channel, clientApp, state, date range). Paginated list via `fetchSessions` (TanStack `useQuery` keyed on filters+page, or `useInfiniteQuery`). Responsive: desktop table / mobile cards.
- Row click → `SessionDetailModal`: session summary (all the metrics incl. attempts/pause/resume/bytes/wasted) + the **event timeline** from `fetchSessionEvents(sessionId)` rendered as a vertical timeline (RESOLVE→START→PROGRESS…→COMPLETE/FAIL/ABORT). Centered dialog, responsive full-screen on mobile.
- [ ] Implement. Commit.

### Task 8 (frontend): Request Log tab
**Files:** keep/adapt `features/admin/activity-center/ApiLogsFeed.jsx` as the Request Log tab (it reads the separate, working `UserActivityLog` audit).
- Ensure it renders in the new shell and is responsive (mobile cards / desktop table). Minimal changes if it already works.
- [ ] Implement/verify. Commit.

---

## Deferred beyond this plan
- User-facing: `/me/activity` repoint, in-search recent-searches UI (later "user" phase).
- Client `/api/track` ingest API + web-player reporting + Android reporting (Phase 4) → then app pause/resume/retry + search-keyword data flows in.
- Phase 5 cutover: enable flag in prod, verify, delete old tracking (`UserCinemaActivity*`, `LogShipperService*`, old `analytics` endpoints/UI), drop old table.

## Review
One consolidated review at the end: backend read-API correctness (projection/DTO mapping, filter spec, N+1 risks on the sessions/live joins) + frontend adherence to the responsive admin idiom and correct API wiring. Then hand the user the build/run + backend boot verification.
