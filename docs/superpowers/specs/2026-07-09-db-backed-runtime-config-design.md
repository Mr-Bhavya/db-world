# DB-Backed Runtime Config + Admin Settings Page

- **Date:** 2026-07-09
- **Branch:** `feat/db-backed-app-config` (off `development`)
- **Status:** Design — approved; ready for implementation planning
- **Author:** Claude (Opus 4.8) with bhavya.dudhia

---

## 1. Problem & Context

`application.yml`, `application-local.yml`, and `application-prod.yml` have accreted a large
number of settings. Many are runtime tuning knobs and feature flags that the operator wants
to change without editing YAML on the Pi and restarting the backend. The goal is to move the
**runtime-tunable subset** into a DB table that is editable from a new **admin Settings page**,
so changes take effect live (no redeploy, no restart) — mirroring the pattern the codebase
already uses for scheduler jobs.

### Config tiers (only Tier 3 moves)

The existing config splits into three tiers. **Only Tier 3 is in scope.**

1. **Bootstrap / infrastructure — stays in YAML.** Needed before the app can reach the DB or
   finish starting, so moving them is a chicken-and-egg problem: `spring.datasource.*`,
   `spring.data.redis.*`, `server.port`, `jpa.hibernate.ddl-auto`, `spring.config.import`,
   `logging.config`.
2. **Secrets — stay in env/YAML.** `jwt.secret`/`private-key`, `jasypt.password`,
   `tmdb.bearerToken`/`apiKey`, `aria2.secret`, `openweather.api-key`, and
   `app.cdn.signing.secret`. These already live in env vars via `../runtime/backend.env` and
   are **not** moved. (`cdn.signing.secret` was considered for the UI but, per decision, stays
   in env — see §7.)
3. **Runtime operational / business-logic knobs — MOVE.** The subset in §6.

### The precedent we are generalizing

`scheduler_job_config` (see `SchedulerJobConfigEntity`, `SchedulerAdminService`,
`MediaSyncService`) already implements DB-backed, live-editable, no-restart config:

- Code-side `DEFAULTS` list seeded idempotently in `@PostConstruct` (`seedDefaults()`), never
  overwriting existing rows.
- Consumers read the live value at point-of-use (`MediaSyncService.currentStabilityWindowMs()`
  re-reads `scheduler_job_config` every scan), falling back to a code default when the column
  is null.
- Edits take effect on the next tick — the admin Scheduler page already proves the UX.

[application.yml:188](../../../db-world-backend/src/main/resources/application.yml) explicitly
documents this design choice for `dbworld.media-sync`. This design extends the same idea from
schedulers to a **general-purpose settings surface**.

### Tier-3 consumers (blast radius)

All Tier-3 keys are bound via `@ConfigurationProperties` beans and read by ~8 classes:

- `WeatherProperties` → `WeatherService`
- `TrackingProperties` → `TrackingSweeper`, `TrackingLogShipper`, `SearchHistoryService`,
  `TrackingIngestService`
- `RecommendProperties` → `RewatchTrendService`, `GenreAffinityService`
- CDN signing (`AppProperties` / `CdnSigner`) → `CdnSigner`, `CdnUrlBuilder`

---

## 2. Goals & Non-Goals

### Goals
- A single generic `app_config` table + a typed `SettingsService` that all Tier-3 consumers
  read through, with edits taking effect **without a restart** (except the one documented
  restart-required key, §6).
- A new **admin Settings page** (AdminV2 stack) that lists settings grouped by category with
  type-aware inputs, validation, per-row reset-to-default, and audit of who changed what.
- Declutter the three YAML files by removing the migrated keys (defaults live in the code-side
  registry instead).
- Fail-safe: a missing or corrupt DB value can never break a hot path or block boot — it falls
  back to the code default with a WARN.

### Non-Goals
- Moving bootstrap/infra config or secrets other than the CDN signing secret.
- Distributed cache invalidation — the backend runs as a single instance on the Pi, so an
  in-memory cache refreshed on write is sufficient.
- A generic "add arbitrary new setting from the UI" builder — settings are declared in code
  (the registry) so they stay type-safe and discoverable. The UI edits values, not the schema.

---

## 3. Data Model

New table `app_config` (schema `db_world`), created by Hibernate `ddl-auto=update`:

