-- =============================================================================
-- record published_at — the date a record first became publicly visible
-- =============================================================================
-- Adds `published_at` to `records` and backfills it for the existing catalogue,
-- so the new "Recently published" rail sort has a real date to order by.
--
-- Why this column exists: `created_at` is when the DRAFT was created (often days
-- or weeks before an admin publishes), and `tmdb_data.primary_date` is the
-- title's own theatrical/air date. Neither answers "what did we just make
-- available?", which is what a "New on DB World" rail needs.
--
-- Idempotent + re-runnable, and safe to run BEFORE or AFTER the new build boots
-- (Hibernate ddl-auto=update also adds the column; this tolerates that).
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. Add `published_at` (nullable) if it isn't there yet ------------------
SET @add_pa := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'records' AND COLUMN_NAME = 'published_at'
);
SET @sql := IF(@add_pa,
    'ALTER TABLE db_world.records ADD COLUMN published_at DATETIME(6) NULL',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 2. Backfill the existing catalogue --------------------------------------
-- Best available proxy, in order of preference:
--   1. new_release_notified_at — when the "new title" push fired, i.e. the record
--      became publicly playable. This is the closest thing to a real publish date.
--   2. created_at — for records published before that marker existed.
-- Only non-DRAFT rows get a date; a DRAFT has never been published, so it stays
-- NULL and gets a real stamp when an admin publishes it.
UPDATE db_world.records
SET    published_at = COALESCE(new_release_notified_at, created_at)
WHERE  published_at IS NULL
  AND  visibility IS NOT NULL
  AND  visibility <> 'DRAFT';

-- ---- 3. Index for the rail sort ---------------------------------------------
-- Rails order by published_at DESC and filter to visibility = 'PUBLISHED' (via the
-- excludeHidden Hibernate filter), so the composite covers both.
SET @add_idx := (
    SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'records'
      AND INDEX_NAME = 'idx_records_visibility_published_at'
);
SET @sql := IF(@add_idx,
    'CREATE INDEX idx_records_visibility_published_at ON db_world.records (visibility, published_at)',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 4. Verify --------------------------------------------------------------
-- Expect: a published_at column, every non-DRAFT row with a non-null date, and
-- DRAFT rows still null.
SHOW COLUMNS FROM db_world.records LIKE 'published_at';
SELECT visibility,
       COUNT(*)                                    AS n,
       SUM(published_at IS NULL)                   AS missing_published_at,
       MIN(published_at)                           AS earliest,
       MAX(published_at)                           AS latest
FROM   db_world.records
GROUP  BY visibility;
