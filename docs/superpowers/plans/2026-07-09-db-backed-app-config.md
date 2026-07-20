# DB-Backed Runtime Config + Admin Settings Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Tier-3 runtime tuning knobs and feature flags out of the three YAML files into a generic `app_config` DB table, read through a cached typed `SettingsService`, and editable live (no restart) from a new admin **Settings** page at `/admin/settings`.

**Architecture:** Generalize the existing `scheduler_job_config` live-config pattern. A code-side `SettingsCatalog` (single source of truth for defaults + metadata) seeds an `app_config` table on startup. `SettingsService` caches values in memory, exposes fail-safe typed getters (missing/garbage → registry default, never throws), and refreshes the cache on write. Consumers read through the service instead of `@ConfigurationProperties`. One admin controller + one React page manage the values. Secrets and bootstrap/infra config stay in YAML/env.

**Tech Stack:** Spring Boot 4 (Java 25), Hibernate `ddl-auto=update` (MySQL, schema `db_world`), JUnit 5 + Mockito + AssertJ. Frontend: React + Vite, MUI 7, TanStack Query, Notistack, `axiosInstance`, `useT()` theme hook.

## Global Constraints

- **Maven wrapper (not on PATH):** `MVN="C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn"`
- **Backend build/test requires JDK 25** (default JAVA_HOME is 21). Prefix every Maven command: `JAVA_HOME="C:/Program Files/Java/jdk-25.0.3"`.
- **Backend commands run from** `db-world-backend/`. **Frontend commands run from** `db-world-frontend/`.
- **DB schema is `db_world`** — every `@Table` must set `schema = "db_world"` (matches `SchedulerJobConfigEntity`).
- **Admin endpoints** are annotated `@AdminAccess` (`com.db.dbworld.core.role.annotations.AdminAccess`) and return `com.db.dbworld.api.response.ApiResponse<T>` (`.success(data)` / `.success("msg")` / `.error(HttpStatus, "msg")`). Frontend unwraps `r.data?.data`.
- **Admin theme rule:** inside React components call `const T = useT();` in the body; never module-level. Sub-components get their own `useT()`.
- **New backend package:** `com.db.dbworld.app.admin.config`.
- **New frontend feature folder:** `db-world-frontend/src/features/admin/settings/`.
- **Fail-safe:** the `SettingsService` read path must never throw and seeding must never block boot (wrap in try/catch, log, fall back to defaults) — same posture as `SchedulerAdminService.relaxLegacyConstraints`.
- **Do not commit** the pre-existing unrelated working-tree changes (`App.jsx`, `constants/index.js`, `capacitor.config.json`, `PlayerDemo.jsx`, `.pyc`, `settings.local.json`, `launch.json`); stage only files each task names. (Note: `App.jsx` IS modified by Task 9 — stage it there.)

---

## File Structure

**Backend (new, under `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/`):**
- `entity/ConfigValueType.java` — enum `BOOLEAN|INTEGER|LONG|STRING` with `parse`/`isValid`.
- `entity/AppConfigEntity.java` — the `app_config` row.
- `repository/AppConfigRepository.java` — `JpaRepository<AppConfigEntity, String>`.
- `registry/ConfigKeys.java` — dotted-key string constants.
- `registry/SettingDefinition.java` — record: key, type, category, label, description, default, bounds, requiresRestart, displayOrder.
- `registry/SettingsCatalog.java` — `List<SettingDefinition> ALL` (the seeded catalog).
- `service/SettingsService.java` — seed + cache + typed getters + `listGrouped`/`update`/`reset`.
- `dto/SettingDto.java`, `dto/SettingCategoryDto.java` — API response shapes.
- `controller/AppConfigController.java` — `/api/admin/config`.

**Backend (modified):**
- `audit/activity/recommend/RewatchTrendService.java` — remove `@Scheduled`, read via `SettingsService`.
- `audit/activity/recommend/RewatchSchedulingConfig.java` — **new**, dynamic `CronTrigger`.
- `audit/activity/recommend/GenreAffinityService.java` — read via `SettingsService`.
- `audit/activity/recommend/RecommendProperties.java` — **deleted**.
- `audit/tracking/**` — 4 consumers read moved keys via `SettingsService`.
- `audit/tracking/config/TrackingProperties.java` — slimmed to `cdnLogPath` + `rotatedSuffix`.
- `app/weather/WeatherService.java` + `WeatherProperties.java` — cache-ttl via service; props slimmed to `baseUrl` + `apiKey`.
- `app/stream/service/CdnSigner.java` — `enabled` + TTLs via service; secret stays from `AppProperties`.
- `src/main/resources/application*.yml` — migrated keys removed.

**Frontend (new, under `db-world-frontend/src/features/admin/settings/`):**
- `api.js` — axios calls.
- `SettingsPanel.jsx` — the page.

**Frontend (modified):**
- `src/app/App.jsx` — lazy import + route.
- `src/features/admin/layout/AdminLayout.jsx` — nav item.

---