| column | type | notes |
|---|---|---|
| `config_key` | VARCHAR(150) PK | dotted key, e.g. `recommend.genre.top-n` |
| `value` | VARCHAR(1000) NULL | current value, string-encoded (Jasypt-encrypted if `secret`) |
| `value_type` | VARCHAR(20) NOT NULL | `BOOLEAN` / `INTEGER` / `LONG` / `STRING` |
| `category` | VARCHAR(60) NOT NULL | UI grouping label |
| `label` | VARCHAR(150) NOT NULL | human-readable name |
| `description` | VARCHAR(500) | help text shown under the input |
| `default_value` | VARCHAR(1000) | seeded default; used for reset + read fallback |
| `min_value` | BIGINT NULL | numeric lower bound (INTEGER/LONG only) |
| `max_value` | BIGINT NULL | numeric upper bound |
| `requires_restart` | BOOLEAN NOT NULL default false | UI shows "takes effect after restart" |
| `display_order` | INT NOT NULL default 0 | ordering within a category |
| `updated_at` | DATETIME | `@PreUpdate` |
| `updated_by` | VARCHAR(100) | admin username from JWT |

`ConfigValueType` is a Java enum with `parse(String)` / `format(Object)` and per-type
validation.

### Setting registry — single source of truth for defaults + metadata

A static `List<SettingDefinition>` (analogous to `SchedulerAdminService.DEFAULTS`) enumerates
every managed key with its type, category, label, description, default, bounds, and the
`requiresRestart` flag. This registry — not YAML — owns the defaults and metadata.

Because the registry owns defaults, the migrated keys are **removed from all three YAML files**
and the corresponding `@ConfigurationProperties` classes are retired (§5).

---

## 4. Access Layer — `SettingsService`

- Backed by `AppConfigRepository extends JpaRepository<AppConfigEntity, String>`.
- In-memory cache: `ConcurrentHashMap<String, String>` populated after seeding on startup and
  refreshed atomically on every write.
- Typed getters: `getBoolean(key)`, `getInt(key)`, `getLong(key)`, `getString(key)`. Each:
  1. reads the cached raw value,
  2. if missing/blank → returns the registry default,
  3. if present but unparseable → logs WARN and returns the registry default.
  **The read path never throws.**
- Seeding (`@PostConstruct`): idempotent, never overwrites an existing row (preserves admin
  edits). Seeding is wrapped in try/catch so a DB hiccup cannot block startup (same defensive
  posture as `SchedulerAdminService.relaxLegacyConstraints`).
- **Change hooks:** most keys need nothing (picked up on next read). Two exceptions:
  - `recommend.rewatch.refresh-cron` — on change, re-arm the cron trigger (mirror
    `SchedulerAdminService.updateCron`). The rewatch scheduler must expose a reschedule method.
  - `springdoc.swagger-ui.enabled` — `requiresRestart=true`; springdoc binds it at startup, so
    the UI shows "takes effect after restart." No live hook.

### Key constants
A `ConfigKeys` class holds the dotted keys as `public static final String` so consumers and the
registry reference the same literals (no stringly-typed drift).

---

## 5. Consumer Migration

Replace `@ConfigurationProperties` reads with `SettingsService` reads at point-of-use:

- `props.getGenre().getTopN()` → `settings.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)`
- Retire `RecommendProperties`, `TrackingProperties`, `WeatherProperties` (defaults are now in
  the registry). `@EnableConfigurationProperties` references to them are removed.
- CDN signing: `CdnSigner`/`CdnUrlBuilder` read `getBoolean(...enabled)`,
  `getInt(...stream-ttl-seconds)`, `getInt(...download-ttl-seconds)` from `SettingsService`.
  The signing **secret stays in env** (`@Value`/`AppProperties` as today) — unchanged.

All reads are cache-backed, so no per-request DB round-trips on hot paths.

---

## 6. Initial Catalog (keys that move)

**Recommendations** (`dbworld.recommend`):
- `recommend.genre.enabled` (BOOLEAN)
- `recommend.genre.top-n` (INTEGER, min 1)
- `recommend.genre.min-engaged-records` (INTEGER, min 0)
- `recommend.genre.completion-threshold` (INTEGER, 0–100)
- `recommend.genre.cache-ttl-min` (INTEGER, min 0)
- `recommend.rewatch.enabled` (BOOLEAN)
- `recommend.rewatch.refresh-cron` (STRING; reschedule hook)
- `recommend.rewatch.window-days` (INTEGER, min 1)
- `recommend.rewatch.min-score` (INTEGER, min 0)
- `recommend.rewatch.top-n` (INTEGER, min 1)

**Tracking** (`dbworld.tracking`):
- `tracking.enabled` (BOOLEAN)
- `tracking.batch-tick-ms` (LONG, min 100)
- `tracking.max-bytes-per-tick` (LONG, min 0)
- `tracking.max-accumulator-entries` (INTEGER, min 0)
- `tracking.stream-timeout-min` (INTEGER, min 1)
- `tracking.download-timeout-min` (INTEGER, min 1)
- `tracking.sweeper-tick-ms` (LONG, min 1000)
- `tracking.event-retention-days` (INTEGER, min 1)
- `tracking.search-prefix-collapse-sec` (INTEGER, min 0)
- *Not moved:* `cdn-log-path`, `rotated-suffix` (infra paths — stay in YAML).

