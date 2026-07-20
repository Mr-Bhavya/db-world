# Activity Tracking — Plan 1A: Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, unit-tested core engine + database schema for the event-sourced activity/audit tracking rebuild — byte-range math, client detection, CDN log parsing, the session aggregator (state machine + source precedence), and the ingest service — with nothing wired to live sources yet.

**Architecture:** Event-sourced. An immutable `TrackEvent` (from clients, the resolve hook, or the nginx shipper) is applied by a pure `SessionAggregator` onto an `ActivitySessionEntity`, maintaining true bytes via interval-union, peak connections, attempts, pause/resume counts, and state. `TrackingIngestService` persists the append-only `ActivityEventEntity` and the maintained `ActivitySessionEntity`. All domain math lives in pure classes with full unit tests; persistence is a thin adapter (Plan 1B wires the resolve hook, nginx shipper, and sweeper).

**Tech Stack:** Spring Boot 4.0.6, Java 25, Spring Data JPA (Hibernate `ddl-auto: update`, MySQL schema `new_db_world`), Lombok, Jackson, JUnit 5 + AssertJ + Mockito (`spring-boot-starter-test`). No Flyway. No Testcontainers.

## Global Constraints

- **Backend build requires JDK 25** (project default may be 21). Ensure `JAVA_HOME` points at your JDK 25 before building/testing.
- **Maven wrapper (not on PATH):** `MVN="C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn"`. Run one test class: `cd db-world-backend && "$MVN" -q -Dtest=ClassName test`.
- **No Flyway.** Tables are created by Hibernate from `@Entity` classes on boot. Declare indexes/unique constraints inside `@Table(indexes=…, uniqueConstraints=…)`. Do NOT write `V__`/`R__` migration files.
- **Package root:** all new code under `com.db.dbworld.audit.tracking`.
- **Entity conventions:** `jakarta.persistence.*`; Lombok `@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor`; `@Table(schema = "new_db_world")`; explicit `@Column(name = "snake_case")`; `Instant` timestamps; `@Enumerated(EnumType.STRING)` for enums.
- **Feature flag:** `dbworld.tracking.v2.enabled` (bound in `TrackingProperties`) gates all live writes. Default `true` in dev.
- **Test rules:** pure unit tests only in Plan 1A (no `@SpringBootTest`, no DB). Test files under `db-world-backend/src/test/java/com/db/dbworld/audit/tracking/...` — this source root does not exist yet; creating the first test file establishes it.
- **Commits:** each task ends with a commit on branch `feat/activity-audit-tracking`. End messages with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

---

### Task 1: Tracking enums + `TrackingProperties` + config

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/audit/tracking/enums/ActivityKind.java`
- Create: `.../audit/tracking/enums/TrackEventType.java`
- Create: `.../audit/tracking/enums/TrackChannel.java`
- Create: `.../audit/tracking/enums/ClientApp.java`
- Create: `.../audit/tracking/enums/TrackSource.java`
- Create: `.../audit/tracking/enums/SessionState.java`
- Create: `.../audit/tracking/config/TrackingProperties.java`
- Modify: `db-world-backend/src/main/resources/application.yml` (add `dbworld.tracking` block)

**Interfaces:**
- Produces: the six enums and `TrackingProperties` (getters via Lombok) consumed by every later task.

- [ ] **Step 1: Create the enums**

```java
// ActivityKind.java
package com.db.dbworld.audit.tracking.enums;
public enum ActivityKind { DOWNLOAD, STREAM, SEARCH }
```
```java
// TrackEventType.java
package com.db.dbworld.audit.tracking.enums;
public enum TrackEventType {
    RESOLVE, START, PROGRESS, PAUSE, RESUME, RETRY, FAIL, COMPLETE, ABORT,
    STREAM_START, STREAM_TICK, STREAM_PAUSE, SEEK, STREAM_STOP, SEARCH
}
```
```java
// TrackChannel.java
package com.db.dbworld.audit.tracking.enums;
public enum TrackChannel { APP, WEB, BROWSER, EXTERNAL, SERVER }
```
```java
// ClientApp.java
package com.db.dbworld.audit.tracking.enums;
public enum ClientApp {
    DBWORLD_APP, ARIA2, CHROME, FIREFOX, SAFARI, EDGE, IDM, ONEDM,
    VLC, MPV, KODI, WGET, CURL, UNKNOWN
}
```
```java
// TrackSource.java
package com.db.dbworld.audit.tracking.enums;
public enum TrackSource { CLIENT, NGINX, SERVER }
```
```java
// SessionState.java
package com.db.dbworld.audit.tracking.enums;
public enum SessionState { RESOLVING, ACTIVE, PAUSED, COMPLETED, FAILED, ABORTED }
```

- [ ] **Step 2: Create `TrackingProperties`**

```java
package com.db.dbworld.audit.tracking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "dbworld.tracking")
public class TrackingProperties {

    /** Master flag — gates all live tracking writes. */
    private boolean enabled = true;

    /** nginx CDN access log the shipper tails (Plan 1B). */
    private String cdnLogPath = "/app/db_world/logs/nginx/cdn_access.log";
    private String rotatedSuffix = ".1";
    private long   batchTickMs = 5000L;
    private long   maxBytesPerTick = 5L * 1024 * 1024;
    private int    maxAccumulatorEntries = 10_000;

    /** Staleness sweeper (Plan 1B). */
    private int  streamTimeoutMin = 15;
    private int  downloadTimeoutMin = 30;
    private long sweeperTickMs = 60_000L;

    /** Retention (Plan 1B). */
    private int eventRetentionDays = 90;

    /** Collapse prefix-chain searches typed within this window (Plan 2). */
    private int searchPrefixCollapseSec = 30;
}
```

- [ ] **Step 3: Add the config block to `application.yml`**

Under the existing `dbworld:` root (sibling of `log-shipper:`), add:

```yaml
  tracking:
    enabled: ${TRACKING_V2_ENABLED:true}
    v2:
      enabled: ${TRACKING_V2_ENABLED:true}
    cdn-log-path: ${CDN_ACCESS_LOG:${app.paths.logs}/nginx/cdn_access.log}
    rotated-suffix: ".1"
    batch-tick-ms: 5000
    max-bytes-per-tick: 5242880
    max-accumulator-entries: 10000
    stream-timeout-min: 15
    download-timeout-min: 30
    sweeper-tick-ms: 60000
    event-retention-days: 90
    search-prefix-collapse-sec: 30
