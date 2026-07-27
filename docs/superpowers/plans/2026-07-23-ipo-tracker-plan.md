# IPO Tracker Implementation Plan (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new top-level **IPO Tracker** app in db-world. A scheduled poller pulls Indian IPOs from 2–3 free sources, merges them into one record per IPO, stores current state + GMP/subscription **history**, detects lifecycle changes, and delivers **Android + Web push** notifications. Users get a page (list + detail + GMP ₹/% chart + subscription chart + list-level allotment status & registrar deep-link); admins get a console page (source health, cadence config, manual re-poll, change feed).

**Spec (source of truth):** [docs/superpowers/specs/2026-07-23-ipo-tracker-design.md](../specs/2026-07-23-ipo-tracker-design.md)

**Scope:** v1 only. **Out of scope (v2):** applicant-level "My IPOs" (per-user saved applications + guided allotment check). Do not build `ipo_user_application` in this plan.

**Architecture:** New backend module `com.db.dbworld.app.ipo`, structured like `app.wallet`/`app.pm`. Source adapters implement a common `IpoSource` interface; an `IpoMergeService` reconciles them via a match key + field-precedence config; `IpoIngestService` persists current state, appends history, and emits `IpoChangeEvent`s; an `IpoPollScheduler` runs on the `scheduler_job_config` cadence pattern (same as `MediaSyncService` / `SchedulerJobConfigEntity`). Change events fan out to a new `IpoNotificationDispatcher` → **push transport** (Phase 5, net-new FCM-based delivery — Android + Web). Frontend: user feature `src/features/ipo/` + admin feature `src/features/admin/ipo/`, on the AdminV2 stack, registered as a new app in `homeData.APPS`.

**Tech Stack:** Spring Boot 4 (Java 25, WAR), Spring Data JPA + MySQL (`ddl-auto=update` — no migrations), Lombok, JUnit 5 + Mockito + AssertJ. React 18 + Vite, MUI v7 + `@mui/x-charts` v8, TanStack Query v5, RHF + Zod v4, Capacitor 7 (`@capacitor/push-notifications` already present). Push delivery: **Firebase Cloud Messaging** (Android + Web) via `firebase-admin` (new backend dep) — see Phase 5.

---

## Global Constraints

- **Branch:** all work on `feat/ipo-tracker` (create off `development`). Never commit to `development`.
- **Backend build:** JDK 25. Maven wrapper at `C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn`; set `JAVA_HOME` to JDK 25. Run tests: `cd db-world-backend && "$MVN" -q -Dtest=<Test> test`.
- **Response envelope:** return `com.db.dbworld.payloads.ApiResponse<T>` directly (not `ResponseEntity`).
- **Client errors:** `throw new DbWorldException(HttpStatus.BAD_REQUEST|NOT_FOUND|…, "msg")`. Never plain `IllegalArgumentException` for 4xx (maps to 500).
- **Current user:** inject `com.db.dbworld.core.context.UserContext`; `userContext.userId()` → `Long`.
- **Auth:** `@com.db.dbworld.core.role.annotations.AnyRole` on user endpoints, `@AdminAccess` on admin endpoints. Public read endpoints (if any) → `AppConstants.PUBLIC_APIS`.
- **Entities:** `schema = "db_world"`, `@Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36) String id`, `@CreationTimestamp`/`@UpdateTimestamp` with `java.time.Instant`, Lombok `@Getter @Setter @NoArgsConstructor` (+`@AllArgsConstructor @Builder` where built fluently). **No schema migrations — `ddl-auto=update` creates tables.** Index columns used in lookups (`match_key`, `(ipo_id, captured_at)`, `status`).
- **Backend tests:** pure JUnit 5 + Mockito `mock(...)` in `@BeforeEach` + AssertJ. No `@SpringBootTest`/`@DataJpaTest`/H2 — mock repos and the HTTP client.
- **Secrets stay in env** (`../runtime/backend.env`), never in the DB config catalog: `IPO_GURU_API_KEY`, and (Phase 5) the Firebase service-account path / `FCM_*`.
- **Frontend:** axios via `import axiosInstance from '@shared/components/ui/utils/AxiosInstants'` (unwrap `res.data.data`); theme via `import { useT } from '@shared/theme'`; route constants need BOTH a named `export const` AND an entry in the default-export object in `src/shared/constants/index.js`. **No FE test harness** — verification is manual in the user's browser (ESLint must pass). Do not start the dev server; the user verifies.
- **UI quality bar (required):** **modern, attractive, user-friendly, and compact.** Fully **responsive across all screen sizes** (phone → tablet → desktop), mobile-first with fluid/`clamp()` spacing and a compact information density (no wasted whitespace; tables collapse to cards on small screens). Match the existing db-world design language (AMOLED dark / white light via `useT()`, Framer Motion transitions, the cinematic-redesign card/hero idioms). Use the `frontend-design` and `ui-ux-pro-max` skills for direction; charts follow `dataviz`. Verify each screen at mobile / tablet / desktop widths.
- **Notifications:** IPO notifications go to **push only** — do **not** write to `UserNotificationEntity` (that is the in-app feed, excluded by decision). General admin/user form success/error toasts (UI affordance) are fine and unrelated to the IPO notification channel.
- **Commits:** commit after each task **locally** (no push, no per-fix push). **Omit any `Co-Authored-By: Claude` trailer.** The user reviews and pushes/merges when the branch is complete.
- **DRY / YAGNI / TDD.**