**Weather** (`weather.openweather`):
- `weather.openweather.cache-ttl-seconds` (INTEGER, min 0)
- *Not moved:* `base-url`, `api-key`.

**CDN signing** (`app.cdn.signing`):
- `app.cdn.signing.stream-ttl-seconds` (INTEGER, min 60)
- `app.cdn.signing.download-ttl-seconds` (INTEGER, min 60)
- `app.cdn.signing.enabled` (BOOLEAN) — UI warning: flipping this must be coordinated with the
  nginx `secure_link` directive per the documented rollout, or playback/downloads break.
- *Not moved:* `app.cdn.signing.secret` — stays in env (Tier 2, see §7).

**API docs** (`springdoc`):
- `springdoc.swagger-ui.enabled` (BOOLEAN, `requiresRestart=true`).

---

## 7. Secret Handling (`app.cdn.signing.secret`)

**Decision:** the signing secret stays in env (Tier 2) and is **not** moved to the DB/UI.
Putting a signing secret in a queryable table rendered in an admin UI is a security downgrade,
and the value changes rarely, so it does not justify the exposure. `CdnSigner` continues to
read the secret from env (`@Value`/`AppProperties`) exactly as today. Only the two TTLs and the
`enabled` toggle are moved to the settings surface. There are therefore **no `secret`-typed
keys** in v1, so no encryption/masking machinery is built (the `app_config` schema has no
`secret` column).

---

## 8. Admin API

Follows existing admin controller conventions (JWT-guarded admin routes):

- `GET /api/admin/config` → settings grouped by category:
  `[{ category, settings: [{ key, label, description, valueType, value, defaultValue,
  minValue, maxValue, requiresRestart, updatedAt, updatedBy }] }]`.
- `PUT /api/admin/config/{key}` `{ value }` → validate against `valueType` + bounds, save,
  refresh cache, fire change hook if any, set `updatedBy` from JWT. Returns the updated setting.
- `POST /api/admin/config/{key}/reset` → restore `default_value`, refresh cache, fire hook.

Validation errors return 400 with a message the UI surfaces.

---

## 9. Admin UI — Settings Page

New page in the admin sidebar at route **`/admin/settings`** ("Settings" nav item), built on the
AdminV2 stack per the project's consistency rule (TanStack Query, RHF + Zod, MUI, Notistack,
Framer Motion):

- Categories rendered as sections/accordion (Recommendations, Tracking, Weather, CDN, API Docs).
- Type-aware inputs: `Switch` (BOOLEAN), bounded number field (INTEGER/LONG with min/max),
  text field (STRING).
- Each row shows the label, description as helper text, current vs default, and a
  **reset-to-default** action.
- `requiresRestart` keys show a "takes effect after restart" chip; `cdn.signing.*` keys show
  the nginx-coordination warning.
- Dirty-state save per setting (or per category) with Notistack success/error toasts.
- TanStack Query invalidates the config query after a successful mutation.

---

## 10. Testing

- **Unit (`SettingsService`):** typed getters parse correctly; fallback to default on
  missing/blank/garbage; secret encrypt→decrypt round-trip; seeding is idempotent and never
  overwrites edited rows.
- **Unit (validation):** bounds + type validation reject bad `PUT` values.
- **Integration:** `PUT` → cache reflects new value → consumer reads it; `reset` restores
  default; `recommend.rewatch.refresh-cron` change re-arms the trigger; secret GET is masked.
- **Boot:** app starts with an empty `app_config` (fresh DB) — all consumers use registry
  defaults; seeding populates rows.

---

## 11. Rollout & Safety

- Ship registry + table + service + API + UI + consumer migration together on
  `feat/db-backed-app-config`.
- Remove migrated keys from the three YAML files in the same change (defaults now in registry).
- First boot seeds `app_config` from the registry defaults. The CDN signing secret stays in
  env, so signing is unaffected by this change.
- Backend build: JDK 25 + Maven wrapper (per project build notes); Hibernate `ddl-auto=update`
  creates the table automatically — no manual migration required.
- Fail-safe throughout: bad/missing values → defaults; seeding wrapped so DB issues can't block
  startup.

---

## 12. Resolved Decisions

1. **Secret posture:** `cdn.signing.secret` stays in env — not moved (§7).
2. **Settings page:** its own sidebar route `/admin/settings` (§9).
3. **Catalog:** the §6 set as listed (minus the signing secret) — no additional keys for v1.
