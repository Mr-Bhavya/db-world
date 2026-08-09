-- =============================================================================
-- record visibility lifecycle — replace hide_from_rails with a visibility enum
-- =============================================================================
-- Adds `visibility` (DRAFT | PUBLISHED | UNLISTED) and `new_release_notified_at`
-- to `records`, backfills them from the legacy `hide_from_rails` boolean, and
-- drops that column. This replaces the (removed) boot-time RecordVisibilityMigration
-- — run it by hand as part of deploying the record-publish-visibility feature.
--
-- Idempotent + re-runnable, and safe to run BEFORE or AFTER the new build boots
-- (Hibernate ddl-auto=update also adds the two columns; this tolerates that).
-- Recommended: run it WITH the deploy so existing records stay exactly as visible
-- as they are today and record creation never hits the NOT-NULL hide_from_rails.
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. Add `visibility` (nullable) if it isn't there yet -------------------
SET @add_visibility := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'records' AND COLUMN_NAME = 'visibility'
);
SET @sql := IF(@add_visibility,
    'ALTER TABLE db_world.records ADD COLUMN visibility VARCHAR(20) NULL',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 2. Add `new_release_notified_at` (nullable) if missing -----------------
-- The "new title" push dedup marker (Instant → DATETIME(6), matching created_at).
SET @add_nra := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'records' AND COLUMN_NAME = 'new_release_notified_at'
);
SET @sql := IF(@add_nra,
    'ALTER TABLE db_world.records ADD COLUMN new_release_notified_at DATETIME(6) NULL',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 3. Backfill visibility from the legacy hide_from_rails column ----------
-- Only while it still exists. hide_from_rails = 1 → UNLISTED (was searchable but
-- off the rails); anything else → PUBLISHED (was fully live).
SET @has_hfr := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'records' AND COLUMN_NAME = 'hide_from_rails'
);
SET @sql := IF(@has_hfr > 0,
    'UPDATE db_world.records SET visibility = CASE WHEN hide_from_rails = 1 THEN ''UNLISTED'' ELSE ''PUBLISHED'' END WHERE visibility IS NULL',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 4. Any still-null visibility (legacy column already gone) → PUBLISHED --
-- The pre-existing catalogue is live; only NEW records (created by the app after
-- this migration) start as DRAFT.
UPDATE db_world.records SET visibility = 'PUBLISHED' WHERE visibility IS NULL;

-- ---- 5. Mark the existing catalogue as already-announced --------------------
-- So publishing/backfill never fires a burst of "new title" push notifications.
UPDATE db_world.records
SET    new_release_notified_at = created_at
WHERE  new_release_notified_at IS NULL AND visibility <> 'DRAFT';

-- ---- 6. Drop the legacy hide_from_rails column ------------------------------
SET @sql := IF(@has_hfr > 0,
    'ALTER TABLE db_world.records DROP COLUMN hide_from_rails',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 7. Verify --------------------------------------------------------------
-- Expect a `visibility` column, a `new_release_notified_at` column, and NO
-- `hide_from_rails`; every row should have a non-null visibility.
SHOW COLUMNS FROM db_world.records;
SELECT visibility, COUNT(*) AS n FROM db_world.records GROUP BY visibility;