---

## File Structure

**Backend — `db-world-backend/src/main/java/com/db/dbworld/app/ipo/`**
- `entity/` — `IpoListingEntity`, `IpoGmpHistoryEntity`, `IpoSubscriptionHistoryEntity`, `IpoChangeEventEntity`, `IpoSourcePollEntity`.
- `repository/` — one `JpaRepository` per entity.
- `dto/` — records: `IpoDto` (normalized source row), `IpoSummaryDto`, `IpoDetailDto`, `GmpPointDto`, `SubscriptionPointDto`, `IpoChangeDto`, `SourceHealthDto`.
- `source/` — `IpoSource` (interface), `IpoGuruSource`, `NseSource`, `ChittorgarhSource`, `IpoSourceRegistry`.
- `service/` — `IpoNormalizer` (match-key), `IpoMergeService` (precedence), `IpoIngestService` (persist + diff + history + events), `IpoQueryService` (read API), `IpoSourcePollService` (health), `IpoNotificationDispatcher`.
- `scheduler/` — `IpoPollScheduler` + `IpoSchedulingConfig` (mirrors `MediaSyncSchedulingConfig`).
- `controller/` — `IpoController` (user), `IpoAdminController` (admin).
- `mapper/IpoMapper.java` — hand-written entity↔DTO + masking.
- `push/` (Phase 5) — `PushDeviceEntity`, `PushDeviceRepository`, `PushTokenController`, `FcmPushSender`, `PushConfig`.
- Config keys → `app/admin/config/registry/ConfigKeys.java` + `SettingsCatalog.java`.

**Backend tests — `db-world-backend/src/test/java/com/db/dbworld/app/ipo/`** (mirror services/sources).

**Frontend — `db-world-frontend/src/features/ipo/`** (user) + **`src/features/admin/ipo/`** (admin). Plus edits to `src/shared/constants/index.js`, `src/app/App.jsx`, `src/shared/components/layout/home/homeData.jsx`, `src/features/admin/layout/AdminLayout.jsx`, and (Phase 5/7) a web push service worker + FCM init.

---

## Phase 0 — Config & constants

### Task 0.1: Register IPO config keys
**Files:** modify `ConfigKeys.java`, `SettingsCatalog.java`; fix `SettingsServiceTest.java` row-count.
**Interfaces (DB catalog — non-secret):**
- `ipo.sources.enabled` (STRING, csv: `ipoguru,nse,chittorgarh`)
- `ipo.ipoguru.base-url` (STRING, default `https://www.ipoguru.in/api/v1`)
- `ipo.gmp.notify-threshold-pct` (LONG/█ default e.g. 10)
- `ipo.poll.subscription-interval-hours`, `ipo.poll.gmp-interval-hours` (LONG) — or fold into scheduler_job_config (Task 4.1).
- **Secret (env, NOT catalog):** `IPO_GURU_API_KEY`.