```

> `dbworld.tracking.v2.enabled` is the flag referenced elsewhere; `TrackingProperties.enabled` binds `dbworld.tracking.enabled`. Both read the same `TRACKING_V2_ENABLED` env var so they move together.

- [ ] **Step 4: Verify it compiles**

Run: `cd db-world-backend && "$MVN" -q compile`
Expected: `BUILD SUCCESS`.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/ db-world-backend/src/main/resources/application.yml
git commit -m "feat(tracking): enums + TrackingProperties config for v2 tracking

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `TransferMath` — interval-union bytes + peak-concurrent connections (TDD)

Pure math ported from the old `DownloadAccumulator` (`mergedCoverage`, `peakOverlap`), with tests. Byte ranges use **inclusive** semantics to match HTTP `Content-Range` (`bytes 0-1023/10000` = 1024 bytes).

**Files:**
- Create: `.../audit/tracking/aggregate/TransferMath.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/audit/tracking/aggregate/TransferMathTest.java`

**Interfaces:**
- Produces:
  - `static long coveredBytes(List<long[]> inclusiveByteIntervals)` — union length.
  - `static int peakConcurrent(List<long[]> timeIntervals)` — max overlap.

- [ ] **Step 1: Write the failing test**

```java
package com.db.dbworld.audit.tracking.aggregate;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class TransferMathTest {

    @Test void coveredBytes_singleInterval_isInclusiveLength() {
        assertThat(TransferMath.coveredBytes(List.of(new long[]{0, 1023}))).isEqualTo(1024);
    }

    @Test void coveredBytes_overlappingIntervals_countedOnce() {
        assertThat(TransferMath.coveredBytes(List.of(
                new long[]{0, 1023}, new long[]{512, 2047}))).isEqualTo(2048);
    }

    @Test void coveredBytes_adjacentIntervals_merge() {
        // 0-1023 and 1024-2047 are adjacent -> one 2048-byte run
        assertThat(TransferMath.coveredBytes(List.of(
                new long[]{0, 1023}, new long[]{1024, 2047}))).isEqualTo(2048);
    }

    @Test void coveredBytes_gap_notCounted() {
        // 0-99 (100) + gap + 200-299 (100) = 200
        assertThat(TransferMath.coveredBytes(List.of(
                new long[]{0, 99}, new long[]{200, 299}))).isEqualTo(200);
    }

    @Test void coveredBytes_outOfOrderAndDuplicate() {
        assertThat(TransferMath.coveredBytes(List.of(
                new long[]{200, 299}, new long[]{0, 99}, new long[]{0, 99}))).isEqualTo(200);
    }

    @Test void coveredBytes_empty_isZero() {
        assertThat(TransferMath.coveredBytes(List.of())).isEqualTo(0);
    }

    @Test void peakConcurrent_nonOverlapping_isOne() {
        assertThat(TransferMath.peakConcurrent(List.of(
                new long[]{0, 10}, new long[]{20, 30}))).isEqualTo(1);
    }

    @Test void peakConcurrent_threeOverlap_isThree() {
        assertThat(TransferMath.peakConcurrent(List.of(
                new long[]{0, 100}, new long[]{10, 50}, new long[]{20, 40}))).isEqualTo(3);
    }

    @Test void peakConcurrent_empty_isZero() {
        assertThat(TransferMath.peakConcurrent(List.of())).isEqualTo(0);
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd db-world-backend && "$MVN" -q -Dtest=TransferMathTest test`
Expected: FAIL — `TransferMath` cannot be resolved (compilation error).

- [ ] **Step 3: Implement `TransferMath`**

```java
package com.db.dbworld.audit.tracking.aggregate;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Pure math for transfer accounting. Byte intervals are INCLUSIVE [start,end]. */
public final class TransferMath {

    private TransferMath() {}

    /** Union length of inclusive byte intervals (dedupes overlaps / re-requests). */
    public static long coveredBytes(List<long[]> intervals) {
        if (intervals == null || intervals.isEmpty()) return 0L;
        List<long[]> sorted = new ArrayList<>(intervals);
        sorted.sort((a, b) -> Long.compare(a[0], b[0]));
        long covered = 0L;
        long curStart = sorted.get(0)[0];
        long curEnd   = sorted.get(0)[1];
        for (int i = 1; i < sorted.size(); i++) {
            long[] iv = sorted.get(i);
            if (iv[0] <= curEnd + 1) {              // overlapping or adjacent
                if (iv[1] > curEnd) curEnd = iv[1];
            } else {
                covered += (curEnd - curStart + 1);
                curStart = iv[0];
                curEnd   = iv[1];
            }
        }
        covered += (curEnd - curStart + 1);
        return covered;
    }

    /** Peak number of time intervals overlapping at any instant (sweep-line). */
    public static int peakConcurrent(List<long[]> timeIntervals) {
        if (timeIntervals == null || timeIntervals.isEmpty()) return 0;
        long[] starts = new long[timeIntervals.size()];
        long[] ends   = new long[timeIntervals.size()];
        for (int i = 0; i < timeIntervals.size(); i++) {
            starts[i] = timeIntervals.get(i)[0];
            ends[i]   = timeIntervals.get(i)[1];
        }
        Arrays.sort(starts);
        Arrays.sort(ends);
        int peak = 0, current = 0, si = 0, ei = 0;
        while (si < starts.length) {
            if (starts[si] <= ends[ei]) { current++; if (current > peak) peak = current; si++; }
            else { current--; ei++; }
        }
        return peak;
    }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `cd db-world-backend && "$MVN" -q -Dtest=TransferMathTest test`
Expected: PASS (9 tests green).

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/aggregate/TransferMath.java db-world-backend/src/test/java/com/db/dbworld/audit/tracking/aggregate/TransferMathTest.java
git commit -m "feat(tracking): TransferMath interval-union bytes + peak connections

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `ClientAppDetector` — User-Agent → ClientApp/Channel (TDD)

**Files:**
- Create: `.../audit/tracking/parse/ClientAppDetector.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/audit/tracking/parse/ClientAppDetectorTest.java`

**Interfaces:**
- Produces:
  - `static ClientApp detect(String userAgent)`
  - `static TrackChannel channel(ClientApp app, boolean selfDeclaredDbworldApp)`

- [ ] **Step 1: Write the failing test**

```java
package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ClientApp;
import com.db.dbworld.audit.tracking.enums.TrackChannel;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ClientAppDetectorTest {

    @Test void detectsAria2() {
        assertThat(ClientAppDetector.detect("aria2/1.36.0")).isEqualTo(ClientApp.ARIA2);
    }
    @Test void detectsIdm() {
        assertThat(ClientAppDetector.detect("Internet Download Manager/6.41")).isEqualTo(ClientApp.IDM);
    }
    @Test void detects1dm() {
        assertThat(ClientAppDetector.detect("1DM/13.0 (Android)")).isEqualTo(ClientApp.ONEDM);
    }
    @Test void detectsVlc() {
        assertThat(ClientAppDetector.detect("VLC/3.0.18 LibVLC/3.0.18")).isEqualTo(ClientApp.VLC);
    }
    @Test void detectsWgetAndCurl() {
        assertThat(ClientAppDetector.detect("Wget/1.21.2")).isEqualTo(ClientApp.WGET);
        assertThat(ClientAppDetector.detect("curl/8.4.0")).isEqualTo(ClientApp.CURL);
    }
    @Test void detectsEdgeBeforeChrome() {
        // Edge UA also contains "Chrome" — Edge must win.
        assertThat(ClientAppDetector.detect(
            "Mozilla/5.0 ... Chrome/120 Safari/537.36 Edg/120.0")).isEqualTo(ClientApp.EDGE);
    }
    @Test void detectsChrome() {
        assertThat(ClientAppDetector.detect(
            "Mozilla/5.0 ... Chrome/120.0 Safari/537.36")).isEqualTo(ClientApp.CHROME);
    }
    @Test void detectsSafariNotChrome() {
        assertThat(ClientAppDetector.detect(
            "Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17.0 Safari/605.1.15"))
            .isEqualTo(ClientApp.SAFARI);
    }
    @Test void nullOrUnknown() {
        assertThat(ClientAppDetector.detect(null)).isEqualTo(ClientApp.UNKNOWN);
        assertThat(ClientAppDetector.detect("SomethingWeird/1.0")).isEqualTo(ClientApp.UNKNOWN);
    }
    @Test void channel_selfDeclaredApp_isApp() {
        assertThat(ClientAppDetector.channel(ClientApp.ARIA2, true)).isEqualTo(TrackChannel.APP);
    }
    @Test void channel_browser_isBrowser() {
        assertThat(ClientAppDetector.channel(ClientApp.CHROME, false)).isEqualTo(TrackChannel.BROWSER);
    }
    @Test void channel_downloadManager_isExternal() {
        assertThat(ClientAppDetector.channel(ClientApp.IDM, false)).isEqualTo(TrackChannel.EXTERNAL);
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd db-world-backend && "$MVN" -q -Dtest=ClientAppDetectorTest test`
Expected: FAIL — `ClientAppDetector` cannot be resolved.

- [ ] **Step 3: Implement `ClientAppDetector`**

```java
package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ClientApp;
import com.db.dbworld.audit.tracking.enums.TrackChannel;

import java.util.Locale;

/** Maps a User-Agent string to a {@link ClientApp} and derives its {@link TrackChannel}. */
public final class ClientAppDetector {

    private ClientAppDetector() {}

    public static ClientApp detect(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return ClientApp.UNKNOWN;
        String ua = userAgent.toLowerCase(Locale.ROOT);

        if (ua.contains("aria2"))                         return ClientApp.ARIA2;
        if (ua.contains("internet download manager")
                || ua.contains("idm/") || ua.contains("idman")) return ClientApp.IDM;
        if (ua.contains("1dm") || ua.contains("adm/"))    return ClientApp.ONEDM;
        if (ua.contains("vlc"))                           return ClientApp.VLC;
        if (ua.contains("mpv"))                           return ClientApp.MPV;
        if (ua.contains("kodi") || ua.contains("xbmc"))   return ClientApp.KODI;
        if (ua.contains("wget"))                          return ClientApp.WGET;
        if (ua.contains("curl"))                          return ClientApp.CURL;
        // Browsers — order matters (Edge/Chrome/Safari all overlap).
        if (ua.contains("edg/") || ua.contains("edga") || ua.contains("edgios")) return ClientApp.EDGE;
        if (ua.contains("firefox") || ua.contains("fxios")) return ClientApp.FIREFOX;
        if (ua.contains("chrome") || ua.contains("crios")) return ClientApp.CHROME;
        if (ua.contains("safari"))                        return ClientApp.SAFARI;
        return ClientApp.UNKNOWN;
    }

    public static TrackChannel channel(ClientApp app, boolean selfDeclaredDbworldApp) {
        if (selfDeclaredDbworldApp || app == ClientApp.DBWORLD_APP) return TrackChannel.APP;
        return switch (app) {
            case CHROME, FIREFOX, SAFARI, EDGE -> TrackChannel.BROWSER;
            case UNKNOWN                        -> TrackChannel.EXTERNAL;
            default                             -> TrackChannel.EXTERNAL; // IDM, 1DM, aria2 (not self-declared), VLC…
        };
    }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `cd db-world-backend && "$MVN" -q -Dtest=ClientAppDetectorTest test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/parse/ClientAppDetector.java db-world-backend/src/test/java/com/db/dbworld/audit/tracking/parse/ClientAppDetectorTest.java
git commit -m "feat(tracking): ClientAppDetector maps User-Agent to client/channel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `CdnLogLineParser` + `CdnLogLine` — parse nginx cdn_json (TDD)

Parses one `cdn_json` line into a typed record and extracts the inclusive byte range from `Content-Range`. Non-media asset lines (no `request_id` / wrong `type`) are dropped.

**Files:**
- Create: `.../audit/tracking/parse/CdnLogLine.java`
- Create: `.../audit/tracking/parse/CdnLogLineParser.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/audit/tracking/parse/CdnLogLineParserTest.java`

**Interfaces:**
- Produces:
  - `record CdnLogLine(String requestId, String downloadId, ActivityKind activity, Instant time, int status, long bytesSent, Long rangeStart, Long rangeEnd, Long fileTotal, String realIp, String userAgent, double durationSec, Long connId)` with `boolean isComplete()` (status 200, or 206 whose range end reaches fileTotal-1).
  - `Optional<CdnLogLine> parse(String jsonLine)` (instance method; class is a `@Component` holding an injected `ObjectMapper`).

- [ ] **Step 1: Write the failing test**

```java
package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThat;

class CdnLogLineParserTest {

    private final CdnLogLineParser parser = new CdnLogLineParser(new ObjectMapper());

    private static final String PARTIAL = """
        {"time":"2026-07-04T10:00:00+00:00","remote_addr":"1.2.3.4","real_ip":"9.9.9.9",\
        "method":"GET","uri":"/id/abc","status":206,"bytes_sent":1024,\
        "content_range":"bytes 0-1023/10000","range_header":"bytes=0-",\
        "file":"m.mkv","file_id":"/id/abc","user":"u@x.com",\
        "download_id":"DL_1","request_id":"req-1","type":"DOWNLOAD",\
        "event":"PARTIAL","duration_sec":"0.50","user_agent":"aria2/1.36",\
        "conn":"42","server":"cdn"}""";

    @Test void parsesPartialRange() {
        Optional<CdnLogLine> r = parser.parse(PARTIAL);
        assertThat(r).isPresent();
        CdnLogLine l = r.get();
        assertThat(l.requestId()).isEqualTo("req-1");
        assertThat(l.activity()).isEqualTo(ActivityKind.DOWNLOAD);
        assertThat(l.status()).isEqualTo(206);
        assertThat(l.bytesSent()).isEqualTo(1024);
        assertThat(l.rangeStart()).isEqualTo(0);
        assertThat(l.rangeEnd()).isEqualTo(1023);
        assertThat(l.fileTotal()).isEqualTo(10000);
        assertThat(l.connId()).isEqualTo(42);
        assertThat(l.isComplete()).isFalse();
    }

    @Test void streamTypeMapsToStream() {
        String s = PARTIAL.replace("\"type\":\"DOWNLOAD\"", "\"type\":\"ONLINE\"");
        assertThat(parser.parse(s).orElseThrow().activity()).isEqualTo(ActivityKind.STREAM);
    }

    @Test void status200IsComplete_evenWithoutContentRange() {
        String full = PARTIAL.replace("\"status\":206", "\"status\":200")
                             .replace("\"content_range\":\"bytes 0-1023/10000\",", "");
        CdnLogLine l = parser.parse(full).orElseThrow();
        assertThat(l.isComplete()).isTrue();
        assertThat(l.rangeStart()).isNull();
    }

    @Test void range206ReachingEndIsComplete() {
        String end = PARTIAL.replace("bytes 0-1023/10000", "bytes 9000-9999/10000");
        assertThat(parser.parse(end).orElseThrow().isComplete()).isTrue();
    }

    @Test void missingRequestIdIsDropped() {
        String noReq = PARTIAL.replace("\"request_id\":\"req-1\",", "\"request_id\":\"\",");
        assertThat(parser.parse(noReq)).isEmpty();
    }

    @Test void assetOrWrongTypeDropped() {
        String asset = PARTIAL.replace("\"type\":\"DOWNLOAD\"", "\"type\":\"\"");
        assertThat(parser.parse(asset)).isEmpty();
    }

    @Test void malformedJsonReturnsEmpty() {
        assertThat(parser.parse("{not json")).isEmpty();
        assertThat(parser.parse("")).isEmpty();
        assertThat(parser.parse(null)).isEmpty();
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd db-world-backend && "$MVN" -q -Dtest=CdnLogLineParserTest test`
Expected: FAIL — types cannot be resolved.

- [ ] **Step 3: Implement `CdnLogLine`**

```java
package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ActivityKind;
import java.time.Instant;

/** Typed view of one nginx cdn_json access-log line (media requests only). */
public record CdnLogLine(
        String requestId,
        String downloadId,
        ActivityKind activity,   // DOWNLOAD (type=DOWNLOAD) | STREAM (type=ONLINE)
        Instant time,
        int status,
        long bytesSent,
        Long rangeStart,         // inclusive; null if no Content-Range
        Long rangeEnd,           // inclusive; null if no Content-Range
        Long fileTotal,          // from Content-Range "…/total"; null if unknown
        String realIp,
        String userAgent,
        double durationSec,
        Long connId              // nginx $connection; null if absent
) {
    /** True when this request delivered the final byte of the file. */
    public boolean isComplete() {
        if (status == 200) return true;
        return status == 206 && rangeEnd != null && fileTotal != null && rangeEnd >= fileTotal - 1;
    }
}
```

- [ ] **Step 4: Implement `CdnLogLineParser`**

```java
package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Log4j2
@Component
@RequiredArgsConstructor
public class CdnLogLineParser {

    // "bytes 0-1023/10000"  or  "bytes 0-1023/*"
    private static final Pattern RANGE = Pattern.compile("bytes\\s+(\\d+)-(\\d+)/(\\d+|\\*)");

    private final ObjectMapper objectMapper;

    public Optional<CdnLogLine> parse(String line) {
        if (line == null || line.isBlank()) return Optional.empty();
        try {
            JsonNode n = objectMapper.readTree(line);

            String requestId = text(n, "request_id");
            String type = text(n, "type");
            if (requestId == null || requestId.isBlank()) return Optional.empty();
            ActivityKind activity;
            if ("DOWNLOAD".equals(type))      activity = ActivityKind.DOWNLOAD;
            else if ("ONLINE".equals(type))   activity = ActivityKind.STREAM;
            else return Optional.empty();

            Long rs = null, re = null, total = null;
            String cr = text(n, "content_range");
            if (cr != null) {
                Matcher m = RANGE.matcher(cr);
                if (m.find()) {
                    rs = Long.parseLong(m.group(1));
                    re = Long.parseLong(m.group(2));
                    total = "*".equals(m.group(3)) ? null : Long.parseLong(m.group(3));
                }
            }

            String t = text(n, "time");
            Instant time = t != null ? OffsetDateTime.parse(t).toInstant() : Instant.now();

            return Optional.of(new CdnLogLine(
                    requestId, text(n, "download_id"), activity, time,
                    intOr(n, "status", 0), longOr(n, "bytes_sent", 0L),
                    rs, re, total,
                    text(n, "real_ip"), text(n, "user_agent"),
                    doubleOr(n, "duration_sec", 0.0), longObj(n, "conn")
            ));
        } catch (Exception ex) {
            log.debug("CdnLogLineParser: skipping malformed line: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private static String text(JsonNode n, String f) {
        JsonNode v = n.get(f);
        return (v == null || v.isNull()) ? null : v.asText();
    }
    private static int intOr(JsonNode n, String f, int d) {
        JsonNode v = n.get(f); return v == null || v.isNull() ? d : v.asInt(d);
    }
    private static long longOr(JsonNode n, String f, long d) {
        JsonNode v = n.get(f); return v == null || v.isNull() ? d : v.asLong(d);
    }
    private static Long longObj(JsonNode n, String f) {
        JsonNode v = n.get(f);
        if (v == null || v.isNull() || v.asText().isBlank()) return null;
        try { return Long.parseLong(v.asText().trim()); } catch (NumberFormatException e) { return null; }
    }
    private static double doubleOr(JsonNode n, String f, double d) {
        JsonNode v = n.get(f);
        if (v == null || v.isNull()) return d;
        try { return Double.parseDouble(v.asText()); } catch (NumberFormatException e) { return d; }
    }
}
```

- [ ] **Step 5: Run tests and confirm they pass**

Run: `cd db-world-backend && "$MVN" -q -Dtest=CdnLogLineParserTest test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/parse/ db-world-backend/src/test/java/com/db/dbworld/audit/tracking/parse/CdnLogLineParserTest.java
git commit -m "feat(tracking): CdnLogLineParser parses nginx cdn_json media lines

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Core entities + repositories (`activity_event`, `activity_session`)

Hibernate `ddl-auto: update` creates these tables on boot. No DB unit test (native/MySQL specifics can't run on H2); verified by compile + boot.

**Files:**
- Create: `.../audit/tracking/entity/ActivityEventEntity.java`
- Create: `.../audit/tracking/entity/ActivitySessionEntity.java`
- Create: `.../audit/tracking/repository/ActivityEventRepository.java`
- Create: `.../audit/tracking/repository/ActivitySessionRepository.java`

**Interfaces:**
- Produces: both entities (Lombok builders + getters/setters) and repositories consumed by Tasks 6–7.

- [ ] **Step 1: Create `ActivityEventEntity`**

```java
package com.db.dbworld.audit.tracking.entity;

import com.db.dbworld.audit.tracking.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "ACTIVITY_EVENT", schema = "new_db_world",
    indexes = {
        @Index(name = "idx_ae_user_time", columnList = "user_id, event_time"),
        @Index(name = "idx_ae_session",   columnList = "session_id"),
        @Index(name = "idx_ae_media",     columnList = "media_file_id"),
        @Index(name = "idx_ae_kind_time", columnList = "activity, event_time")
    },
    uniqueConstraints = @UniqueConstraint(
        name = "uk_ae_session_clientevent", columnNames = {"session_id", "client_event_id"}))
public class ActivityEventEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_time", nullable = false) private Instant eventTime;
    @Column(name = "received_at", nullable = false) private Instant receivedAt;

    @Column(name = "user_id") private Long userId;
    @Column(name = "session_id", nullable = false, length = 64) private String sessionId;
    @Column(name = "client_event_id", length = 64) private String clientEventId;

    @Enumerated(EnumType.STRING) @Column(name = "activity", nullable = false, length = 16)
    private ActivityKind activity;
    @Enumerated(EnumType.STRING) @Column(name = "event_type", nullable = false, length = 20)
    private TrackEventType eventType;
    @Enumerated(EnumType.STRING) @Column(name = "channel", length = 12)
    private TrackChannel channel;
    @Column(name = "client_app", length = 40) private String clientApp;
    @Enumerated(EnumType.STRING) @Column(name = "source", nullable = false, length = 10)
    private TrackSource source;

    @Column(name = "media_file_id", length = 36) private String mediaFileId;
    @Column(name = "record_id") private Long recordId;
    @Column(name = "season_number") private Integer seasonNumber;
    @Column(name = "episode_number") private Integer episodeNumber;
    @Column(name = "file_path", length = 1024) private String filePath;
    @Column(name = "file_size") private Long fileSize;

    @Column(name = "bytes_delta") private Long bytesDelta;
    @Column(name = "cumulative_bytes") private Long cumulativeBytes;
    @Column(name = "range_start") private Long rangeStart;
    @Column(name = "range_end") private Long rangeEnd;
    @Column(name = "speed_bps") private Long speedBps;
    @Column(name = "connections") private Integer connections;
    @Column(name = "position_ms") private Long positionMs;
    @Column(name = "duration_ms") private Long durationMs;
    @Column(name = "completion_percent", precision = 5, scale = 2) private BigDecimal completionPercent;
    @Column(name = "http_status") private Integer httpStatus;
    @Column(name = "error_code", length = 40) private String errorCode;
    @Column(name = "error_message", length = 512) private String errorMessage;

    @Column(name = "search_query", length = 256) private String searchQuery;
    @Column(name = "result_count") private Integer resultCount;

    @Column(name = "remote_addr", length = 64) private String remoteAddr;
    @Column(name = "user_agent", length = 512) private String userAgent;
}
```

- [ ] **Step 2: Create `ActivitySessionEntity`**

```java
package com.db.dbworld.audit.tracking.entity;

import com.db.dbworld.audit.tracking.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "ACTIVITY_SESSION", schema = "new_db_world",
    indexes = {
        @Index(name = "idx_as_user_last",  columnList = "user_id, last_event_at"),
        @Index(name = "idx_as_state_last", columnList = "state, last_event_at"),
        @Index(name = "idx_as_media",      columnList = "media_file_id"),
        @Index(name = "idx_as_record",     columnList = "record_id"),
        @Index(name = "idx_as_kind_state", columnList = "activity, state")
    })
