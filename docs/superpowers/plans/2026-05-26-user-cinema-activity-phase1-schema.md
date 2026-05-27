# User Cinema Activity — Phase 1: Schema Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `watch_progress_id` FK column and `log_shipper_state` table that downstream phases need, remove 5 unused columns from `user_cinema_activity`, and backfill `record_id`/`media_file_id` on legacy rows — without breaking anything currently running.

**Architecture:** This project uses Hibernate `ddl-auto: update` (no Flyway). JPA entity edits auto-add columns and tables on application startup; column drops, FK constraints, and data backfills require manual SQL scripts under `db-world-backend/src/main/resources/db/migration/`. Operator runs those scripts in two stages: **pre-deploy** (before new code ships, backfills legacy data) and **post-deploy** (after new code ships, adds FK + drops legacy columns). This mirrors the existing `user_cinema_activity_v2_*` pattern.

**Tech Stack:** Spring Boot 3.x + Hibernate JPA, MySQL 8 (schema `new_db_world`), Maven build at `C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd`.

**Branch:** `feat/user-cinema-activity-tracking` (already exists, contains the design spec). Phase 1 work commits onto this branch. Subsequent phases will branch off `dev_acc` separately.

**Reference spec:** `docs/superpowers/specs/2026-05-26-user-cinema-activity-production-tracking-design.md` — Phase 1 section.

---

## File Structure

**Backend Java (modify):**
- `db-world-backend/src/main/java/com/db/dbworld/audit/activity/entity/UserCinemaActivityEntity.java`
  - Add `watchProgressId` field (plain `Long`, not `@ManyToOne` — see spec for rationale)
  - Remove 5 fields: `httpProtocol`, `referer`, `countryCode`, `errorCode`, `updateCount`
- `db-world-backend/src/main/java/com/db/dbworld/audit/activity/service/UserCinemaActivityService.java`
  - Remove any references to the 5 dropped fields (writes, reads, or both)
- `db-world-backend/src/main/java/com/db/dbworld/audit/activity/repository/UserCinemaActivityRepository.java`
  - Remove any repository methods that reference the dropped fields

**Backend Java (create):**
- `db-world-backend/src/main/java/com/db/dbworld/audit/activity/shipper/LogShipperStateEntity.java`
  - Singleton state entity for the log shipper (table created by Hibernate). Phase 2 will add the repository and service.

**SQL migrations (create):**
- `db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase1_predeploy.sql`
  - Backfill `record_id` and `media_file_id` on orphan rows via JOIN with `media_files`
- `db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase2_postdeploy.sql`
  - Add FK constraint on `watch_progress_id`, drop 5 unused columns

**Testing:** No automated tests in Phase 1 (project has no test infrastructure yet). Verification is via Maven compile + manual schema inspection. Phase 2 will introduce the test directory and the first JUnit tests.

---

## Working Agreements

- Commit after each task completes successfully. Commit messages match the existing repo style (lowercase, type prefix `feat`/`fix`/`refactor`/`chore`, no scope parens, short subject line, multi-line body for context). Co-author trailer per global rule.
- Maven shorthand: `$MVN = "C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd"`. Run via `& $MVN ...` in PowerShell or quote the full path in bash.
- Schema target throughout: `new_db_world`.
- Do not run the migration SQL files yourself. They are operator-run. Verify they parse cleanly by reading them; do not execute against the live DB.

---

## Task 1 — Confirm starting branch state

**Files:** none (verification only)

- [ ] **Step 1: Confirm current branch is `feat/user-cinema-activity-tracking` and the spec is committed**

```powershell
git status
git log --oneline -3
```

Expected: branch `feat/user-cinema-activity-tracking`, top commit message contains "add design spec for production-grade user_cinema_activity tracking".

- [ ] **Step 2: Confirm clean working tree (local config noise OK, no staged work)**

Expected: no staged changes; untracked files like `.claude/*`, `MySqlDb/`, `.cursorrules`, etc. are fine (they're local config not under version control intent).

If staged changes exist that aren't the spec doc, stop and ask the user before continuing.

---

## Task 2 — Create `LogShipperStateEntity`

**Files:**
- Create: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/shipper/LogShipperStateEntity.java`

- [ ] **Step 1: Create the entity file with the content below**

```java
package com.db.dbworld.audit.activity.shipper;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "LOG_SHIPPER_STATE", schema = "new_db_world")
public class LogShipperStateEntity {

    /** Singleton row — always id = 1. */
    @Id
    @Column(name = "id")
    private Byte id = (byte) 1;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Column(name = "inode", nullable = false)
    private Long inode = 0L;