- [ ] Bump the catalog row-count assertion in `SettingsServiceTest` first (TDD red), add keys, green, commit.

---

## Phase 1 — Domain (entities, repositories, DTOs)

### Task 1.1: Entities + repositories
**Files:** create the five `entity/` + five `repository/` classes.
**Interfaces (key fields per spec §6; UUID String ids, `schema="db_world"`):**
- `IpoListingEntity`: `matchKey` (unique, indexed), company/type/status, dates, price band, lot, issueSize, `listingExchange/listingPrice/listingGainPct`, snapshot `gmp/gmpPct/subTotal`, `allotmentStatus/registrar/registrarUrl`, `firstSeenAt/lastSeenAt`.
- `IpoGmpHistoryEntity` / `IpoSubscriptionHistoryEntity`: `ipoId`, values, `source`, `capturedAt`; index `(ipoId, capturedAt)`.
- `IpoChangeEventEntity`: `ipoId`, `eventType`, `oldValue`, `newValue`, `createdAt`.
- `IpoSourcePollEntity`: `source` (id), `lastPolledAt/lastSuccessAt/lastStatus/consecutiveFailures`.

- [ ] Create entities + repos (no logic). Compile. Commit. (No unit test — trivial JPA.)

### Task 1.2: DTOs + `IpoMapper`
**Files:** `dto/*`, `mapper/IpoMapper.java` + `IpoMapperTest`.
- [ ] TDD the mapper (entity→summary/detail; history→point DTOs). Commit.

---

## Phase 2 — Source adapters

### Task 2.1: `IpoSource` interface + `IpoDto`
- [ ] Define `IpoSource { String key(); List<IpoDto> fetchAll(); }`. `IpoDto` = normalized fields (nullable where a source lacks them). Commit.