public class ActivitySessionEntity {

    @Id @Column(name = "session_id", length = 64) private String sessionId;

    @Column(name = "user_id") private Long userId;
    @Enumerated(EnumType.STRING) @Column(name = "activity", nullable = false, length = 16)
    private ActivityKind activity;
    @Enumerated(EnumType.STRING) @Column(name = "channel", length = 12) private TrackChannel channel;
    @Column(name = "client_app", length = 40) private String clientApp;

    @Column(name = "media_file_id", length = 36) private String mediaFileId;
    @Column(name = "record_id") private Long recordId;
    @Column(name = "season_number") private Integer seasonNumber;
    @Column(name = "episode_number") private Integer episodeNumber;
    @Column(name = "file_path", length = 1024) private String filePath;
    @Column(name = "file_name", length = 512) private String fileName;
    @Column(name = "file_size") private Long fileSize;

    @Enumerated(EnumType.STRING) @Column(name = "state", nullable = false, length = 12)
    private SessionState state;

    @Column(name = "unique_bytes") private Long uniqueBytes;
    @Column(name = "client_bytes") private Long clientBytes;
    @Column(name = "nginx_transferred_bytes") private Long nginxTransferredBytes;
    @Column(name = "completion_percent", precision = 5, scale = 2) private BigDecimal completionPercent;
    @Column(name = "peak_connections") private Integer peakConnections;
    @Column(name = "avg_speed_bps") private Long avgSpeedBps;
    @Column(name = "max_speed_bps") private Long maxSpeedBps;