    @Column(name = "byte_offset", nullable = false)
    private Long byteOffset = 0L;

    @Column(name = "last_processed_at")
    private Instant lastProcessedAt;
}
```

- [ ] **Step 2: Compile to verify the class is valid**

```powershell
& "C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" -f db-world-backend/pom.xml compile -q -DskipTests
```

Expected: exit code 0, no compile errors.

- [ ] **Step 3: Commit**

```powershell
git add db-world-backend/src/main/java/com/db/dbworld/audit/activity/shipper/LogShipperStateEntity.java
git commit -m @'
feat add LogShipperStateEntity for nginx log shipper checkpointing

Singleton entity, table auto-created by Hibernate ddl-auto.
Holds inode and byte offset so the shipper resumes after restarts
and detects log rotation. Repository and service follow in Phase 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 3 — Add `watchProgressId` field to `UserCinemaActivityEntity`

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/entity/UserCinemaActivityEntity.java`

- [ ] **Step 1: Add a new index entry to the existing `@Table` `indexes` array**

In the `@Table(... indexes = { ... })` block at the top of the class, append one more index entry inside the array, after the last existing index (currently `idx_uca_user_completed`):

```java
@Index(name = "idx_uca_watch_progress", columnList = "watch_progress_id"),
```

- [ ] **Step 2: Add the field declaration**

Find the section `/* ============================================================ PRODUCTION TRACKING — added 2026-05-21 ============================================================ */`. Append this field at the very end of the class body, just before the closing `}` of the entity (and after `avgSpeedBps`):

```java
/**
 * FK to watch_progress.id, populated for STREAM activities only.
 * Plain Long (not @ManyToOne) to avoid lazy proxy overhead — read-time joins
 * happen via repository queries with explicit LEFT JOIN. FK constraint is
 * added by user_cinema_activity_v3_phase2_postdeploy.sql.
 */
@Column(name = "watch_progress_id")
private Long watchProgressId;
```

- [ ] **Step 3: Compile**

```powershell
& "C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" -f db-world-backend/pom.xml compile -q -DskipTests
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```powershell
git add db-world-backend/src/main/java/com/db/dbworld/audit/activity/entity/UserCinemaActivityEntity.java
git commit -m @'
feat add watch_progress_id FK column to user_cinema_activity

Nullable Long field for STREAM activities to reference the live cursor
in watch_progress. Plain field, not @ManyToOne, to avoid lazy proxy
overhead. FK constraint added by v3 phase2 SQL post-deploy. Index added
so JOINs from watch_progress are cheap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 4 — Write pre-deploy SQL: backfill `record_id` / `media_file_id`

**Files:**
- Create: `db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase1_predeploy.sql`

- [ ] **Step 1: Create the SQL file with the content below**

```sql
-- =============================================================================
-- user_cinema_activity v3 — PHASE 1: PRE-DEPLOY BACKFILL
-- =============================================================================
-- Run this BEFORE deploying the v3 build.
--
-- Purpose: legacy rows created before record_id / media_file_id were added
-- (v2 era) have NULLs in those columns. Subsequent phases (the log shipper
-- and the recommendation rails) depend on record_id being populated. This
-- script fills them in from media_files using file_path as the join key.
--
-- After this runs and step 3 returns 0, deploy the v3 build. Then run
-- user_cinema_activity_v3_phase2_postdeploy.sql.
--
-- Schema: new_db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. DRY-RUN: how many rows are missing record_id and have a match in media_files? ----
SELECT COUNT(*) AS rows_to_be_backfilled
FROM new_db_world.user_cinema_activity uca
JOIN new_db_world.media_files mf ON mf.file_path = uca.file_path
WHERE uca.record_id IS NULL;

-- ---- 2. PERFORM the backfill ----
UPDATE new_db_world.user_cinema_activity uca
JOIN new_db_world.media_files mf ON mf.file_path = uca.file_path
SET uca.record_id     = mf.record_id,
    uca.media_file_id = mf.id
WHERE uca.record_id IS NULL;

-- ---- 3. VERIFY: should return 0 (rows with file_path matching media_files that still lack record_id) ----
SELECT COUNT(*) AS still_missing_record_id_with_match
FROM new_db_world.user_cinema_activity uca
JOIN new_db_world.media_files mf ON mf.file_path = uca.file_path
WHERE uca.record_id IS NULL;