### Task 2.2: `IpoGuruSource` (primary)
**Files:** `source/IpoGuruSource.java` + test.
**Interfaces:** reads base-url from catalog + `IPO_GURU_API_KEY` from env; `GET /ipos?status=…` with `X-API-KEY` header; maps `{success,count,data[]}` → `List<IpoDto>`. Retry + backoff (reuse the updater's pattern); on non-200 return empty + let scheduler mark the source failed.
- [ ] TDD with a mocked HTTP client (fixture JSON). Handle 429. Commit.

### Task 2.3: `NseSource` (authoritative dates/status/listing)
**Files:** `source/NseSource.java` + test.
**Interfaces:** cookie-prime (GET homepage → reuse cookies), real `User-Agent` + referer, then hit the IPO JSON endpoint. Map to `IpoDto` (dates, status, listingExchange, listingPrice). If anti-bot blocks, degrade gracefully (empty + failure marker).
- [ ] TDD with mocked client. Commit. *(Note: NSE is the flakiest source; keep it non-fatal.)*

### Task 2.4: `ChittorgarhSource` (fallback / gap-fill) — Jsoup
**Files:** `source/ChittorgarhSource.java` + test. Add `org.jsoup:jsoup` dep if absent.
**Interfaces:** GET the `/report/mainboard-ipo-list…` page, parse the table → `IpoDto` (allotment, listing gain). Polite rate-limit.
- [ ] TDD parsing against a saved HTML fixture. Commit.

### Task 2.5: `IpoSourceRegistry`
- [ ] Collect enabled `IpoSource` beans per `ipo.sources.enabled`. Commit.

---

## Phase 3 — Merge, diff, ingest

### Task 3.1: `IpoNormalizer` (match key)
- [ ] TDD `normalize(name)+open_date` → `matchKey` (lowercase, strip `Ltd/Limited/Pvt`, collapse ws). Commit.

### Task 3.2: `IpoMergeService` (field precedence)
**Interfaces:** group source `IpoDto`s by match key; produce one merged `IpoDto` per key using the precedence table (dates/status/listing→NSE; gmp/subscription→IPO Guru; allotment/gain/fallback→Chittorgarh). Log discarded conflicts.
- [ ] TDD: 3 sources with overlapping + conflicting fields → correct winner per field. Commit.

### Task 3.3: `IpoIngestService` (persist + change detection + history)
**Interfaces:** for each merged record — upsert `ipo_listing` by matchKey; when a tracked field changes emit the right `IpoChangeEventEntity` (`NEW|STATUS|GMP|SUBSCRIPTION|ALLOTMENT|LISTING`); **append GMP/subscription history only when the value changed** vs the last capture. Idempotent (re-running the same feed emits nothing new).
- [ ] TDD: new IPO → `NEW` + row; unchanged feed → no events, no history dup; status flip → `STATUS`; gmp change → `GMP` + one history row. Commit.

---

## Phase 4 — Scheduler & health

### Task 4.1: Cadence via `scheduler_job_config`
**Files:** seed IPO job rows in the `scheduler_job_config` `DEFAULTS` (like `MediaSyncService`); `IpoSchedulingConfig` mirroring `MediaSyncSchedulingConfig`.
- [ ] Seed idempotently in `@PostConstruct`; read live cadence at point-of-use. Commit.

### Task 4.2: `IpoPollScheduler`
**Interfaces:** on tick → `registry.enabled().fetchAll()` → merge → ingest → update `ipo_source_poll` (success/failure, consecutiveFailures, timestamps) → hand new events to `IpoNotificationDispatcher`. Crash-safe: reclaim stuck `RUNNING` on startup (TMDB-sync pattern). Quota-aware: run list refresh daily, gmp/subscription on their shorter cadences.
- [ ] TDD the orchestration with mocked collaborators (verify health updates + dispatcher called with new events only). Commit.

---

## Phase 5 — Push delivery (Android + Web) — DEFERRED fast-follow

> **Decided:** build this **after Phases 6–8** (tracker + charts + admin ship first). Numbered 5 for logical grouping; execute last.
>
> **Cost: FREE.** FCM runs on Firebase's free **Spark plan** — no billing account, no card, sends both Android + Web. The only setup is creating a free Firebase project + downloading a service-account JSON. (Zero-Google alternative: standalone **VAPID** web-push is also free, but Android needs FCM — so FCM is the pick.)
>
> **Prerequisite before this phase:** user creates the free Firebase project + drops the service-account into `backend.env`.

### Task 5.1: Push token store + registration endpoint
**Files:** `push/PushDeviceEntity` (`userId`, `token`, `platform` `ANDROID|WEB`, `createdAt`, `lastSeenAt`, unique on `token`), repo, `PushTokenController` (`POST /api/push/register`, `DELETE /api/push/unregister`).
- [ ] TDD service (upsert by token, dedupe). Commit.

### Task 5.2: `FcmPushSender` (`firebase-admin`)
**Files:** add `com.google.firebase:firebase-admin` dep; `push/PushConfig` (init `FirebaseApp` from service-account path in env); `FcmPushSender.send(userId, title, body, data)` → look up the user's tokens, send via FCM, prune tokens FCM reports invalid.
- [ ] TDD with a mocked `FirebaseMessaging`. Commit.

### Task 5.3: `IpoNotificationDispatcher`
**Interfaces:** map each `IpoChangeEvent` → title/body per the trigger table (spec §10), honoring `ipo.gmp.notify-threshold-pct`; call `FcmPushSender`. **Does not touch `UserNotificationEntity`.** Include a deep-link `data` payload (route to the IPO detail).
- [ ] TDD event→message mapping + threshold gate. Commit.

### Task 5.4: Web push client (service worker)
**Files:** `db-world-frontend/public/firebase-messaging-sw.js` + FCM web init in the app; register the SW, request permission, obtain the web token, `POST /api/push/register` with `platform=WEB`.
- [ ] Wire it; ESLint. **User verifies** permission prompt + token registration in browser. Commit.

### Task 5.5: Android push registration
**Files:** frontend push bootstrap using `@capacitor/push-notifications` (already installed) — request permission, register, send FCM token with `platform=ANDROID`; tap handler routes to the IPO detail deep-link.
- [ ] Wire it; ESLint. **Hand Android build + device test to the user** (Android can't be compiled here — loopback issue). Commit.

---

## Phase 6 — Read API

### Task 6.1: `IpoQueryService` + `IpoController`
**Endpoints (`@AnyRole`, `ApiResponse<T>`):**
- `GET /api/ipo` (filter `status`) → `List<IpoSummaryDto>` + a `lastUpdated` (max `ipo_source_poll.lastSuccessAt`).
- `GET /api/ipo/{id}` → `IpoDetailDto`.
- `GET /api/ipo/{id}/gmp-history` → `List<GmpPointDto>` (`t, gmp, gmpPct`).
- `GET /api/ipo/{id}/subscription-history` → `List<SubscriptionPointDto>`.
- [ ] TDD service; thin controller. Commit.

---

## Phase 7 — User app (new top-level app)

> Applies the **UI quality bar** (Global Constraints): modern, compact, responsive at every breakpoint, matching db-world's design language. Verify each page at mobile / tablet / desktop.

### Task 7.1: Register the app + route
**Files:** `src/shared/constants/index.js` (route `/ipo`), `src/app/App.jsx` (route), `src/shared/components/layout/home/homeData.jsx` (add an `APPS` entry — icon/label/route, mirroring Wallet/Vault/Games).
- [ ] Add; ESLint. Commit.

### Task 7.2: List page + TanStack Query api module
**Files:** `src/features/ipo/api/ipoApi.js`, `src/features/ipo/pages/IpoListPage.jsx`, status filter, `useT()` theming, "Last updated HH:MM IST" stamp.
- [ ] Build; ESLint; **user verifies in browser.** Commit.

### Task 7.3: Detail page + charts
**Files:** `IpoDetailPage.jsx`, `GmpChart.jsx` (dual axis: left ₹ `gmp`, right % `gmpPct`, toggle), `SubscriptionChart.jsx` (QIB/NII/Retail/Total), allotment status + registrar deep-link button. Use `@mui/x-charts`; follow the `dataviz` conventions.
**Required attribution (IPO Guru free-API condition):** display a **prominent, visible credit** — "GMP data sourced from IPO Guru" — with a **backlink to https://www.ipoguru.in** next to the GMP data/chart on the IPO page. This is a contractual condition of the free key; must ship on the page before the API is used in production.
- [ ] Build; ESLint; **user verifies.** Commit.

---

## Phase 8 — Admin console page

### Task 8.1: `IpoAdminController`
**Endpoints (`@AdminAccess`):** `GET /api/admin/ipo/sources` (health from `ipo_source_poll`), `POST /api/admin/ipo/repoll` (manual trigger), `GET /api/admin/ipo/changes` (recent `IpoChangeEvent`s), cadence read/update (or defer to the existing Scheduler page if the job rows show there).
- [ ] TDD service; thin controller. Commit.

### Task 8.2: Admin page
**Files:** `src/features/admin/ipo/` — source-health cards, manual re-poll button, change feed (MUI DataGrid), cadence form (RHF+Zod). Register in `AdminLayout.jsx` nav.
- [ ] Build; ESLint; **user verifies.** Commit.

---

## Phase 9 — Integration & docs

- [ ] Full backend build + all IPO tests green: `cd db-world-backend && "$MVN" -q test`.
- [ ] Frontend ESLint clean.
- [ ] Update the spec's Status to "implemented (v1)"; note the IPO Guru key + Firebase project as go-live prerequisites.
- [ ] Hand to user: Android build + `cap sync` + device test (push + deep-link); set `IPO_GURU_API_KEY` + Firebase service-account in `backend.env`; smoke-test one live poll cycle.
- [ ] **Do not merge or push** — user reviews the branch and integrates.

---

## Risks / call-outs
- **Push infra (Phase 5) is net-new but FREE (FCM Spark plan)** — decided as a fast-follow after 6–8. Only prerequisite is a free Firebase project + service-account; no cost.
- **NSE anti-bot** is fragile; keep it non-fatal and lean on IPO Guru as primary.
- **IPO Guru free limits** (300/day) — the quota-aware cadence in Task 4.1 must respect them; don't poll every source every tick.
- **Applicant-level "My IPOs" is explicitly v2** — not in this plan.