    @Column(name = "attempt_count") private Integer attemptCount;
    @Column(name = "pause_count") private Integer pauseCount;
    @Column(name = "resume_count") private Integer resumeCount;
    @Column(name = "fail_count") private Integer failCount;

    @Column(name = "has_client_events") private Boolean hasClientEvents;
    @Column(name = "last_error_code", length = 40) private String lastErrorCode;
    @Column(name = "last_error_message", length = 512) private String lastErrorMessage;

    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "last_event_at") private Instant lastEventAt;
    @Column(name = "completed_at") private Instant completedAt;

    @Column(name = "watch_position_ms") private Long watchPositionMs;
    @Column(name = "watch_duration_ms") private Long watchDurationMs;
    @Column(name = "watch_progress_id") private Long watchProgressId;

    @Column(name = "remote_addr", length = 64) private String remoteAddr;
    @Column(name = "user_agent", length = 512) private String userAgent;

    /** Coalesced delivered inclusive byte intervals, serialized as "s:e,s:e". */
    @Lob @Column(name = "range_intervals") private String rangeIntervals;
}
```

- [ ] **Step 3: Create the repositories**

```java
// ActivityEventRepository.java
package com.db.dbworld.audit.tracking.repository;

import com.db.dbworld.audit.tracking.entity.ActivityEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;