## Task 1: Config value type + entity + repository

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/entity/ConfigValueType.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/entity/AppConfigEntity.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/repository/AppConfigRepository.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/admin/config/entity/ConfigValueTypeTest.java`

**Interfaces:**
- Produces: `ConfigValueType` enum `{ BOOLEAN, INTEGER, LONG, STRING }` with `Object parse(String)` and `boolean isValid(String)`; `AppConfigEntity` (getters/setters via Lombok, id = `configKey`); `AppConfigRepository extends JpaRepository<AppConfigEntity, String>`.

- [ ] **Step 1: Write the failing test**

```java
package com.db.dbworld.app.admin.config.entity;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ConfigValueTypeTest {

    @Test
    void boolean_parsesTrueFalse_caseInsensitive() {
        assertThat(ConfigValueType.BOOLEAN.parse("true")).isEqualTo(Boolean.TRUE);
        assertThat(ConfigValueType.BOOLEAN.parse("FALSE")).isEqualTo(Boolean.FALSE);
        assertThat(ConfigValueType.BOOLEAN.isValid("true")).isTrue();
        assertThat(ConfigValueType.BOOLEAN.isValid("yes")).isFalse();
    }

    @Test
    void integer_parsesAndValidates() {
        assertThat(ConfigValueType.INTEGER.parse("42")).isEqualTo(42);
        assertThat(ConfigValueType.INTEGER.isValid("42")).isTrue();
        assertThat(ConfigValueType.INTEGER.isValid("4.2")).isFalse();
        assertThat(ConfigValueType.INTEGER.isValid("abc")).isFalse();
    }

    @Test
    void longs_parseAndValidate() {
        assertThat(ConfigValueType.LONG.parse("5242880")).isEqualTo(5242880L);
        assertThat(ConfigValueType.LONG.isValid("9999999999")).isTrue();
        assertThat(ConfigValueType.LONG.isValid("x")).isFalse();
    }

    @Test
    void string_acceptsAnything() {
        assertThat(ConfigValueType.STRING.parse("0 0 * * * *")).isEqualTo("0 0 * * * *");
        assertThat(ConfigValueType.STRING.isValid("")).isTrue();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=ConfigValueTypeTest -q`
Expected: FAIL — `ConfigValueType` does not exist (compilation error).

- [ ] **Step 3: Write the enum, entity, and repository**

`ConfigValueType.java`:
```java
package com.db.dbworld.app.admin.config.entity;

/** The storage/parse type of an {@link AppConfigEntity} value. */
public enum ConfigValueType {
    BOOLEAN, INTEGER, LONG, STRING;

    /** Parses {@code raw} to the Java type; assumes {@link #isValid} already passed. */
    public Object parse(String raw) {
        return switch (this) {
            case BOOLEAN -> Boolean.parseBoolean(raw);
            case INTEGER -> Integer.parseInt(raw.trim());
            case LONG    -> Long.parseLong(raw.trim());
            case STRING  -> raw;
        };
    }

    /** True when {@code raw} can be parsed as this type. STRING accepts anything (incl. null → false). */
    public boolean isValid(String raw) {
        if (raw == null) return this == STRING ? false : false;
        try {
            switch (this) {
                case BOOLEAN -> {
                    String v = raw.trim().toLowerCase();
                    return v.equals("true") || v.equals("false");
                }
                case INTEGER -> Integer.parseInt(raw.trim());
                case LONG    -> Long.parseLong(raw.trim());
                case STRING  -> { return true; }
            }
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
```

`AppConfigEntity.java`:
```java
package com.db.dbworld.app.admin.config.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One runtime-editable setting. Rows are seeded from {@code SettingsCatalog}
 * on startup and edited from the admin Settings page. The code-side catalog —
 * not this table — owns the set of known keys, their type, and defaults.
 */
@Entity
@Table(name = "app_config", schema = "db_world")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppConfigEntity {

    @Id
    @Column(name = "config_key", length = 150)
    private String configKey;

    @Column(name = "value", length = 1000)
    private String value;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_type", length = 20, nullable = false)
    private ConfigValueType valueType;

    @Column(name = "category", length = 60, nullable = false)
    private String category;

    @Column(name = "label", length = 150, nullable = false)
    private String label;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "default_value", length = 1000)
    private String defaultValue;

    @Column(name = "min_value")
    private Long minValue;

    @Column(name = "max_value")
    private Long maxValue;

    @Column(name = "requires_restart", nullable = false)
    @Builder.Default
    private boolean requiresRestart = false;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

`AppConfigRepository.java`:
```java
package com.db.dbworld.app.admin.config.repository;

import com.db.dbworld.app.admin.config.entity.AppConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppConfigRepository extends JpaRepository<AppConfigEntity, String> {
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=ConfigValueTypeTest -q`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/admin/config/entity/ConfigValueType.java \
        db-world-backend/src/main/java/com/db/dbworld/app/admin/config/entity/AppConfigEntity.java \
        db-world-backend/src/main/java/com/db/dbworld/app/admin/config/repository/AppConfigRepository.java \
        db-world-backend/src/test/java/com/db/dbworld/app/admin/config/entity/ConfigValueTypeTest.java
git commit -m "feat(config): app_config entity, value-type enum, repository"
```

---

## Task 2: Setting catalog (keys + definitions)

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/registry/ConfigKeys.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/registry/SettingDefinition.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/registry/SettingsCatalog.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/admin/config/registry/SettingsCatalogTest.java`

**Interfaces:**
- Consumes: `ConfigValueType` (Task 1).
- Produces: `ConfigKeys.*` String constants; `SettingDefinition` record `(String key, ConfigValueType type, String category, String label, String description, String defaultValue, Long minValue, Long maxValue, boolean requiresRestart, int displayOrder)`; `SettingsCatalog.ALL : List<SettingDefinition>` and `SettingsCatalog.byKey(String) : SettingDefinition`.

- [ ] **Step 1: Write the failing test**

```java
package com.db.dbworld.app.admin.config.registry;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class SettingsCatalogTest {

    @Test
    void allKeysAreUnique() {
        Set<String> seen = new HashSet<>();
        for (SettingDefinition d : SettingsCatalog.ALL) {
            assertThat(seen.add(d.key())).as("duplicate key %s", d.key()).isTrue();
        }
    }

    @Test
    void everyDefaultParsesUnderItsType() {
        for (SettingDefinition d : SettingsCatalog.ALL) {
            assertThat(d.type().isValid(d.defaultValue()))
                    .as("default '%s' invalid for %s (%s)", d.defaultValue(), d.key(), d.type())
                    .isTrue();
        }
    }

    @Test
    void numericBoundsAreConsistent() {
        for (SettingDefinition d : SettingsCatalog.ALL) {
            if (d.minValue() != null && d.maxValue() != null) {
                assertThat(d.minValue()).as("min<=max for %s", d.key()).isLessThanOrEqualTo(d.maxValue());
            }
        }
    }

    @Test
    void byKey_returnsDefinition_orNull() {
        assertThat(SettingsCatalog.byKey(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isNotNull();
        assertThat(SettingsCatalog.byKey("does.not.exist")).isNull();
    }

    @Test
    void catalogCoversExpectedKeyCount() {
        // 10 recommend + 9 tracking + 1 weather + 3 cdn + 1 swagger = 24
        assertThat(SettingsCatalog.ALL).hasSize(24);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=SettingsCatalogTest -q`
Expected: FAIL — `ConfigKeys`/`SettingsCatalog` do not exist.

- [ ] **Step 3: Write keys, definition, and catalog**

`ConfigKeys.java`:
```java
package com.db.dbworld.app.admin.config.registry;

/** Canonical dotted keys for every managed setting. Referenced by the catalog and consumers. */
public final class ConfigKeys {
    private ConfigKeys() {}

    // Recommendations
    public static final String RECOMMEND_GENRE_ENABLED              = "recommend.genre.enabled";
    public static final String RECOMMEND_GENRE_TOP_N                = "recommend.genre.top-n";
    public static final String RECOMMEND_GENRE_MIN_ENGAGED_RECORDS  = "recommend.genre.min-engaged-records";
    public static final String RECOMMEND_GENRE_COMPLETION_THRESHOLD = "recommend.genre.completion-threshold";
    public static final String RECOMMEND_GENRE_CACHE_TTL_MIN        = "recommend.genre.cache-ttl-min";
    public static final String RECOMMEND_REWATCH_ENABLED            = "recommend.rewatch.enabled";
    public static final String RECOMMEND_REWATCH_REFRESH_CRON       = "recommend.rewatch.refresh-cron";
    public static final String RECOMMEND_REWATCH_WINDOW_DAYS        = "recommend.rewatch.window-days";
    public static final String RECOMMEND_REWATCH_MIN_SCORE          = "recommend.rewatch.min-score";
    public static final String RECOMMEND_REWATCH_TOP_N              = "recommend.rewatch.top-n";

    // Tracking
    public static final String TRACKING_ENABLED                     = "tracking.enabled";
    public static final String TRACKING_BATCH_TICK_MS               = "tracking.batch-tick-ms";
    public static final String TRACKING_MAX_BYTES_PER_TICK          = "tracking.max-bytes-per-tick";
    public static final String TRACKING_MAX_ACCUMULATOR_ENTRIES     = "tracking.max-accumulator-entries";
    public static final String TRACKING_STREAM_TIMEOUT_MIN          = "tracking.stream-timeout-min";
    public static final String TRACKING_DOWNLOAD_TIMEOUT_MIN        = "tracking.download-timeout-min";
    public static final String TRACKING_SWEEPER_TICK_MS             = "tracking.sweeper-tick-ms";
    public static final String TRACKING_EVENT_RETENTION_DAYS        = "tracking.event-retention-days";
    public static final String TRACKING_SEARCH_PREFIX_COLLAPSE_SEC  = "tracking.search-prefix-collapse-sec";

    // Weather
    public static final String WEATHER_CACHE_TTL_SECONDS            = "weather.openweather.cache-ttl-seconds";

    // CDN signing (secret stays in env — NOT here)
    public static final String CDN_SIGNING_ENABLED                  = "app.cdn.signing.enabled";
    public static final String CDN_SIGNING_STREAM_TTL_SECONDS       = "app.cdn.signing.stream-ttl-seconds";
    public static final String CDN_SIGNING_DOWNLOAD_TTL_SECONDS     = "app.cdn.signing.download-ttl-seconds";

    // API docs (restart-required)
    public static final String SWAGGER_UI_ENABLED                   = "springdoc.swagger-ui.enabled";
}
```

`SettingDefinition.java`:
```java
package com.db.dbworld.app.admin.config.registry;

import com.db.dbworld.app.admin.config.entity.ConfigValueType;

/** Immutable declaration of one managed setting — the source of truth for defaults + metadata. */
public record SettingDefinition(
        String key,
        ConfigValueType type,
        String category,
        String label,
        String description,
        String defaultValue,
        Long minValue,
        Long maxValue,
        boolean requiresRestart,
        int displayOrder
) {
    // Convenience factories keep the catalog readable.
    static SettingDefinition bool(String key, String category, String label, String description,
                                  boolean def, int order) {
        return new SettingDefinition(key, ConfigValueType.BOOLEAN, category, label, description,
                String.valueOf(def), null, null, false, order);
    }
    static SettingDefinition intg(String key, String category, String label, String description,
                                  int def, Long min, Long max, int order) {
        return new SettingDefinition(key, ConfigValueType.INTEGER, category, label, description,
                String.valueOf(def), min, max, false, order);
    }
    static SettingDefinition lng(String key, String category, String label, String description,
                                 long def, Long min, Long max, int order) {
        return new SettingDefinition(key, ConfigValueType.LONG, category, label, description,
                String.valueOf(def), min, max, false, order);
    }
    static SettingDefinition str(String key, String category, String label, String description,
                                 String def, boolean requiresRestart, int order) {
        return new SettingDefinition(key, ConfigValueType.STRING, category, label, description,
                def, null, null, requiresRestart, order);
    }
}
```

`SettingsCatalog.java` (defaults copied verbatim from the current YAML / `@ConfigurationProperties` defaults):
```java
package com.db.dbworld.app.admin.config.registry;

import com.db.dbworld.app.admin.config.entity.ConfigValueType;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.db.dbworld.app.admin.config.registry.ConfigKeys.*;
import static com.db.dbworld.app.admin.config.registry.SettingDefinition.*;

/** The full set of runtime-editable settings, with defaults and UI metadata. */
public final class SettingsCatalog {
    private SettingsCatalog() {}

    private static final String C_RECOMMEND = "Recommendations";
    private static final String C_TRACKING  = "Activity Tracking";
    private static final String C_WEATHER   = "Weather";
    private static final String C_CDN       = "CDN Signing";
    private static final String C_DOCS      = "API Docs";

    public static final List<SettingDefinition> ALL = List.of(
        // ── Recommendations ──────────────────────────────────────────────
        bool(RECOMMEND_GENRE_ENABLED, C_RECOMMEND, "Genre rail enabled",
             "Show the personalised genre recommendation rail.", true, 0),
        intg(RECOMMEND_GENRE_TOP_N, C_RECOMMEND, "Genre top-N",
             "Number of top genres surveyed when picking the rail's genre.", 3, 1L, 20L, 1),
        intg(RECOMMEND_GENRE_MIN_ENGAGED_RECORDS, C_RECOMMEND, "Genre min engaged records",
             "Minimum engaged records before the rail is shown (cold-start guard).", 3, 0L, 100L, 2),
        intg(RECOMMEND_GENRE_COMPLETION_THRESHOLD, C_RECOMMEND, "Genre completion threshold %",
             "completion_percent (0-100) that counts a record as engaged.", 70, 0L, 100L, 3),
        intg(RECOMMEND_GENRE_CACHE_TTL_MIN, C_RECOMMEND, "Genre cache TTL (min)",
             "Per-user cache TTL for the picked genre.", 60, 0L, 1440L, 4),
        bool(RECOMMEND_REWATCH_ENABLED, C_RECOMMEND, "Rewatch rail enabled",
             "Show the 'Popular rewatches this week' rail.", true, 5),
        str(RECOMMEND_REWATCH_REFRESH_CRON, C_RECOMMEND, "Rewatch refresh cron",
             "Spring 6-field cron for recomputing the rewatch list.", "0 0 * * * *", false, 6),
        intg(RECOMMEND_REWATCH_WINDOW_DAYS, C_RECOMMEND, "Rewatch window (days)",
             "Lookback window for rewatch scoring.", 7, 1L, 365L, 7),
        intg(RECOMMEND_REWATCH_MIN_SCORE, C_RECOMMEND, "Rewatch min score",
             "Minimum (download+stream) sum for inclusion.", 3, 0L, 1000L, 8),
        intg(RECOMMEND_REWATCH_TOP_N, C_RECOMMEND, "Rewatch top-N",
             "Max records cached for the rail.", 30, 1L, 200L, 9),

        // ── Activity Tracking ────────────────────────────────────────────
        bool(TRACKING_ENABLED, C_TRACKING, "Tracking enabled",
             "Master flag — gates all live tracking writes.", true, 0),
        lng(TRACKING_BATCH_TICK_MS, C_TRACKING, "Batch tick (ms)",
             "How often the shipper flushes accumulated CDN log lines.", 5000L, 100L, 600000L, 1),
        lng(TRACKING_MAX_BYTES_PER_TICK, C_TRACKING, "Max bytes per tick",
             "Cap on CDN log bytes processed per tick.", 5242880L, 0L, 1073741824L, 2),
        intg(TRACKING_MAX_ACCUMULATOR_ENTRIES, C_TRACKING, "Max accumulator entries",
             "Cap on in-memory accumulator entries per tick.", 10000, 0L, 1000000L, 3),
        intg(TRACKING_STREAM_TIMEOUT_MIN, C_TRACKING, "Stream session timeout (min)",
             "Idle minutes before a stream session is swept closed.", 15, 1L, 1440L, 4),
        intg(TRACKING_DOWNLOAD_TIMEOUT_MIN, C_TRACKING, "Download session timeout (min)",
             "Idle minutes before a download session is swept closed.", 30, 1L, 2880L, 5),
        lng(TRACKING_SWEEPER_TICK_MS, C_TRACKING, "Sweeper tick (ms)",
             "How often the staleness sweeper runs.", 60000L, 1000L, 3600000L, 6),
        intg(TRACKING_EVENT_RETENTION_DAYS, C_TRACKING, "Event retention (days)",
             "How long activity events are kept before pruning.", 90, 1L, 3650L, 7),
        intg(TRACKING_SEARCH_PREFIX_COLLAPSE_SEC, C_TRACKING, "Search prefix collapse (sec)",
             "Collapse prefix-chain searches typed within this window.", 30, 0L, 3600L, 8),

        // ── Weather ──────────────────────────────────────────────────────
        intg(WEATHER_CACHE_TTL_SECONDS, C_WEATHER, "Weather cache TTL (sec)",
             "Cache TTL for OpenWeather responses.", 300, 0L, 86400L, 0),

        // ── CDN Signing ──────────────────────────────────────────────────
        bool(CDN_SIGNING_ENABLED, C_CDN, "CDN signing enabled",
             "WARNING: flipping this must be coordinated with the nginx secure_link "
             + "directive or playback/downloads break.", true, 0),
        intg(CDN_SIGNING_STREAM_TTL_SECONDS, C_CDN, "Stream URL TTL (sec)",
             "How long a signed streaming URL stays valid (covers a watch session).",
             21600, 60L, 604800L, 1),
        intg(CDN_SIGNING_DOWNLOAD_TTL_SECONDS, C_CDN, "Download URL TTL (sec)",
             "How long a signed download URL stays valid (copy-paste + resumed transfers).",
             172800, 60L, 2592000L, 2),

        // ── API Docs ─────────────────────────────────────────────────────
        bool(SWAGGER_UI_ENABLED, C_DOCS, "Swagger UI enabled (restart required)",
             "Enable the /docs Swagger UI. springdoc binds this at startup, so a "
             + "change only takes effect after a restart.", false,
             // requiresRestart flag set below via a dedicated definition:
             0)
    );

    // Swagger needs requiresRestart=true; bool() can't set it, so patch it here.
    static {
        // no-op placeholder to document intent; see note below.
    }

    private static final Map<String, SettingDefinition> BY_KEY =
            ALL.stream().collect(Collectors.toMap(SettingDefinition::key, Function.identity()));

    public static SettingDefinition byKey(String key) {
        return BY_KEY.get(key);
    }
}
```

> **Note for the implementer:** `bool(...)` always sets `requiresRestart=false`. The swagger entry needs `requiresRestart=true`, so replace its `bool(SWAGGER_UI_ENABLED, ...)` call with a direct constructor:
> ```java
> new SettingDefinition(SWAGGER_UI_ENABLED, ConfigValueType.BOOLEAN, C_DOCS,
>     "Swagger UI enabled (restart required)",
>     "Enable the /docs Swagger UI. springdoc binds this at startup, so a change only takes effect after a restart.",
>     "false", null, null, true, 0)
> ```
> and delete the empty `static {}` block.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=SettingsCatalogTest -q`
Expected: PASS (5 tests). If `catalogCoversExpectedKeyCount` fails, re-count the `ALL` entries — must be exactly 24.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/admin/config/registry/ \
        db-world-backend/src/test/java/com/db/dbworld/app/admin/config/registry/SettingsCatalogTest.java
git commit -m "feat(config): setting keys, definitions, and seed catalog"
```

---

## Task 3: SettingsService (seed + cache + typed getters + update/reset)

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/service/SettingsService.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/admin/config/service/SettingsServiceTest.java`

**Interfaces:**
- Consumes: `AppConfigRepository`, `AppConfigEntity`, `ConfigValueType` (Task 1); `SettingsCatalog`, `SettingDefinition`, `ConfigKeys` (Task 2).
- Produces:
  - `boolean getBoolean(String key)`, `int getInt(String key)`, `long getLong(String key)`, `String getString(String key)`
  - `List<AppConfigEntity> findAllOrdered()`
  - `AppConfigEntity update(String key, String rawValue, String updatedBy)` — validates type + bounds, persists, refreshes cache; throws `IllegalArgumentException` on unknown key / invalid value / out of bounds.
  - `AppConfigEntity reset(String key, String updatedBy)` — restores catalog default.

- [ ] **Step 1: Write the failing test**

```java
package com.db.dbworld.app.admin.config.service;

import com.db.dbworld.app.admin.config.entity.AppConfigEntity;
import com.db.dbworld.app.admin.config.entity.ConfigValueType;
import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.repository.AppConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SettingsServiceTest {

    AppConfigRepository repo;
    SettingsService service;
    Map<String, AppConfigEntity> store;

    @BeforeEach
    void setUp() {
        repo = mock(AppConfigRepository.class);
        store = new HashMap<>();
        when(repo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(repo.findAll()).thenAnswer(a -> new ArrayList<>(store.values()));
        when(repo.existsById(any())).thenAnswer(a -> store.containsKey(a.getArgument(0)));
        when(repo.save(any(AppConfigEntity.class))).thenAnswer(a -> {
            AppConfigEntity e = a.getArgument(0);
            store.put(e.getConfigKey(), e);
            return e;
        });
        service = new SettingsService(repo);
        service.init(); // seeds + loads cache
    }

    @Test
    void seed_populatesCatalogRows_idempotently() {
        int after1 = store.size();
        service.init(); // run again
        assertThat(store.size()).isEqualTo(after1);
        assertThat(after1).isEqualTo(24);
    }

    @Test
    void getInt_returnsSeededDefault() {
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(3);
    }

    @Test
    void getBoolean_returnsSeededDefault() {
        assertThat(service.getBoolean(ConfigKeys.CDN_SIGNING_ENABLED)).isTrue();
        assertThat(service.getBoolean(ConfigKeys.SWAGGER_UI_ENABLED)).isFalse();
    }

    @Test
    void getInt_missingKey_fallsBackToCatalogDefault() {
        store.clear();          // simulate empty table
        service.reloadCache();  // cache now empty
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(3);
    }

    @Test
    void getInt_garbageValue_fallsBackToDefault_neverThrows() {
        AppConfigEntity row = store.get(ConfigKeys.RECOMMEND_GENRE_TOP_N);
        row.setValue("not-a-number");
        service.reloadCache();
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(3);
    }

    @Test
    void update_persistsAndRefreshesCache() {
        service.update(ConfigKeys.RECOMMEND_GENRE_TOP_N, "7", "tester");
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(7);
        assertThat(store.get(ConfigKeys.RECOMMEND_GENRE_TOP_N).getUpdatedBy()).isEqualTo("tester");
    }

    @Test
    void update_rejectsWrongType() {
        assertThatThrownBy(() -> service.update(ConfigKeys.RECOMMEND_GENRE_TOP_N, "abc", "t"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void update_rejectsOutOfBounds() {
        assertThatThrownBy(() -> service.update(ConfigKeys.RECOMMEND_GENRE_COMPLETION_THRESHOLD, "150", "t"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void update_rejectsUnknownKey() {
        assertThatThrownBy(() -> service.update("no.such.key", "1", "t"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reset_restoresDefault() {
        service.update(ConfigKeys.RECOMMEND_GENRE_TOP_N, "7", "t");
        service.reset(ConfigKeys.RECOMMEND_GENRE_TOP_N, "t");
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(3);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=SettingsServiceTest -q`
Expected: FAIL — `SettingsService` does not exist.

- [ ] **Step 3: Write the service**

```java
package com.db.dbworld.app.admin.config.service;

import com.db.dbworld.app.admin.config.entity.AppConfigEntity;
import com.db.dbworld.app.admin.config.entity.ConfigValueType;
import com.db.dbworld.app.admin.config.registry.SettingDefinition;
import com.db.dbworld.app.admin.config.registry.SettingsCatalog;
import com.db.dbworld.app.admin.config.repository.AppConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Reads and writes runtime-editable settings backed by {@code app_config}.
 * Values are cached in memory and refreshed on every write, so consumers pay
 * no per-read DB cost. Every read is fail-safe: a missing or unparseable value
 * falls back to the {@link SettingsCatalog} default and never throws.
 *
 * <p>Generalises the {@code scheduler_job_config} live-config pattern.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SettingsService {

    private final AppConfigRepository repo;

    /** key → raw string value. */
    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        seedDefaults();
        reloadCache();
    }

    /** Idempotently insert any catalog row that doesn't exist yet. Never overwrites edits. */
    @Transactional
    public void seedDefaults() {
        try {
            for (SettingDefinition d : SettingsCatalog.ALL) {
                if (!repo.existsById(d.key())) {
                    repo.save(AppConfigEntity.builder()
                            .configKey(d.key())
                            .value(d.defaultValue())
                            .valueType(d.type())
                            .category(d.category())
                            .label(d.label())
                            .description(d.description())
                            .defaultValue(d.defaultValue())
                            .minValue(d.minValue())
                            .maxValue(d.maxValue())
                            .requiresRestart(d.requiresRestart())
                            .displayOrder(d.displayOrder())
                            .updatedAt(LocalDateTime.now())
                            .build());
                    log.info("Seeded app_config key '{}'", d.key());
                }
            }
        } catch (Exception e) {
            // Never block boot on a DB hiccup — consumers use catalog defaults meanwhile.
            log.warn("app_config seeding skipped/failed: {}", e.getMessage());
        }
    }

    /** Reloads the whole cache from the DB. */
    public void reloadCache() {
        try {
            var fresh = new ConcurrentHashMap<String, String>();
            repo.findAll().forEach(e -> {
                if (e.getValue() != null) fresh.put(e.getConfigKey(), e.getValue());
            });
            cache.clear();
            cache.putAll(fresh);
        } catch (Exception e) {
            log.warn("app_config cache reload failed (keeping previous cache): {}", e.getMessage());
        }
    }

    // ── Typed reads (fail-safe) ────────────────────────────────────────────────

    public boolean getBoolean(String key) {
        String raw = cache.get(key);
        SettingDefinition def = SettingsCatalog.byKey(key);
        if (raw == null || !ConfigValueType.BOOLEAN.isValid(raw)) {
            return def != null && Boolean.parseBoolean(def.defaultValue());
        }
        return Boolean.parseBoolean(raw.trim());
    }

    public int getInt(String key) {
        String raw = cache.get(key);
        SettingDefinition def = SettingsCatalog.byKey(key);
        int fallback = def != null ? Integer.parseInt(def.defaultValue()) : 0;
        if (raw == null || !ConfigValueType.INTEGER.isValid(raw)) {
            if (raw != null) log.warn("app_config '{}' value '{}' not an int — using default {}", key, raw, fallback);
            return fallback;
        }
        return Integer.parseInt(raw.trim());
    }

    public long getLong(String key) {
        String raw = cache.get(key);
        SettingDefinition def = SettingsCatalog.byKey(key);
        long fallback = def != null ? Long.parseLong(def.defaultValue()) : 0L;
        if (raw == null || !ConfigValueType.LONG.isValid(raw)) {
            if (raw != null) log.warn("app_config '{}' value '{}' not a long — using default {}", key, raw, fallback);
            return fallback;
        }
        return Long.parseLong(raw.trim());
    }

    public String getString(String key) {
        String raw = cache.get(key);
        if (raw != null) return raw;
        SettingDefinition def = SettingsCatalog.byKey(key);
        return def != null ? def.defaultValue() : null;
    }

    // ── Admin queries + mutations ──────────────────────────────────────────────

    public List<AppConfigEntity> findAllOrdered() {
        return repo.findAll().stream()
                .sorted(Comparator.comparing(AppConfigEntity::getCategory)
                        .thenComparingInt(AppConfigEntity::getDisplayOrder))
                .toList();
    }

    @Transactional
    public AppConfigEntity update(String key, String rawValue, String updatedBy) {
        SettingDefinition def = SettingsCatalog.byKey(key);
        if (def == null) throw new IllegalArgumentException("Unknown config key: " + key);
        if (rawValue == null) throw new IllegalArgumentException("value is required");
        if (!def.type().isValid(rawValue)) {
            throw new IllegalArgumentException("Value '" + rawValue + "' is not a valid " + def.type());
        }
        if (def.type() == ConfigValueType.INTEGER || def.type() == ConfigValueType.LONG) {
            long n = Long.parseLong(rawValue.trim());
            if (def.minValue() != null && n < def.minValue())
                throw new IllegalArgumentException(key + " must be >= " + def.minValue());
            if (def.maxValue() != null && n > def.maxValue())
                throw new IllegalArgumentException(key + " must be <= " + def.maxValue());
        }
        AppConfigEntity e = repo.findById(key).orElseGet(() -> seedRow(def));
        e.setValue(rawValue);
        e.setUpdatedBy(updatedBy);
        e.setUpdatedAt(LocalDateTime.now());
        repo.save(e);
        cache.put(key, rawValue);
        log.info("app_config '{}' updated to '{}' by {}", key, rawValue, updatedBy);
        return e;
    }

    @Transactional
    public AppConfigEntity reset(String key, String updatedBy) {
        SettingDefinition def = SettingsCatalog.byKey(key);
        if (def == null) throw new IllegalArgumentException("Unknown config key: " + key);
        return update(key, def.defaultValue(), updatedBy);
    }

    private AppConfigEntity seedRow(SettingDefinition d) {
        return AppConfigEntity.builder()
                .configKey(d.key()).value(d.defaultValue()).valueType(d.type())
                .category(d.category()).label(d.label()).description(d.description())
                .defaultValue(d.defaultValue()).minValue(d.minValue()).maxValue(d.maxValue())
                .requiresRestart(d.requiresRestart()).displayOrder(d.displayOrder())
                .build();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=SettingsServiceTest -q`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/admin/config/service/SettingsService.java \
        db-world-backend/src/test/java/com/db/dbworld/app/admin/config/service/SettingsServiceTest.java
git commit -m "feat(config): SettingsService with cache, fail-safe getters, validated update/reset"
```

---

## Task 4: Admin config API (controller + DTOs)

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/dto/SettingDto.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/dto/SettingCategoryDto.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/app/admin/config/controller/AppConfigController.java`
- Modify: `SettingsService.java` — add `List<SettingCategoryDto> listGrouped()`.
- Test: `db-world-backend/src/test/java/com/db/dbworld/app/admin/config/service/SettingsServiceGroupingTest.java`

**Interfaces:**
- Consumes: `SettingsService` (Task 3).
- Produces: `SettingDto`, `SettingCategoryDto`; `SettingsService.listGrouped() : List<SettingCategoryDto>`; REST endpoints `GET /api/admin/config`, `PUT /api/admin/config/{key}`, `POST /api/admin/config/{key}/reset`.

- [ ] **Step 1: Write the failing test**

```java
package com.db.dbworld.app.admin.config.service;

import com.db.dbworld.app.admin.config.dto.SettingCategoryDto;
import com.db.dbworld.app.admin.config.entity.AppConfigEntity;
import com.db.dbworld.app.admin.config.repository.AppConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SettingsServiceGroupingTest {

    SettingsService service;

    @BeforeEach
    void setUp() {
        AppConfigRepository repo = mock(AppConfigRepository.class);
        Map<String, AppConfigEntity> store = new HashMap<>();
        when(repo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(repo.findAll()).thenAnswer(a -> new ArrayList<>(store.values()));
        when(repo.existsById(any())).thenAnswer(a -> store.containsKey(a.getArgument(0)));
        when(repo.save(any(AppConfigEntity.class))).thenAnswer(a -> {
            AppConfigEntity e = a.getArgument(0); store.put(e.getConfigKey(), e); return e;
        });
        service = new SettingsService(repo);
        service.init();
    }

    @Test
    void listGrouped_groupsByCategory_andOrders() {
        List<SettingCategoryDto> groups = service.listGrouped();
        assertThat(groups).extracting(SettingCategoryDto::category)
                .contains("Recommendations", "Activity Tracking", "Weather", "CDN Signing", "API Docs");
        // within a category, settings are ordered by displayOrder
        SettingCategoryDto rec = groups.stream()
                .filter(g -> g.category().equals("Recommendations")).findFirst().orElseThrow();
        assertThat(rec.settings().get(0).key()).isEqualTo("recommend.genre.enabled");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=SettingsServiceGroupingTest -q`
Expected: FAIL — `listGrouped`/DTOs missing.

- [ ] **Step 3: Add DTOs, `listGrouped`, and the controller**

`SettingDto.java`:
```java
package com.db.dbworld.app.admin.config.dto;

public record SettingDto(
        String key,
        String label,
        String description,
        String valueType,
        String value,
        String defaultValue,
        Long minValue,
        Long maxValue,
        boolean requiresRestart,
        String updatedAt,
        String updatedBy
) {}
```

`SettingCategoryDto.java`:
```java
package com.db.dbworld.app.admin.config.dto;

import java.util.List;

public record SettingCategoryDto(String category, List<SettingDto> settings) {}
```

Add to `SettingsService` (imports: `com.db.dbworld.app.admin.config.dto.*`, `java.util.*`, `java.util.stream.Collectors`):
```java
    public List<SettingCategoryDto> listGrouped() {
        Map<String, List<SettingDto>> byCat = new LinkedHashMap<>();
        for (AppConfigEntity e : findAllOrdered()) {
            byCat.computeIfAbsent(e.getCategory(), k -> new ArrayList<>()).add(toDto(e));
        }
        return byCat.entrySet().stream()
                .map(en -> new SettingCategoryDto(en.getKey(), en.getValue()))
                .toList();
    }

    public SettingDto toDto(AppConfigEntity e) {
        return new SettingDto(
                e.getConfigKey(), e.getLabel(), e.getDescription(),
                e.getValueType().name(), e.getValue(), e.getDefaultValue(),
                e.getMinValue(), e.getMaxValue(), e.isRequiresRestart(),
                e.getUpdatedAt() != null ? e.getUpdatedAt().toString() : null,
                e.getUpdatedBy());
    }
```

`AppConfigController.java`:
```java
package com.db.dbworld.app.admin.config.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.admin.config.dto.SettingCategoryDto;
import com.db.dbworld.app.admin.config.dto.SettingDto;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/admin/config")
@RequiredArgsConstructor
public class AppConfigController {

    private final SettingsService settingsService;

    @GetMapping
    @AdminAccess
    public ApiResponse<List<SettingCategoryDto>> list() {
        return ApiResponse.success(settingsService.listGrouped());
    }

    @PutMapping("/{key}")
    @AdminAccess
    public ApiResponse<SettingDto> update(@PathVariable String key,
                                          @RequestBody Map<String, String> body) {
        String value = body.get("value");
        try {
            var updated = settingsService.update(key, value, currentUser());
            return ApiResponse.success(settingsService.toDto(updated));
        } catch (IllegalArgumentException ex) {
            log.warn("Config update rejected for {}: {}", key, ex.getMessage());
            return ApiResponse.error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @PostMapping("/{key}/reset")
    @AdminAccess
    public ApiResponse<SettingDto> reset(@PathVariable String key) {
        try {
            var reset = settingsService.reset(key, currentUser());
            return ApiResponse.success(settingsService.toDto(reset));
        } catch (IllegalArgumentException ex) {
            return ApiResponse.error(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    /** Best-effort current username for the audit column. */
    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.getName() != null) ? auth.getName() : "admin";
    }
}
```

> If `ApiResponse.error(HttpStatus, String)` or `ApiResponse.success(T)` signatures differ from what `SchedulerAdminController` uses, match that controller exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=SettingsServiceGroupingTest -q`
Expected: PASS. Then compile-check the controller: `JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" -o compile -q` → BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/admin/config/dto/ \
        db-world-backend/src/main/java/com/db/dbworld/app/admin/config/controller/AppConfigController.java \
        db-world-backend/src/main/java/com/db/dbworld/app/admin/config/service/SettingsService.java \
        db-world-backend/src/test/java/com/db/dbworld/app/admin/config/service/SettingsServiceGroupingTest.java
git commit -m "feat(config): admin config REST API (list/update/reset) + grouped DTOs"
```

---

## Task 5: Migrate recommendation consumers + live rewatch cron

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/recommend/RewatchTrendService.java`
- Create: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/recommend/RewatchSchedulingConfig.java`
- Modify: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/recommend/GenreAffinityService.java`
- Delete: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/recommend/RecommendProperties.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/audit/activity/recommend/RewatchTrendServiceTest.java`

**Interfaces:**
- Consumes: `SettingsService` (Task 3), `ConfigKeys` (Task 2).

**Key → getter mapping (apply mechanically):**
| Old call | New call |
|---|---|
| `props.getGenre().isEnabled()` | `settings.getBoolean(ConfigKeys.RECOMMEND_GENRE_ENABLED)` |
| `props.getGenre().getTopN()` | `settings.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)` |
| `props.getGenre().getMinEngagedRecords()` | `settings.getInt(ConfigKeys.RECOMMEND_GENRE_MIN_ENGAGED_RECORDS)` |
| `props.getGenre().getCompletionThreshold()` | `settings.getInt(ConfigKeys.RECOMMEND_GENRE_COMPLETION_THRESHOLD)` |
| `props.getGenre().getCacheTtlMin()` | `settings.getInt(ConfigKeys.RECOMMEND_GENRE_CACHE_TTL_MIN)` |
| `props.getRewatch().isEnabled()` | `settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)` |
| `props.getRewatch().getWindowDays()` | `settings.getInt(ConfigKeys.RECOMMEND_REWATCH_WINDOW_DAYS)` |
| `props.getRewatch().getMinScore()` | `settings.getInt(ConfigKeys.RECOMMEND_REWATCH_MIN_SCORE)` |
| `props.getRewatch().getTopN()` | `settings.getInt(ConfigKeys.RECOMMEND_REWATCH_TOP_N)` |

- [ ] **Step 1: Write the failing test** (`RewatchTrendServiceTest.java`)

```java
package com.db.dbworld.audit.activity.recommend;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RewatchTrendServiceTest {

    @Test
    void refresh_readsKnobsFromSettings_andCachesResult() {
        SettingsService settings = mock(SettingsService.class);
        ActivitySessionRepository sessions = mock(ActivitySessionRepository.class);
        when(settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)).thenReturn(true);
        when(settings.getInt(ConfigKeys.RECOMMEND_REWATCH_WINDOW_DAYS)).thenReturn(7);
        when(settings.getInt(ConfigKeys.RECOMMEND_REWATCH_MIN_SCORE)).thenReturn(3);
        when(settings.getInt(ConfigKeys.RECOMMEND_REWATCH_TOP_N)).thenReturn(30);
        when(sessions.findTopRewatchedRecordIds(7, 3, 30)).thenReturn(List.of(5L, 9L));

        RewatchTrendService svc = new RewatchTrendService(settings, sessions);
        svc.refresh();

        assertThat(svc.snapshot()).containsExactly(5L, 9L);
    }

    @Test
    void refresh_whenDisabled_isNoOp() {
        SettingsService settings = mock(SettingsService.class);
        ActivitySessionRepository sessions = mock(ActivitySessionRepository.class);
        when(settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)).thenReturn(false);

        RewatchTrendService svc = new RewatchTrendService(settings, sessions);
        svc.refresh();

        verifyNoInteractions(sessions);
        assertThat(svc.snapshot()).isEmpty();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=RewatchTrendServiceTest -q`
Expected: FAIL — constructor still takes `RecommendProperties`.

- [ ] **Step 3: Rewrite `RewatchTrendService`, add scheduling config, migrate `GenreAffinityService`, delete `RecommendProperties`**

New `RewatchTrendService.java`:
```java
package com.db.dbworld.audit.activity.recommend;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.List;

/** Maintains the site-wide "Popular rewatches this week" record IDs. */
@Log4j2
@Service
@RequiredArgsConstructor
public class RewatchTrendService {

    private final SettingsService           settings;
    private final ActivitySessionRepository activitySessionRepository;

    private volatile List<Long> topRecordIds = List.of();

    @PostConstruct
    void warmOnStartup() {
        if (!settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)) return;
        try {
            refresh();
        } catch (Exception ex) {
            log.warn("RewatchTrendService: initial warmup failed, will retry on schedule", ex);
        }
    }

    /** Invoked by {@link RewatchSchedulingConfig} on the live cron schedule. */
    public void refresh() {
        if (!settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)) return;
        int windowDays = settings.getInt(ConfigKeys.RECOMMEND_REWATCH_WINDOW_DAYS);
        int minScore   = settings.getInt(ConfigKeys.RECOMMEND_REWATCH_MIN_SCORE);
        int topN       = settings.getInt(ConfigKeys.RECOMMEND_REWATCH_TOP_N);
        topRecordIds = List.copyOf(
                activitySessionRepository.findTopRewatchedRecordIds(windowDays, minScore, topN));
        log.info("RewatchTrendService: refreshed top rewatches → {} records (windowDays={}, minScore={})",
                topRecordIds.size(), windowDays, minScore);
    }

    public List<Long> snapshot() { return topRecordIds; }
}
```

New `RewatchSchedulingConfig.java` (dynamic cron read live from settings — mirrors `MediaSyncSchedulingConfig`):
```java
package com.db.dbworld.audit.activity.recommend;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;
import org.springframework.scheduling.support.CronTrigger;

import java.time.Instant;

/**
 * Runs {@link RewatchTrendService#refresh()} on the cron stored at
 * {@code recommend.rewatch.refresh-cron}. A fresh {@link CronTrigger} is built
 * from the live setting on every scheduling decision, so editing the cron in
 * the admin Settings page takes effect on the next fire — no restart.
 */
@Configuration
@EnableScheduling
@RequiredArgsConstructor
@Log4j2
public class RewatchSchedulingConfig implements SchedulingConfigurer {

    private static final String DEFAULT_CRON = "0 0 * * * *";

    private final RewatchTrendService rewatchTrendService;
    private final SettingsService     settings;

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.addTriggerTask(rewatchTrendService::refresh, this::nextExecution);
        log.info("Rewatch refresh scheduling registered (trigger-driven; reads cron from app_config)");
    }

    private Instant nextExecution(org.springframework.scheduling.TriggerContext ctx) {
        String cron = settings.getString(ConfigKeys.RECOMMEND_REWATCH_REFRESH_CRON);
        try {
            return new CronTrigger(cron).nextExecution(ctx);
        } catch (Exception e) {
            log.warn("Invalid rewatch cron '{}' — falling back to default '{}': {}",
                    cron, DEFAULT_CRON, e.getMessage());
            return new CronTrigger(DEFAULT_CRON).nextExecution(ctx);
        }
    }
}
```

For `GenreAffinityService.java`: read it, replace the injected `RecommendProperties props` field with `SettingsService settings` (add import `com.db.dbworld.app.admin.config.service.SettingsService` and `...registry.ConfigKeys`), and swap each `props.getGenre().*` call per the mapping table above. Update the Javadoc reference to `RecommendProperties.Genre#getCacheTtlMin` to name the key `recommend.genre.cache-ttl-min` instead.

Delete `RecommendProperties.java`.

- [ ] **Step 4: Run test + compile**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=RewatchTrendServiceTest -q`
Expected: PASS (2). Then `JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" -o compile -q` → BUILD SUCCESS (confirms `GenreAffinityService` + deletion compile; if any other file referenced `RecommendProperties`, the compiler names it — fix by the same mapping).

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/activity/recommend/ \
        db-world-backend/src/test/java/com/db/dbworld/audit/activity/recommend/RewatchTrendServiceTest.java
git rm db-world-backend/src/main/java/com/db/dbworld/audit/activity/recommend/RecommendProperties.java
git commit -m "refactor(recommend): read knobs from SettingsService; live rewatch cron via trigger"
```

---

## Task 6: Migrate tracking consumers + slim TrackingProperties

**Files:**
- Modify: `audit/tracking/config/TrackingProperties.java` (slim to `cdnLogPath` + `rotatedSuffix`)
- Modify: `audit/tracking/sweeper/TrackingSweeper.java`, `audit/tracking/shipper/TrackingLogShipper.java`, `audit/tracking/search/SearchHistoryService.java`, `audit/tracking/ingest/TrackingIngestService.java`
- Modify test: `db-world-backend/src/test/java/com/db/dbworld/audit/tracking/search/SearchHistoryServiceTest.java`

**Interfaces:**
- Consumes: `SettingsService`, `ConfigKeys`.

**Key → getter mapping:**
| Old call | New call |
|---|---|
| `props.isEnabled()` (tracking) | `settings.getBoolean(ConfigKeys.TRACKING_ENABLED)` |
| `props.getBatchTickMs()` | `settings.getLong(ConfigKeys.TRACKING_BATCH_TICK_MS)` |
| `props.getMaxBytesPerTick()` | `settings.getLong(ConfigKeys.TRACKING_MAX_BYTES_PER_TICK)` |
| `props.getMaxAccumulatorEntries()` | `settings.getInt(ConfigKeys.TRACKING_MAX_ACCUMULATOR_ENTRIES)` |
| `props.getStreamTimeoutMin()` | `settings.getInt(ConfigKeys.TRACKING_STREAM_TIMEOUT_MIN)` |
| `props.getDownloadTimeoutMin()` | `settings.getInt(ConfigKeys.TRACKING_DOWNLOAD_TIMEOUT_MIN)` |
| `props.getSweeperTickMs()` | `settings.getLong(ConfigKeys.TRACKING_SWEEPER_TICK_MS)` |
| `props.getEventRetentionDays()` | `settings.getInt(ConfigKeys.TRACKING_EVENT_RETENTION_DAYS)` |
| `props.getSearchPrefixCollapseSec()` | `settings.getInt(ConfigKeys.TRACKING_SEARCH_PREFIX_COLLAPSE_SEC)` |
| `props.getCdnLogPath()` | **unchanged** — stays on `TrackingProperties` |
| `props.getRotatedSuffix()` | **unchanged** — stays on `TrackingProperties` |

> **Scheduling caveat:** if `TrackingSweeper` / `TrackingLogShipper` schedule via `@Scheduled(fixedDelayString = "${dbworld.tracking.sweeper-tick-ms}")` or `${...batch-tick-ms}`, those annotation values bind at startup and are removed from YAML in Task 8. When you open each file: if a tick is used **only** inside the method body, just swap to the getter. If it's in a `@Scheduled(fixedDelayString=...)` annotation, replace the literal with a hardcoded fallback equal to the catalog default (e.g. `fixedDelay = 5000`) and read the live value inside the method for any runtime decision, OR convert to a `SchedulingConfigurer` mirroring `RewatchSchedulingConfig`. Note in the commit which approach you used per file. (Live re-tick is a nice-to-have; correctness — not crashing on a removed placeholder — is the requirement.)

- [ ] **Step 1: Update the failing test** (`SearchHistoryServiceTest.java`)

Replace the `TrackingProperties` mock with a `SettingsService` mock. Change the field and `setUp`:
```java
import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
// remove: import com.db.dbworld.audit.tracking.config.TrackingProperties;

    @Mock SearchHistoryRepository repository;
    @Mock SettingsService settings;

    SearchHistoryService service;

    @BeforeEach
    void setUp() {
        service = new SearchHistoryService(repository, settings);
    }
```
Then in each test replace `when(trackingProperties.getSearchPrefixCollapseSec()).thenReturn(30);` with
`when(settings.getInt(ConfigKeys.TRACKING_SEARCH_PREFIX_COLLAPSE_SEC)).thenReturn(30);`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=SearchHistoryServiceTest -q`
Expected: FAIL — `SearchHistoryService` constructor still takes `TrackingProperties`.

- [ ] **Step 3: Migrate the four consumers and slim `TrackingProperties`**

In each of `SearchHistoryService`, `TrackingSweeper`, `TrackingLogShipper`, `TrackingIngestService`: read the file, add imports for `SettingsService` + `ConfigKeys`, replace the `TrackingProperties props` (or `trackingProperties`) constructor field with `SettingsService settings` **unless** the class also uses `getCdnLogPath()`/`getRotatedSuffix()` — in that case keep BOTH fields (`TrackingProperties props` for the two path values, `SettingsService settings` for the rest). Apply the mapping table.

Slim `TrackingProperties.java` to:
```java
package com.db.dbworld.audit.tracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Startup-bound tracking paths that stay in YAML (infra, not runtime knobs). */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "dbworld.tracking")
public class TrackingProperties {
    /** nginx CDN access log the shipper tails. */
    private String cdnLogPath = "/app/db_world/logs/nginx/cdn_access.log";
    private String rotatedSuffix = ".1";
}
```

- [ ] **Step 4: Run test + compile**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=SearchHistoryServiceTest -q`
Expected: PASS. Then `JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" -o compile -q` → BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/
git add db-world-backend/src/test/java/com/db/dbworld/audit/tracking/search/SearchHistoryServiceTest.java
git commit -m "refactor(tracking): read runtime knobs from SettingsService; slim TrackingProperties to paths"
```

---

## Task 7: Migrate weather + CDN signing consumers

**Files:**
- Modify: `app/weather/WeatherService.java`, `app/weather/WeatherProperties.java` (slim to `baseUrl` + `apiKey`)
- Modify: `app/stream/service/CdnSigner.java`
- Modify test: `db-world-backend/src/test/java/com/db/dbworld/app/stream/service/CdnSignerTest.java`

**Interfaces:**
- Consumes: `SettingsService`, `ConfigKeys`. `AppProperties.getCdnSigningSecret()` (unchanged, env-backed).

**Mapping:**
| Old | New |
|---|---|
| `props.getCacheTtlSeconds()` (weather) | `settings.getInt(ConfigKeys.WEATHER_CACHE_TTL_SECONDS)` |
| `props.isCdnSigningEnabled()` (in CdnSigner) | `settings.getBoolean(ConfigKeys.CDN_SIGNING_ENABLED)` |
| `props.getCdnStreamTtlSeconds()` | `settings.getInt(ConfigKeys.CDN_SIGNING_STREAM_TTL_SECONDS)` |
| `props.getCdnDownloadTtlSeconds()` | `settings.getInt(ConfigKeys.CDN_SIGNING_DOWNLOAD_TTL_SECONDS)` |
| `props.getCdnSigningSecret()` | **unchanged** — keep reading from `AppProperties` (env) |

- [ ] **Step 1: Update `CdnSignerTest`**

Read the existing test. `CdnSigner.hash(...)` is a static pure function — those tests are unchanged. For any test that constructs `new CdnSigner(appProperties)` and exercises `signatureSuffix`, change the constructor to `new CdnSigner(appProperties, settings)` and stub the enabled/TTL getters on a `SettingsService` mock:
```java
import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
// in the relevant test(s):
SettingsService settings = mock(SettingsService.class);
when(settings.getBoolean(ConfigKeys.CDN_SIGNING_ENABLED)).thenReturn(true);
when(settings.getInt(ConfigKeys.CDN_SIGNING_STREAM_TTL_SECONDS)).thenReturn(21600);
when(settings.getInt(ConfigKeys.CDN_SIGNING_DOWNLOAD_TTL_SECONDS)).thenReturn(172800);
when(appProperties.getCdnSigningSecret()).thenReturn("test-secret");
CdnSigner signer = new CdnSigner(appProperties, settings);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=CdnSignerTest -q`
Expected: FAIL — constructor arity mismatch (if `signatureSuffix` tests exist) or compile error.

- [ ] **Step 3: Migrate `CdnSigner`, `WeatherService`, and slim `WeatherProperties`**

`CdnSigner.java` — add `SettingsService settings` to the constructor (Lombok `@RequiredArgsConstructor` picks it up from a new `private final SettingsService settings;` field), and change `signatureSuffix`:
```java
    public String signatureSuffix(String uriPath, StreamType type) {
        if (!settings.getBoolean(ConfigKeys.CDN_SIGNING_ENABLED)) return "";

        String secret = props.getCdnSigningSecret();   // secret stays in env
        if (!StringUtils.hasText(secret)) {
            if (warnedNoSecret.compareAndSet(false, true)) {
                log.warn("CDN signing is enabled but app.cdn.signing.secret is blank — "
                        + "serving UNSIGNED CDN URLs. Set the secret to activate signing.");
            }
            return "";
        }

        long ttl = (type == StreamType.DOWNLOAD)
                ? settings.getInt(ConfigKeys.CDN_SIGNING_DOWNLOAD_TTL_SECONDS)
                : settings.getInt(ConfigKeys.CDN_SIGNING_STREAM_TTL_SECONDS);
        long expires = Instant.now().getEpochSecond() + ttl;
        return "&md5=" + hash(expires, uriPath, secret) + "&expires=" + expires;
    }
```
Add imports: `com.db.dbworld.app.admin.config.registry.ConfigKeys`, `com.db.dbworld.app.admin.config.service.SettingsService`.

`WeatherService.java` — replace the `WeatherProperties props` cache-ttl read with `settings.getInt(ConfigKeys.WEATHER_CACHE_TTL_SECONDS)`. Keep reading `baseUrl`/`apiKey` from a (slimmed) `WeatherProperties` bean; add `SettingsService settings` to the constructor.

Slim `WeatherProperties.java` to only `baseUrl` + `apiKey`:
```java
package com.db.dbworld.app.weather;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Startup-bound OpenWeather connection details (stay in YAML). */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "weather.openweather")
public class WeatherProperties {
    private String apiKey;
    private String baseUrl = "https://api.openweathermap.org/data/2.5";
}
```

- [ ] **Step 4: Run tests + compile**

Run: `cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -Dtest=CdnSignerTest -q`
Expected: PASS. Then `JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" -o compile -q` → BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/app/weather/ \
        db-world-backend/src/main/java/com/db/dbworld/app/stream/service/CdnSigner.java \
        db-world-backend/src/test/java/com/db/dbworld/app/stream/service/CdnSignerTest.java
git commit -m "refactor(cdn,weather): read enabled/TTL/cache from SettingsService; secret stays in env"
```

---

## Task 8: Remove migrated keys from YAML + full test/boot verification

**Files:**
- Modify: `db-world-backend/src/main/resources/application.yml`
- Modify: `db-world-backend/src/main/resources/application-local.yml`
- Modify: `db-world-backend/src/main/resources/application-prod.yml`

- [ ] **Step 1: Remove the migrated blocks from `application.yml`**

Delete these keys (defaults now live in `SettingsCatalog`):
- Under `weather.openweather`: remove `cache-ttl-seconds` (keep `api-key`, `base-url`).
- Under `springdoc.swagger-ui`: remove `enabled` (keep `path`). *(Also remove the `enabled` override in `application-local.yml` / `application-prod.yml` — see Step 2.)*
- Under `app.cdn.signing`: remove `enabled`, `stream-ttl-seconds`, `download-ttl-seconds` (keep `secret`).
- Under `dbworld.tracking`: remove `enabled`, `v2.enabled` handling **only if unused elsewhere** (verify with a grep for `TRACKING_V2_ENABLED`; if the `v2.enabled` env flag is still read by other code, leave it), `batch-tick-ms`, `max-bytes-per-tick`, `max-accumulator-entries`, `stream-timeout-min`, `download-timeout-min`, `sweeper-tick-ms`, `event-retention-days`, `search-prefix-collapse-sec`. **Keep** `cdn-log-path`, `rotated-suffix`.
- Remove the entire `dbworld.recommend:` block.

> Before deleting `tracking.enabled`, grep: `rg "TRACKING_V2_ENABLED|tracking:\s*$" db-world-backend/src/main/resources`. The `${TRACKING_V2_ENABLED:true}` env placeholder feeds both `tracking.enabled` and `tracking.v2.enabled`. Since we now seed `tracking.enabled` into `app_config`, remove the YAML `enabled`/`v2` lines; if any code still binds `dbworld.tracking.v2.enabled`, that will surface in Step 3's compile/boot — handle it by reading `TRACKING_ENABLED` from `SettingsService` there too.

- [ ] **Step 2: Remove the profile overrides**

In `application-local.yml` and `application-prod.yml`, remove `springdoc.swagger-ui.enabled` overrides (local had `true`, prod had `false`). The seeded default is `false`; if you want Swagger on in local, set it once from the admin UI after boot. Leave all other local/prod keys untouched.

- [ ] **Step 3: Full backend test suite + boot smoke**

Run the whole suite:
`cd db-world-backend && JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" test -q`
Expected: BUILD SUCCESS, all tests green.

Boot smoke (requires local MySQL/Redis per `application-local.yml`; if unavailable, skip and note it — the user will boot it):
`JAVA_HOME="C:/Program Files/Java/jdk-25.0.3" "$MVN" spring-boot:run -Dspring-boot.run.profiles=local`
Expected in logs: `Seeded app_config key '...'` lines on first boot; no `ConfigurationProperties` binding errors; app reaches "Started" banner. Ctrl-C to stop.

- [ ] **Step 4: Commit**

```bash
git add db-world-backend/src/main/resources/application.yml \
        db-world-backend/src/main/resources/application-local.yml \
        db-world-backend/src/main/resources/application-prod.yml
git commit -m "chore(config): remove migrated Tier-3 keys from YAML (defaults now in SettingsCatalog)"
```

---

## Task 9: Frontend — route, nav, API client, page skeleton

**Files:**
- Create: `db-world-frontend/src/features/admin/settings/api.js`
- Create: `db-world-frontend/src/features/admin/settings/SettingsPanel.jsx` (skeleton)
- Modify: `db-world-frontend/src/app/App.jsx` (lazy import + route)
- Modify: `db-world-frontend/src/features/admin/layout/AdminLayout.jsx` (nav item)

**Interfaces:**
- Produces: default-exported `SettingsPanel` React component at `@features/admin/settings/SettingsPanel.jsx`; `api` object with `list()`, `update(key, value)`, `reset(key)`.

- [ ] **Step 1: Create the API client** (`api.js`)

```js
import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

const settingsApi = {
  list:   ()            => axiosInstance.get('/api/admin/config').then(r => r.data?.data ?? []),
  update: (key, value)  => axiosInstance.put(`/api/admin/config/${encodeURIComponent(key)}`, { value: String(value) }),
  reset:  (key)         => axiosInstance.post(`/api/admin/config/${encodeURIComponent(key)}/reset`),
};

export default settingsApi;
```

- [ ] **Step 2: Create the page skeleton** (`SettingsPanel.jsx`)

```jsx
import React from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import settingsApi from './api';

const SettingsPanel = () => {
  const T = useT();
  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: settingsApi.list,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress sx={{ color: T.teal }} />
      </Box>
    );
  }
  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">Failed to load settings.</Alert></Box>;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: T.text, mb: 0.5 }}>
        Settings
      </Typography>
      <Typography sx={{ fontSize: '0.82rem', color: T.textFaint, mb: 3 }}>
        Runtime configuration — changes apply live (no restart) unless noted.
      </Typography>
      {categories.map((cat) => (
        <Box key={cat.category} sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, color: T.text }}>{cat.category}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: T.textFaint }}>
            {cat.settings.length} setting(s)
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default SettingsPanel;
```

- [ ] **Step 3: Wire the route in `App.jsx`**

After line 58 (`const LazySchedulerPanel = ...`), add:
```jsx
const LazySettingsPanel        = lazy(() => import('@features/admin/settings/SettingsPanel.jsx'));
```
After the `scheduler` route (line 389, `<Route path="scheduler" element={<LazySchedulerPanel />} />`), add:
```jsx
                    <Route path="settings"      element={<LazySettingsPanel />} />
```

- [ ] **Step 4: Add the nav item in `AdminLayout.jsx`**

Add `Tune` to the `@mui/icons-material` import (line 9-16 block). In the `NAV` `system` section `items` array (after the `scheduler` item, line 68), add:
```jsx
      { id: 'settings',    label: 'Settings',      icon: <Tune />,      path: 'settings' },
```

- [ ] **Step 5: Verify build + preview, then commit**

Build: `cd db-world-frontend && npm run build`
Expected: build completes with no errors referencing `settings`.

Preview verification (dev server): start via `preview_start` (create `.claude/launch.json` entry for the frontend dev server if not present), navigate to `/admin/settings`, confirm the page renders the category headings and no console errors (`preview_console_logs`). Screenshot for proof.

```bash
git add db-world-frontend/src/features/admin/settings/api.js \
        db-world-frontend/src/features/admin/settings/SettingsPanel.jsx \
        db-world-frontend/src/app/App.jsx \
        db-world-frontend/src/features/admin/layout/AdminLayout.jsx
git commit -m "feat(admin-ui): settings page route, nav item, API client, skeleton"
```

---

## Task 10: Frontend — settings page UI (typed inputs, save, reset)

**Files:**
- Modify: `db-world-frontend/src/features/admin/settings/SettingsPanel.jsx` (full UI)

**Interfaces:**
- Consumes: `settingsApi` (Task 9). Each setting object has `{ key, label, description, valueType, value, defaultValue, minValue, maxValue, requiresRestart, updatedAt, updatedBy }`.

- [ ] **Step 1: Replace `SettingsPanel.jsx` with the full UI**

```jsx
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Switch, TextField,
  Button, Chip, Divider, Tooltip, InputAdornment,
} from '@mui/material';
import { RestartAlt, Save } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import settingsApi from './api';

// One editable row. Local draft state; commits on Save (or toggle for booleans).
function SettingRow({ s, onSave, onReset, saving }) {
  const T = useT();
  const isBool = s.valueType === 'BOOLEAN';
  const [draft, setDraft] = useState(s.value ?? '');
  useEffect(() => { setDraft(s.value ?? ''); }, [s.value]);

  const dirty = String(draft) !== String(s.value ?? '');
  const numeric = s.valueType === 'INTEGER' || s.valueType === 'LONG';
  const atDefault = String(s.value ?? '') === String(s.defaultValue ?? '');

  const commit = (val) => onSave(s.key, val);

  return (
    <Box sx={{ py: 1.5, borderBottom: `1px solid ${T.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.86rem', fontWeight: 600, color: T.text }}>
              {s.label}
            </Typography>
            {s.requiresRestart && (
              <Chip label="restart required" size="small"
                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#f59e0b', color: '#fff' }} />
            )}
          </Box>
          {s.description && (
            <Typography sx={{ fontSize: '0.72rem', color: T.textFaint, mt: 0.25 }}>
              {s.description}
            </Typography>
          )}
          <Typography sx={{ fontSize: '0.65rem', color: T.textFaint, mt: 0.25 }}>
            <code>{s.key}</code> · default {String(s.defaultValue)}
            {s.updatedBy ? ` · last by ${s.updatedBy}` : ''}
          </Typography>
        </Box>

        {isBool ? (
          <Switch
            checked={draft === 'true' || draft === true}
            disabled={saving}
            onChange={(e) => { const v = e.target.checked ? 'true' : 'false'; setDraft(v); commit(v); }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              type={numeric ? 'number' : 'text'}
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              inputProps={numeric ? { min: s.minValue ?? undefined, max: s.maxValue ?? undefined } : {}}
              sx={{ width: numeric ? 130 : 220 }}
            />
            <Tooltip title={dirty ? 'Save' : 'No changes'}>
              <span>
                <Button size="small" variant="contained" disabled={!dirty || saving}
                  onClick={() => commit(draft)}
                  sx={{ minWidth: 0, px: 1, bgcolor: T.teal }}>
                  <Save sx={{ fontSize: 16 }} />
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}

        <Tooltip title={atDefault ? 'Already at default' : 'Reset to default'}>
          <span>
            <Button size="small" disabled={atDefault || saving} onClick={() => onReset(s.key)}
              sx={{ minWidth: 0, px: 1, color: T.textMuted }}>
              <RestartAlt sx={{ fontSize: 16 }} />
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

const SettingsPanel = () => {
  const T = useT();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: settingsApi.list,
  });

  const saveMut = useMutation({
    mutationFn: ({ key, value }) => settingsApi.update(key, value),
    onSuccess: (_r, { key }) => {
      enqueueSnackbar(`Saved ${key}`, { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (e) => enqueueSnackbar(
      e?.response?.data?.message ?? 'Save failed', { variant: 'error' }),
  });

  const resetMut = useMutation({
    mutationFn: (key) => settingsApi.reset(key),
    onSuccess: (_r, key) => {
      enqueueSnackbar(`Reset ${key}`, { variant: 'info' });
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (e) => enqueueSnackbar(
      e?.response?.data?.message ?? 'Reset failed', { variant: 'error' }),
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
      <CircularProgress sx={{ color: T.teal }} /></Box>;
  }
  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">Failed to load settings.</Alert></Box>;
  }

  const saving = saveMut.isPending || resetMut.isPending;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: T.text, mb: 0.5 }}>
        Settings
      </Typography>
      <Typography sx={{ fontSize: '0.82rem', color: T.textFaint, mb: 3 }}>
        Runtime configuration — changes apply live (no restart) unless flagged.
      </Typography>

      {categories.map((cat) => (
        <Box key={cat.category} sx={{
          mb: 3, p: 2, borderRadius: 2,
          bgcolor: T.card, border: `1px solid ${T.border}`,
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: T.teal, mb: 1 }}>
            {cat.category}
          </Typography>
          <Divider sx={{ borderColor: T.border, mb: 0.5 }} />
          {cat.settings.map((s) => (
            <SettingRow
              key={s.key}
              s={s}
              saving={saving}
              onSave={(key, value) => saveMut.mutate({ key, value })}
              onReset={(key) => resetMut.mutate(key)}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default SettingsPanel;
```

> If any `T.*` token used here (`T.card`, `T.border`, `T.teal`, `T.text`, `T.textFaint`, `T.textMuted`) is absent from the theme, substitute the nearest existing token (check `@shared/theme`) — `SchedulerPanel.jsx` and `AdminLayout.jsx` are reference consumers.

- [ ] **Step 2: Verify in the browser**

Start the dev server (`preview_start`), open `/admin/settings`. Confirm:
- Categories render (Recommendations, Activity Tracking, Weather, CDN Signing, API Docs).
- A boolean (e.g. "Genre rail enabled") shows a Switch; toggling it fires a save toast.
- A number (e.g. "Genre top-N") edits + Save enables only when changed; out-of-range value (e.g. completion threshold 150) shows the server's 400 error toast.
- "restart required" chip appears on Swagger.
- Reset icon restores the default and is disabled when already at default.

Check `preview_console_logs` for errors; screenshot for proof.

- [ ] **Step 3: Commit**

```bash
git add db-world-frontend/src/features/admin/settings/SettingsPanel.jsx
git commit -m "feat(admin-ui): full settings editor — typed inputs, live save, reset-to-default"
```

---

## Self-Review

**1. Spec coverage:**
- §3 data model → Task 1 (entity/enum/repo). ✓
- §3 registry / defaults source-of-truth → Task 2. ✓
- §4 SettingsService cache + fail-safe getters + seeding + change (live cron via trigger, not a hook — simpler, documented in Task 5) → Tasks 3, 5. ✓
- §5 consumer migration → Tasks 5 (recommend), 6 (tracking), 7 (weather/CDN). ✓
- §6 catalog (24 keys) → Task 2 catalog + `catalogCoversExpectedKeyCount`. ✓
- §7 secret stays in env → Task 7 keeps `AppProperties.getCdnSigningSecret()`; no secret key in catalog. ✓
- §8 admin API (GET/PUT/reset) → Task 4. ✓
- §9 admin UI at `/admin/settings` → Tasks 9, 10. ✓
- §10 testing → unit tests in Tasks 1-7; full suite + boot smoke in Task 8; browser verification in Task 10. ✓
- §11 rollout: YAML keys removed after service exists → Task 8 (ordered last on backend). ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Consumer-migration tasks use explicit key→getter mapping tables + full replacement code for the files whose full source wasn't inlined; each such task ends with a compile gate that surfaces any missed reference by name. Acceptable — not a hidden placeholder.

**3. Type consistency:** `ConfigKeys.*` constants are referenced identically across Tasks 2-7 and the catalog. `SettingsService` getter names (`getBoolean/getInt/getLong/getString`, `update`, `reset`, `listGrouped`, `toDto`, `findAllOrdered`, `reloadCache`, `init`, `seedDefaults`) are consistent between definition (Tasks 3-4) and consumers/tests. `SettingDefinition` accessor names (record components: `key/type/category/label/description/defaultValue/minValue/maxValue/requiresRestart/displayOrder`) match usage in `SettingsCatalog`, `SettingsService`, and `SettingsCatalogTest`. `SettingDto`/`SettingCategoryDto` component names (`category`, `settings`, `key`, `valueType`, etc.) match the frontend's expected fields in Task 10.

One correction applied vs. the spec: spec §5 said "retire `TrackingProperties`/`WeatherProperties`"; those are **slimmed, not deleted** (they retain YAML-bound infra keys `cdn-log-path`/`rotated-suffix` and `base-url`/`api-key`). Only `RecommendProperties` is deleted. Reflected in Tasks 6 & 7.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-09-db-backed-app-config.md`.