-- ---- 4. REPORT: rows still missing record_id because file_path has no match in media_files ----
-- (these are orphan activity rows — file was deleted or path drifted; they stay null and
--  are tolerated by Phase 3's LEFT JOIN. No further action required.)
SELECT COUNT(*) AS orphan_rows_no_match
FROM new_db_world.user_cinema_activity uca
LEFT JOIN new_db_world.media_files mf ON mf.file_path = uca.file_path
WHERE uca.record_id IS NULL
  AND mf.id IS NULL;
```

- [ ] **Step 2: Verify the file is syntactically reasonable by reading it back**

```powershell
Get-Content "db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase1_predeploy.sql" | Measure-Object -Line
```

Expected: ~30+ lines, no errors reading the file.

- [ ] **Step 3: Commit**

```powershell
git add db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase1_predeploy.sql
git commit -m @'
chore add v3 phase1 pre-deploy SQL for record_id media_file_id backfill

Backfills legacy rows whose file_path matches a row in media_files but
whose record_id is null. Operator runs this BEFORE deploying the v3
build. Orphan rows (no media_files match) remain null and are tolerated
by downstream LEFT JOINs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 5 — Remove 5 unused fields from `UserCinemaActivityEntity`

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/entity/UserCinemaActivityEntity.java`

- [ ] **Step 1: Delete the 5 field declarations and their `@Column` annotations**

Remove the following fields from the entity. Each is currently a `@Column(...) private <type> <name>;` block including the preceding Javadoc comment. Delete the comment block AND the field for each:

1. `httpProtocol` — lines around 165–166 (the field with `@Column(name = "http_protocol", length = 8)`)
2. `referer` — the field with `@Column(name = "referer", length = 512)`
3. `countryCode` — the field with `@Column(name = "country_code", length = 2)`
4. `errorCode` — the field with `@Column(name = "error_code", length = 64)`
5. `updateCount` — the field declared as `@Column private Integer updateCount;`

After deletion, the section that previously held production-tracking columns ends with `avgSpeedBps` immediately followed by the new `watchProgressId` from Task 3.

- [ ] **Step 2: Compile to surface any references that break**

```powershell
& "C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" -f db-world-backend/pom.xml compile -q -DskipTests 2>&1 | Tee-Object -Variable buildOut | Select-Object -Last 60
```

Expected: compile errors at every site that still references the deleted fields. The next two tasks address those sites.

If compile **passes**, the fields had no references — proceed directly to Step 3.

- [ ] **Step 3: Commit (only if compile already passes; otherwise commit after Task 7)**

If compile is clean: 

```powershell
git add db-world-backend/src/main/java/com/db/dbworld/audit/activity/entity/UserCinemaActivityEntity.java
git commit -m @'
refactor remove 5 unused columns from UserCinemaActivityEntity

Drops httpProtocol, referer, countryCode, errorCode, updateCount.
None are read by any code path; the nginx log format does not expose
http_protocol/referer/country_code, and error_code overlaps with
completion_status=ABORTED. update_count was a derived counter never
read. Physical column drops happen in v3 phase2 post-deploy SQL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

Otherwise hold off and proceed to Task 6.

---

## Task 6 — Clean up references in `UserCinemaActivityService`

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/service/UserCinemaActivityService.java`

- [ ] **Step 1: Read the file to find references**

```powershell
Select-String -Path "db-world-backend/src/main/java/com/db/dbworld/audit/activity/service/UserCinemaActivityService.java" -Pattern "httpProtocol|referer|countryCode|errorCode|updateCount|setHttpProtocol|setReferer|setCountryCode|setErrorCode|setUpdateCount|getHttpProtocol|getReferer|getCountryCode|getErrorCode|getUpdateCount"
```

This lists every line that references the dropped fields.

- [ ] **Step 2: For each line returned, delete it**

The Phase 2 spec confirmed (via earlier grep at design time) that `trackDownloadActivity` and `trackStreamActivity` are dead code with no callers. References to the dropped fields are most likely inside those dead methods.

**If** the references are inside `trackDownloadActivity` or `trackStreamActivity`: leave the methods as-is for now and only delete the lines that touch the dropped fields. The dead methods themselves will be deleted in Phase 2.

**If** references appear elsewhere (e.g., inside `trackResolveActivity` or `markDownloadComplete`): delete the offending line. The values were never read; deletion is safe.

- [ ] **Step 3: Compile**

```powershell
& "C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" -f db-world-backend/pom.xml compile -q -DskipTests
```

Expected: compile errors in the service file are resolved. If errors remain (e.g., in `UserCinemaActivityRepository.java`), proceed to Task 7 before committing.

- [ ] **Step 4: Hold off committing — Task 7 may add more changes to the same files. If Task 7 has no work to do, commit now per Task 5 Step 3's message.**

---

## Task 7 — Clean up references in `UserCinemaActivityRepository`

**Files:**
- Modify: `db-world-backend/src/main/java/com/db/dbworld/audit/activity/repository/UserCinemaActivityRepository.java`

- [ ] **Step 1: Find references**

```powershell
Select-String -Path "db-world-backend/src/main/java/com/db/dbworld/audit/activity/repository/UserCinemaActivityRepository.java" -Pattern "httpProtocol|referer|countryCode|errorCode|updateCount|http_protocol|country_code|error_code|update_count"
```

- [ ] **Step 2: For each line returned, delete the line OR the entire query method**

Repository methods are usually `@Query` declarations or method-name-derived queries. If a method's name or SQL contains a dropped field, delete the whole method (it would no longer compile). It was unused — no caller relied on it (the same field has no service-level references after Task 6).

- [ ] **Step 3: Compile**

```powershell
& "C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" -f db-world-backend/pom.xml compile -q -DskipTests
```

Expected: exit code 0.

- [ ] **Step 4: Stage all entity + service + repository changes and commit**

If Task 5 Step 3 was skipped (compile didn't pass after just the entity edit), commit everything together now:

```powershell
git add db-world-backend/src/main/java/com/db/dbworld/audit/activity/entity/UserCinemaActivityEntity.java db-world-backend/src/main/java/com/db/dbworld/audit/activity/service/UserCinemaActivityService.java db-world-backend/src/main/java/com/db/dbworld/audit/activity/repository/UserCinemaActivityRepository.java
git commit -m @'
refactor remove 5 unused columns from UserCinemaActivityEntity and callers

Drops httpProtocol, referer, countryCode, errorCode, updateCount from
the entity. Removes the matching writes in UserCinemaActivityService
and any query methods on UserCinemaActivityRepository that referenced
them. Nothing in live code paths read these columns. Physical column
drops happen in v3 phase2 post-deploy SQL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

If Task 5 already committed cleanly, commit only the service + repository changes here:

```powershell
git add db-world-backend/src/main/java/com/db/dbworld/audit/activity/service/UserCinemaActivityService.java db-world-backend/src/main/java/com/db/dbworld/audit/activity/repository/UserCinemaActivityRepository.java
git commit -m @'
refactor remove dead references to 5 dropped activity columns

Cleanup follow-on to the UserCinemaActivityEntity field removal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 8 — Write post-deploy SQL: add FK constraint + drop 5 columns

**Files:**
- Create: `db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase2_postdeploy.sql`

- [ ] **Step 1: Create the SQL file with the content below**

```sql
-- =============================================================================
-- user_cinema_activity v3 — PHASE 2: POST-DEPLOY FINALIZE
-- =============================================================================
-- Run this AFTER the v3 build is live in production.
--
-- Purpose:
--   1. Add the FK constraint on watch_progress_id (Hibernate added the column
--      but not the constraint, because the entity field is a plain Long, not
--      @ManyToOne — by design, to avoid proxy overhead on the hot path).
--   2. Physically drop the 5 unused columns that the v3 code no longer reads
--      or writes. Hibernate's ddl-auto: update does NOT drop columns; this is
--      the manual step.
--
-- Schema: new_db_world.
-- =============================================================================

-- ---- 1. SANITY CHECK: confirm watch_progress_id column exists ----
-- (Hibernate adds it on first startup of the v3 build. If this returns 0,
--  the build has not yet been deployed — stop and deploy first.)
SELECT COUNT(*) AS column_exists
FROM information_schema.columns
WHERE table_schema = 'new_db_world'
  AND table_name   = 'user_cinema_activity'
  AND column_name  = 'watch_progress_id';

-- ---- 2. ADD FK CONSTRAINT ----
ALTER TABLE new_db_world.user_cinema_activity
    ADD CONSTRAINT fk_uca_watch_progress
        FOREIGN KEY (watch_progress_id) REFERENCES new_db_world.watch_progress(id)
        ON DELETE SET NULL;

-- ---- 3. DROP 5 UNUSED COLUMNS ----
-- These were declared on the entity until v2 but never read/written by
-- live code. The nginx log format does not expose the data needed to
-- populate http_protocol/referer/country_code; error_code overlapped
-- with completion_status=ABORTED; update_count was a derived counter
-- never read.
ALTER TABLE new_db_world.user_cinema_activity
    DROP COLUMN http_protocol,
    DROP COLUMN referer,
    DROP COLUMN country_code,
    DROP COLUMN error_code,
    DROP COLUMN update_count;

-- ---- 4. VERIFY: count remaining columns ----
-- (Spot-check that the 5 columns are gone and watch_progress_id is present.)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'new_db_world'
  AND table_name   = 'user_cinema_activity'
ORDER BY ordinal_position;
```

- [ ] **Step 2: Verify the file is syntactically reasonable**

```powershell
Get-Content "db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase2_postdeploy.sql" | Measure-Object -Line
```

Expected: ~50+ lines, no errors.

- [ ] **Step 3: Commit**

```powershell
git add db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase2_postdeploy.sql
git commit -m @'
chore add v3 phase2 post-deploy SQL for FK constraint and column drops

Adds the FK constraint on watch_progress_id (Hibernate creates the
column but not the constraint because the entity field is plain Long
by design). Physically drops the 5 unused columns Hibernate cannot
drop via ddl-auto: update.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
'@
```

---

## Task 9 — Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full clean compile and package check**

```powershell
& "C:/Users/bhavya.dudhia/.m2/wrapper/dists/apache-maven-3.9.4-bin/2vqnav6ufo1qvo5j2um40861m/apache-maven-3.9.4/bin/mvn.cmd" -f db-world-backend/pom.xml clean compile -q
```

Expected: exit code 0.

- [ ] **Step 2: Review the full diff against `dev_acc`**

```powershell
git log --oneline dev_acc..HEAD
git diff dev_acc...HEAD --stat
```

Expected commits (titles only, in order):
- add design spec for production-grade user_cinema_activity tracking
- feat add LogShipperStateEntity for nginx log shipper checkpointing
- feat add watch_progress_id FK column to user_cinema_activity
- chore add v3 phase1 pre-deploy SQL for record_id media_file_id backfill
- refactor remove ... (one or two commits depending on whether Task 5 committed early)
- chore add v3 phase2 post-deploy SQL for FK constraint and column drops

Expected files in `git diff --stat`:
- `db-world-backend/src/main/java/com/db/dbworld/audit/activity/entity/UserCinemaActivityEntity.java` (modified)
- `db-world-backend/src/main/java/com/db/dbworld/audit/activity/service/UserCinemaActivityService.java` (modified — only if Task 6 had work)
- `db-world-backend/src/main/java/com/db/dbworld/audit/activity/repository/UserCinemaActivityRepository.java` (modified — only if Task 7 had work)
- `db-world-backend/src/main/java/com/db/dbworld/audit/activity/shipper/LogShipperStateEntity.java` (new)
- `db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase1_predeploy.sql` (new)
- `db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase2_postdeploy.sql` (new)
- `docs/superpowers/specs/2026-05-26-user-cinema-activity-production-tracking-design.md` (new, from earlier)

- [ ] **Step 3: Hand the branch back to the user with explicit operator instructions**

Print the message below verbatim for the user:

```
Phase 1 implementation complete on branch feat/user-cinema-activity-tracking.

To deploy:

1. (Operator) Connect to the prod MySQL and run:
     db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase1_predeploy.sql
   Confirm step 3 returns 0 ("still_missing_record_id_with_match").
   Step 4 may return a non-zero "orphan_rows_no_match" — that is expected
   and tolerated by downstream code.

2. Deploy the new build. On first startup, Hibernate will:
     - Add the watch_progress_id column to user_cinema_activity
     - Create the log_shipper_state table
   No data movement; should be fast.

3. (Operator) Run:
     db-world-backend/src/main/resources/db/migration/user_cinema_activity_v3_phase2_postdeploy.sql
   Step 1 must return column_exists = 1. If 0, the new build did not deploy
   correctly — stop and investigate before running the rest.

4. Smoke test: hit /resolve as a user, confirm the row in user_cinema_activity
   has the new shape (5 dropped columns gone, watch_progress_id present, null
   for now until Phase 3 populates it).

Phase 1 done. Push the branch and merge to dev_acc when ready. Phase 2 plan
will be written off a fresh branch.
```

Do NOT push or merge — the user controls that step per the project's branch workflow rule.

---

## Out of scope for Phase 1 (explicit)

- Repository methods for `LogShipperStateEntity` — added in Phase 2.
- Any service/scheduler/code that uses the new column or table — added in Phase 2 (log shipper) and Phase 3 (FK bridge).
- Test infrastructure — introduced in Phase 2 alongside the log shipper unit tests.
- Frontend changes — none in Phase 1.
- Recommendation rails — none in Phase 1.