@Repository
public interface ActivityEventRepository extends JpaRepository<ActivityEventEntity, Long> {
    boolean existsBySessionIdAndClientEventId(String sessionId, String clientEventId);
    long deleteByEventTimeBefore(Instant cutoff);
}
```
```java
// ActivitySessionRepository.java
package com.db.dbworld.audit.tracking.repository;

import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.SessionState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public interface ActivitySessionRepository extends JpaRepository<ActivitySessionEntity, String> {
    List<ActivitySessionEntity> findByStateInAndLastEventAtBefore(List<SessionState> states, Instant cutoff);
}
```

- [ ] **Step 4: Verify compile + table creation on boot**

Run: `cd db-world-backend && "$MVN" -q compile`
Expected: `BUILD SUCCESS`.

Then boot the app once against the dev DB and confirm the tables exist:
Run (SQL, via your DB client): `SHOW TABLES IN new_db_world LIKE 'ACTIVITY_%';`
Expected: `ACTIVITY_EVENT` and `ACTIVITY_SESSION` present.

- [ ] **Step 5: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/entity/ db-world-backend/src/main/java/com/db/dbworld/audit/tracking/repository/
git commit -m "feat(tracking): activity_event + activity_session entities & repos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `TrackEvent` + `NginxTickAggregate` domain records

The two immutable inputs to the aggregator. `TrackEvent` is one client/server event; `NginxTickAggregate` is one shipper flush per session (built in Plan 1B).

**Files:**
- Create: `.../audit/tracking/aggregate/TrackEvent.java`
- Create: `.../audit/tracking/aggregate/NginxTickAggregate.java`

**Interfaces:**
- Produces: both records, consumed by Task 7 (`SessionAggregator`) and Task 8 (`TrackingIngestService`).

- [ ] **Step 1: Create `TrackEvent`**

```java
package com.db.dbworld.audit.tracking.aggregate;

import com.db.dbworld.audit.tracking.enums.*;
import lombok.Builder;
import java.math.BigDecimal;
import java.time.Instant;

/** One client- or server-originated tracking event (immutable). */
@Builder
public record TrackEvent(
        String clientEventId,
        String sessionId,
        ActivityKind activity,
        TrackEventType type,
        TrackChannel channel,
        ClientApp clientApp,
        TrackSource source,
        Instant eventTime,
        Long userId,
        String mediaFileId,
        Long recordId,
        Integer seasonNumber,
        Integer episodeNumber,
        String filePath,
        String fileName,
        Long fileSize,
        Long cumulativeBytes,
        Long speedBps,
        Integer connections,
        Long positionMs,
        Long durationMs,
        BigDecimal completionPercent,
        String errorCode,
        String errorMessage,
        String searchQuery,
        Integer resultCount,
        String remoteAddr,
        String userAgent
) {}
```

- [ ] **Step 2: Create `NginxTickAggregate`**

```java
package com.db.dbworld.audit.tracking.aggregate;

import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.ClientApp;
import java.time.Instant;
import java.util.List;

/** One shipper flush for a single session (request_id) built from nginx log lines. */
public record NginxTickAggregate(
        String sessionId,
        ActivityKind activity,
        List<long[]> deliveredRanges,   // inclusive [start,end]
        long transferredBytes,          // sum of body_bytes_sent this flush
        Long fileTotal,                 // from Content-Range, nullable
        int peakConnections,            // TransferMath.peakConcurrent over request windows
        Long maxSpeedBps,
        ClientApp clientApp,
        String realIp,
        String userAgent,
        Instant lastEventAt,
        boolean sawComplete
) {}
```

- [ ] **Step 3: Verify compile**

Run: `cd db-world-backend && "$MVN" -q compile`
Expected: `BUILD SUCCESS`.

- [ ] **Step 4: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/aggregate/TrackEvent.java db-world-backend/src/main/java/com/db/dbworld/audit/tracking/aggregate/NginxTickAggregate.java
git commit -m "feat(tracking): TrackEvent + NginxTickAggregate domain records

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `SessionAggregator` — the state machine + source precedence (TDD)

The heart of the engine. Pure: mutates a plain `ActivitySessionEntity` (no DB) so it is fully unit-testable. Maintains state transitions, attempt/pause/resume/fail counts, `range_intervals`/`unique_bytes`, client-vs-nginx precedence, and completion %.

**Files:**
- Create: `.../audit/tracking/aggregate/RangeIntervals.java` (serialize helper)
- Create: `.../audit/tracking/aggregate/SessionAggregator.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/audit/tracking/aggregate/SessionAggregatorTest.java`

**Interfaces:**
- Consumes: `TransferMath`, `TrackEvent`, `NginxTickAggregate`, `ActivitySessionEntity`, enums.
- Produces (all instance methods on `@Component SessionAggregator`):
  - `ActivitySessionEntity initFromResolve(TrackEvent resolve)` — builds a fresh `RESOLVING` session.
  - `void applyClientEvent(ActivitySessionEntity s, TrackEvent e)`
  - `void applyNginxTick(ActivitySessionEntity s, NginxTickAggregate tick)`
- `RangeIntervals`: `static String add(String existing, List<long[]> newRanges)` and `static long covered(String serialized)`.

- [ ] **Step 1: Write `RangeIntervals` + its test first**

Create test `db-world-backend/src/test/java/com/db/dbworld/audit/tracking/aggregate/RangeIntervalsTest.java`:

```java
package com.db.dbworld.audit.tracking.aggregate;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class RangeIntervalsTest {
    @Test void addAndCover_dedupesOverlap() {
        String s = RangeIntervals.add(null, List.of(new long[]{0, 1023}));
        s = RangeIntervals.add(s, List.of(new long[]{512, 2047}));
        assertThat(RangeIntervals.covered(s)).isEqualTo(2048);
    }
    @Test void covered_emptyOrNull_isZero() {
        assertThat(RangeIntervals.covered(null)).isEqualTo(0);
        assertThat(RangeIntervals.covered("")).isEqualTo(0);
    }
    @Test void serializedFormat_isCompactAndCoalesced() {
        String s = RangeIntervals.add(null, List.of(new long[]{0, 99}, new long[]{100, 199}));
        assertThat(s).isEqualTo("0:199");           // adjacent -> coalesced
        assertThat(RangeIntervals.covered(s)).isEqualTo(200);
    }
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd db-world-backend && "$MVN" -q -Dtest=RangeIntervalsTest test`
Expected: FAIL — `RangeIntervals` cannot be resolved.

- [ ] **Step 3: Implement `RangeIntervals`**

```java
package com.db.dbworld.audit.tracking.aggregate;

import java.util.ArrayList;
import java.util.List;

/** Serializes a coalesced set of inclusive byte intervals as "s:e,s:e". */
public final class RangeIntervals {

    private RangeIntervals() {}

    public static String add(String existing, List<long[]> newRanges) {
        List<long[]> all = new ArrayList<>(parse(existing));
        if (newRanges != null) all.addAll(newRanges);
        List<long[]> merged = coalesce(all);
        StringBuilder sb = new StringBuilder();
        for (long[] iv : merged) {
            if (sb.length() > 0) sb.append(',');
            sb.append(iv[0]).append(':').append(iv[1]);
        }
        return sb.toString();
    }

    public static long covered(String serialized) {
        return TransferMath.coveredBytes(parse(serialized));
    }

    private static List<long[]> parse(String s) {
        List<long[]> out = new ArrayList<>();
        if (s == null || s.isBlank()) return out;
        for (String part : s.split(",")) {
            int c = part.indexOf(':');
            if (c <= 0) continue;
            out.add(new long[]{Long.parseLong(part.substring(0, c)), Long.parseLong(part.substring(c + 1))});
        }
        return out;
    }

    private static List<long[]> coalesce(List<long[]> intervals) {
        List<long[]> out = new ArrayList<>();
        if (intervals.isEmpty()) return out;
        intervals.sort((a, b) -> Long.compare(a[0], b[0]));
        long s = intervals.get(0)[0], e = intervals.get(0)[1];
        for (int i = 1; i < intervals.size(); i++) {
            long[] iv = intervals.get(i);
            if (iv[0] <= e + 1) { if (iv[1] > e) e = iv[1]; }
            else { out.add(new long[]{s, e}); s = iv[0]; e = iv[1]; }
        }
        out.add(new long[]{s, e});
        return out;
    }
}
```

- [ ] **Step 4: Run `RangeIntervalsTest` and confirm it passes**

Run: `cd db-world-backend && "$MVN" -q -Dtest=RangeIntervalsTest test`
Expected: PASS.

- [ ] **Step 5: Write the failing `SessionAggregator` test**

```java
package com.db.dbworld.audit.tracking.aggregate;

import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class SessionAggregatorTest {

    private final SessionAggregator agg = new SessionAggregator();

    private TrackEvent.TrackEventBuilder base(TrackEventType t) {
        return TrackEvent.builder()
                .sessionId("req-1").activity(ActivityKind.DOWNLOAD).type(t)
                .channel(TrackChannel.APP).clientApp(ClientApp.ARIA2).source(TrackSource.CLIENT)
                .eventTime(Instant.parse("2026-07-04T10:00:00Z"))
                .userId(7L).mediaFileId("mf-1").recordId(3L).fileSize(10_000L);
    }

    @Test void initFromResolve_startsResolving() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        assertThat(s.getSessionId()).isEqualTo("req-1");
        assertThat(s.getState()).isEqualTo(SessionState.RESOLVING);
        assertThat(s.getAttemptCount()).isEqualTo(0);
    }

    @Test void start_movesToActive_andCountsAttempt() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
        assertThat(s.getAttemptCount()).isEqualTo(1);
        assertThat(s.getHasClientEvents()).isTrue();
    }

    @Test void clientProgress_setsCompletionFromCumulativeBytes() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.PROGRESS).cumulativeBytes(5000L)
                .speedBps(1_000_000L).connections(4).build());
        assertThat(s.getClientBytes()).isEqualTo(5000L);
        assertThat(s.getPeakConnections()).isEqualTo(4);
        assertThat(s.getMaxSpeedBps()).isEqualTo(1_000_000L);
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(50.0);
    }

    @Test void pauseResume_countedAndStateChanges() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.PAUSE).build());
        assertThat(s.getState()).isEqualTo(SessionState.PAUSED);
        assertThat(s.getPauseCount()).isEqualTo(1);
        agg.applyClientEvent(s, base(TrackEventType.RESUME).build());
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
        assertThat(s.getResumeCount()).isEqualTo(1);
    }

    @Test void failThenRetry_incrementsAttemptsAndFails() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.FAIL).errorCode("NET").errorMessage("reset").build());
        assertThat(s.getState()).isEqualTo(SessionState.FAILED);
        assertThat(s.getFailCount()).isEqualTo(1);
        assertThat(s.getLastErrorCode()).isEqualTo("NET");
        agg.applyClientEvent(s, base(TrackEventType.RETRY).build());
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
        assertThat(s.getAttemptCount()).isEqualTo(2);   // START + RETRY
    }

    @Test void complete_setsCompletedAndTimestamp() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.COMPLETE).cumulativeBytes(10_000L).build());
        assertThat(s.getState()).isEqualTo(SessionState.COMPLETED);
        assertThat(s.getCompletedAt()).isNotNull();
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(100.0);
    }

    @Test void nginxOnlySession_usesIntervalUnionForCompletion() {
        // External download (IDM): no client events, only nginx.
        ActivitySessionEntity s = ActivitySessionEntity.builder()
                .sessionId("req-2").activity(ActivityKind.DOWNLOAD).state(SessionState.RESOLVING)
                .fileSize(10_000L).attemptCount(0).build();
        NginxTickAggregate tick = new NginxTickAggregate(
                "req-2", ActivityKind.DOWNLOAD,
                List.of(new long[]{0, 4999}, new long[]{2500, 9999}),  // overlap
                12_000L,                 // transferred (incl. overlap retransmit)
                10_000L, 8, 2_000_000L, ClientApp.IDM, "9.9.9.9", "IDM/6", Instant.now(), true);
        agg.applyNginxTick(s, tick);
        assertThat(s.getUniqueBytes()).isEqualTo(10_000L);        // union, not 12000
        assertThat(s.getNginxTransferredBytes()).isEqualTo(12_000L);
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(100.0);
        assertThat(s.getPeakConnections()).isEqualTo(8);
        assertThat(s.getState()).isEqualTo(SessionState.COMPLETED);
        assertThat(s.getClientApp()).isEqualTo("IDM");
    }

    @Test void dualSource_clientAuthoritativeForCompletion_noDoubleCount() {
        // App session: client says 50%, nginx lines also arrive; completion stays client-driven.
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.PROGRESS).cumulativeBytes(5000L).build());
        NginxTickAggregate tick = new NginxTickAggregate(
                "req-1", ActivityKind.DOWNLOAD, List.of(new long[]{0, 4999}),
                5000L, 10_000L, 4, 1_000_000L, ClientApp.ARIA2, "1.1.1.1", "aria2/1.36",
                Instant.now(), false);
        agg.applyNginxTick(s, tick);
        assertThat(s.getHasClientEvents()).isTrue();
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(50.0); // client wins
        assertThat(s.getNginxTransferredBytes()).isEqualTo(5000L);          // separate column
        assertThat(s.getClientBytes()).isEqualTo(5000L);                    // not summed
    }

    @Test void streamTick_updatesWatchPosition() {
        TrackEvent.TrackEventBuilder sb = base(TrackEventType.RESOLVE)
                .activity(ActivityKind.STREAM).type(TrackEventType.RESOLVE);
        ActivitySessionEntity s = agg.initFromResolve(sb.build());
        agg.applyClientEvent(s, base(TrackEventType.STREAM_TICK).activity(ActivityKind.STREAM)
                .positionMs(61_000L).durationMs(5_400_000L).build());
        assertThat(s.getWatchPositionMs()).isEqualTo(61_000L);
        assertThat(s.getWatchDurationMs()).isEqualTo(5_400_000L);
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
    }
}
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `cd db-world-backend && "$MVN" -q -Dtest=SessionAggregatorTest test`
Expected: FAIL — `SessionAggregator` cannot be resolved.

- [ ] **Step 7: Implement `SessionAggregator`**

```java
package com.db.dbworld.audit.tracking.aggregate;

import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.*;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure state machine that folds events onto an ActivitySessionEntity. */
@Component
public class SessionAggregator {

    public ActivitySessionEntity initFromResolve(TrackEvent e) {
        return ActivitySessionEntity.builder()
                .sessionId(e.sessionId())
                .userId(e.userId())
                .activity(e.activity())
                .channel(e.channel())
                .clientApp(e.clientApp() != null ? e.clientApp().name() : null)
                .mediaFileId(e.mediaFileId())
                .recordId(e.recordId())
                .seasonNumber(e.seasonNumber())
                .episodeNumber(e.episodeNumber())
                .filePath(e.filePath())
                .fileName(e.fileName())
                .fileSize(e.fileSize())
                .state(SessionState.RESOLVING)
                .uniqueBytes(0L).clientBytes(0L).nginxTransferredBytes(0L)
                .peakConnections(0).attemptCount(0).pauseCount(0).resumeCount(0).failCount(0)
                .hasClientEvents(false)
                .startedAt(e.eventTime()).lastEventAt(e.eventTime())
                .remoteAddr(e.remoteAddr()).userAgent(e.userAgent())
                .rangeIntervals("")
                .build();
    }

    public void applyClientEvent(ActivitySessionEntity s, TrackEvent e) {
        s.setHasClientEvents(true);
        s.setLastEventAt(latest(s.getLastEventAt(), e.eventTime()));
        if (e.clientApp() != null) s.setClientApp(e.clientApp().name());
        if (e.channel() != null)   s.setChannel(e.channel());
        if (e.connections() != null) s.setPeakConnections(Math.max(nz(s.getPeakConnections()), e.connections()));
        if (e.speedBps() != null)   s.setMaxSpeedBps(Math.max(nzL(s.getMaxSpeedBps()), e.speedBps()));
        if (e.cumulativeBytes() != null) {
            s.setClientBytes(Math.max(nzL(s.getClientBytes()), e.cumulativeBytes()));
            recomputeClientCompletion(s);
        }
        if (e.positionMs() != null) s.setWatchPositionMs(e.positionMs());
        if (e.durationMs() != null) s.setWatchDurationMs(e.durationMs());

        switch (e.type()) {
            case START, STREAM_START -> { s.setAttemptCount(nz(s.getAttemptCount()) + 1); s.setState(SessionState.ACTIVE); }
            case RETRY               -> { s.setAttemptCount(nz(s.getAttemptCount()) + 1); s.setState(SessionState.ACTIVE); }
            case PROGRESS, STREAM_TICK, SEEK, RESUME -> {
                if (e.type() == TrackEventType.RESUME) s.setResumeCount(nz(s.getResumeCount()) + 1);
                s.setState(SessionState.ACTIVE);
            }
            case PAUSE, STREAM_PAUSE -> { s.setPauseCount(nz(s.getPauseCount()) + 1); s.setState(SessionState.PAUSED); }
            case FAIL -> {
                s.setFailCount(nz(s.getFailCount()) + 1);
                s.setLastErrorCode(e.errorCode()); s.setLastErrorMessage(e.errorMessage());
                s.setState(SessionState.FAILED);
            }
            case COMPLETE -> { s.setState(SessionState.COMPLETED); s.setCompletedAt(e.eventTime());
                               s.setCompletionPercent(BigDecimal.valueOf(100)); }
            case ABORT, STREAM_STOP -> { /* leave state; sweeper/close handles */ }
            case RESOLVE, SEARCH -> { /* no state transition */ }
        }
    }

    public void applyNginxTick(ActivitySessionEntity s, NginxTickAggregate t) {
        s.setLastEventAt(latest(s.getLastEventAt(), t.lastEventAt()));
        if (s.getActivity() == null) s.setActivity(t.activity());
        if (t.fileTotal() != null && s.getFileSize() == null) s.setFileSize(t.fileTotal());
        if (t.realIp() != null) s.setRemoteAddr(t.realIp());
        s.setNginxTransferredBytes(nzL(s.getNginxTransferredBytes()) + t.transferredBytes());
        s.setPeakConnections(Math.max(nz(s.getPeakConnections()), t.peakConnections()));
        if (t.maxSpeedBps() != null) s.setMaxSpeedBps(Math.max(nzL(s.getMaxSpeedBps()), t.maxSpeedBps()));

        // Union of delivered ranges -> unique bytes (authoritative when no client events).
        s.setRangeIntervals(RangeIntervals.add(s.getRangeIntervals(), t.deliveredRanges()));
        long covered = RangeIntervals.covered(s.getRangeIntervals());
        if (s.getFileSize() != null) covered = Math.min(covered, s.getFileSize());
        s.setUniqueBytes(covered);

        if (!Boolean.TRUE.equals(s.getHasClientEvents())) {
            // nginx is the authority for this session.
            if (s.getClientApp() == null || "UNKNOWN".equals(s.getClientApp()))
                s.setClientApp(t.clientApp() != null ? t.clientApp().name() : null);
            recomputeNginxCompletion(s);
            if (s.getState() == SessionState.RESOLVING) s.setState(SessionState.ACTIVE);
            if (t.sawComplete() || (s.getFileSize() != null && covered >= s.getFileSize())) {
                s.setState(SessionState.COMPLETED);
                if (s.getCompletedAt() == null) s.setCompletedAt(t.lastEventAt());
                s.setCompletionPercent(BigDecimal.valueOf(100));
            }
        }
    }

    private void recomputeClientCompletion(ActivitySessionEntity s) {
        if (s.getFileSize() != null && s.getFileSize() > 0 && s.getClientBytes() != null) {
            s.setCompletionPercent(pct(s.getClientBytes(), s.getFileSize()));
        }
    }
    private void recomputeNginxCompletion(ActivitySessionEntity s) {
        if (s.getFileSize() != null && s.getFileSize() > 0 && s.getUniqueBytes() != null) {
            s.setCompletionPercent(pct(s.getUniqueBytes(), s.getFileSize()));
        }
    }
    private static BigDecimal pct(long num, long den) {
        return BigDecimal.valueOf(Math.min(num, den))
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(den), 2, RoundingMode.HALF_UP);
    }
    private static java.time.Instant latest(java.time.Instant a, java.time.Instant b) {
        if (a == null) return b; if (b == null) return a; return b.isAfter(a) ? b : a;
    }
    private static int  nz(Integer v)  { return v == null ? 0 : v; }
    private static long nzL(Long v)     { return v == null ? 0L : v; }
}
```

- [ ] **Step 8: Run the aggregator tests and confirm they pass**

Run: `cd db-world-backend && "$MVN" -q -Dtest=SessionAggregatorTest,RangeIntervalsTest test`
Expected: PASS (all green).

- [ ] **Step 9: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/aggregate/ db-world-backend/src/test/java/com/db/dbworld/audit/tracking/aggregate/
git commit -m "feat(tracking): SessionAggregator state machine + source precedence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: `TrackingIngestService` — persist events + maintain sessions

Thin orchestration: dedupe + persist the `ActivityEventEntity`, upsert the `ActivitySessionEntity` via the aggregator. Verified with a Mockito test (no DB).

**Files:**
- Create: `.../audit/tracking/ingest/TrackingIngestService.java`
- Create: `.../audit/tracking/ingest/EventEntityMapper.java`
- Test: `db-world-backend/src/test/java/com/db/dbworld/audit/tracking/ingest/TrackingIngestServiceTest.java`

**Interfaces:**
- Consumes: `ActivityEventRepository`, `ActivitySessionRepository`, `SessionAggregator`, `TrackingProperties`, `TrackEvent`, `NginxTickAggregate`.
- Produces:
  - `void ingest(TrackEvent e)` — dedupe, persist event, apply to session.
  - `void ingestNginxTick(NginxTickAggregate tick)` — apply nginx flush to session (creating a minimal session if none exists).

- [ ] **Step 1: Write the failing Mockito test**

```java
package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.SessionAggregator;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.entity.ActivityEventEntity;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.*;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrackingIngestServiceTest {

    @Mock ActivityEventRepository eventRepo;
    @Mock ActivitySessionRepository sessionRepo;
    @Mock TrackingProperties props;
    @InjectMocks TrackingIngestService service;

    private final SessionAggregator realAgg = new SessionAggregator();

    private TrackEvent resolve() {
        return TrackEvent.builder().sessionId("req-1").clientEventId("ce-1")
                .activity(ActivityKind.DOWNLOAD).type(TrackEventType.RESOLVE)
                .channel(TrackChannel.SERVER).clientApp(ClientApp.DBWORLD_APP).source(TrackSource.SERVER)
                .eventTime(Instant.now()).userId(7L).mediaFileId("mf-1").fileSize(100L).build();
    }

    @Test void ingest_disabled_doesNothing() {
        when(props.isEnabled()).thenReturn(false);
        service.ingest(resolve());
        verifyNoInteractions(eventRepo, sessionRepo);
    }

    @Test void ingest_duplicate_skipsPersist() {
        when(props.isEnabled()).thenReturn(true);
        when(eventRepo.existsBySessionIdAndClientEventId("req-1", "ce-1")).thenReturn(true);
        service.ingest(resolve());
        verify(eventRepo, never()).save(any());
        verify(sessionRepo, never()).save(any());
    }

    @Test void ingest_new_persistsEventAndCreatesSession() {
        when(props.isEnabled()).thenReturn(true);
        when(eventRepo.existsBySessionIdAndClientEventId(any(), any())).thenReturn(false);
        when(sessionRepo.findById("req-1")).thenReturn(Optional.empty());
        service.ingest(resolve());
        verify(eventRepo).save(any(ActivityEventEntity.class));
        verify(sessionRepo).save(any(ActivitySessionEntity.class));
    }
}
```

Note: give the service the real aggregator by field injection in the constructor (see Step 3); `@InjectMocks` supplies the mocked repos/props and the test sets the aggregator via constructor. To keep `@InjectMocks` simple, `SessionAggregator` is a constructor arg — Mockito will inject a mock unless we pass the real one. Adjust the test to construct the service manually:

Replace the `@InjectMocks` field and add a setup:

```java
    // remove @InjectMocks; construct manually so we use the REAL aggregator
    TrackingIngestService service;
    @org.junit.jupiter.api.BeforeEach void setUp() {
        service = new TrackingIngestService(eventRepo, sessionRepo, new SessionAggregator(), props);
    }
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd db-world-backend && "$MVN" -q -Dtest=TrackingIngestServiceTest test`
Expected: FAIL — `TrackingIngestService` / `EventEntityMapper` cannot be resolved.

- [ ] **Step 3: Implement `EventEntityMapper`**

```java
package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.entity.ActivityEventEntity;

import java.time.Instant;

/** Maps a TrackEvent to its append-only ActivityEventEntity row. */
final class EventEntityMapper {
    private EventEntityMapper() {}

    static ActivityEventEntity toEntity(TrackEvent e) {
        return ActivityEventEntity.builder()
                .eventTime(e.eventTime() != null ? e.eventTime() : Instant.now())
                .receivedAt(Instant.now())
                .userId(e.userId())
                .sessionId(e.sessionId())
                .clientEventId(e.clientEventId())
                .activity(e.activity())
                .eventType(e.type())
                .channel(e.channel())
                .clientApp(e.clientApp() != null ? e.clientApp().name() : null)
                .source(e.source())
                .mediaFileId(e.mediaFileId())
                .recordId(e.recordId())
                .seasonNumber(e.seasonNumber())
                .episodeNumber(e.episodeNumber())
                .filePath(e.filePath())
                .fileSize(e.fileSize())
                .cumulativeBytes(e.cumulativeBytes())
                .speedBps(e.speedBps())
                .connections(e.connections())
                .positionMs(e.positionMs())
                .durationMs(e.durationMs())
                .completionPercent(e.completionPercent())
                .errorCode(e.errorCode())
                .errorMessage(e.errorMessage())
                .searchQuery(e.searchQuery())
                .resultCount(e.resultCount())
                .remoteAddr(e.remoteAddr())
                .userAgent(e.userAgent())
                .build();
    }
}
```

- [ ] **Step 4: Implement `TrackingIngestService`**

```java
package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.NginxTickAggregate;
import com.db.dbworld.audit.tracking.aggregate.SessionAggregator;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.SessionState;
import com.db.dbworld.audit.tracking.enums.TrackEventType;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Log4j2
@Service
@RequiredArgsConstructor
public class TrackingIngestService {

    private final ActivityEventRepository eventRepo;
    private final ActivitySessionRepository sessionRepo;
    private final SessionAggregator aggregator;
    private final TrackingProperties props;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ingest(TrackEvent e) {
        if (!props.isEnabled() || e == null || e.sessionId() == null) return;

        if (e.clientEventId() != null
                && eventRepo.existsBySessionIdAndClientEventId(e.sessionId(), e.clientEventId())) {
            log.debug("tracking: duplicate event {}/{} ignored", e.sessionId(), e.clientEventId());
            return;
        }

        eventRepo.save(EventEntityMapper.toEntity(e));

        ActivitySessionEntity session = sessionRepo.findById(e.sessionId())
                .orElseGet(() -> aggregator.initFromResolve(e));
        if (e.type() != TrackEventType.RESOLVE) {
            aggregator.applyClientEvent(session, e);
        }
        sessionRepo.save(session);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ingestNginxTick(NginxTickAggregate tick) {
        if (!props.isEnabled() || tick == null || tick.sessionId() == null) return;
        ActivitySessionEntity session = sessionRepo.findById(tick.sessionId())
                .orElseGet(() -> ActivitySessionEntity.builder()
                        .sessionId(tick.sessionId())
                        .activity(tick.activity())
                        .state(SessionState.RESOLVING)
                        .uniqueBytes(0L).clientBytes(0L).nginxTransferredBytes(0L)
                        .peakConnections(0).attemptCount(0).pauseCount(0).resumeCount(0).failCount(0)
                        .hasClientEvents(false).rangeIntervals("")
                        .startedAt(tick.lastEventAt()).lastEventAt(tick.lastEventAt())
                        .build());
        aggregator.applyNginxTick(session, tick);
        sessionRepo.save(session);
    }
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `cd db-world-backend && "$MVN" -q -Dtest=TrackingIngestServiceTest test`
Expected: PASS.

- [ ] **Step 6: Full engine test sweep + compile**

Run: `cd db-world-backend && "$MVN" -q -Dtest="com.db.dbworld.audit.tracking.**" test`
Expected: all tracking tests PASS.

- [ ] **Step 7: Commit**

```bash
git add db-world-backend/src/main/java/com/db/dbworld/audit/tracking/ingest/ db-world-backend/src/test/java/com/db/dbworld/audit/tracking/ingest/
git commit -m "feat(tracking): TrackingIngestService persists events + maintains sessions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (Plan 1A scope):**
- Event-sourced `activity_event` + `activity_session` → Tasks 5, 6, 7, 8. ✅
- Interval-union byte accounting / noisy ranges → Tasks 2, 7 (`TransferMath`, `RangeIntervals`, `applyNginxTick` clamps to file size). ✅
- Source precedence (dual-source, no double-count) → Task 7 `dualSource_*` + `nginxOnly_*` tests. ✅
- Client detection (app/browser/IDM/1DM/aria2/VLC…) → Task 3. ✅
- Connections (peak) → Task 2 `peakConcurrent` + Task 7. ✅
- Attempts / pause / resume / fail / "still active" state → Task 7. ✅
- Feature flag + config → Task 1. ✅
- **Deferred to Plan 1B** (correctly out of 1A scope): resolve hook, nginx `TrackingLogShipper` (builds `NginxTickAggregate`), staleness sweeper, retention pruner, nginx `cdn_json` `conn` field, `activity_daily_rollup` + `search_history` (moved to Plan 2 where they're consumed). Noted here so nothing is lost.

**Placeholder scan:** none — every step has full code and exact run commands.

**Type consistency:** `TrackEvent`/`NginxTickAggregate` (Task 6) fields match `SessionAggregator` (Task 7) and `EventEntityMapper`/`TrackingIngestService` (Task 8) usage; `ActivitySessionEntity` getters/setters (Task 5) match aggregator calls; `TransferMath.coveredBytes/peakConcurrent` (Task 2) signatures match `RangeIntervals`/`NginxTickAggregate` usage; `CdnLogLine` (Task 4) feeds the Plan 1B shipper.

**Note on `activity_daily_rollup`/`search_history`:** these tables from spec §4.3/§4.4 are created in the plans that first consume them (rollup in the admin/analytics plan; search_history in Plan 2), keeping each plan's schema next to its use. This is a deliberate deviation from putting all four tables in Plan 1A.
