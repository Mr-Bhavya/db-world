-- ============================================================================
-- media_files: index file_path via a CRC32 hash column
-- ----------------------------------------------------------------------------
-- WHY
--   file_path is VARCHAR(1000). On utf8mb4 that is up to 4000 bytes, so
--   (record_id, file_path) is ~4008 bytes and blows past MySQL's index
--   key-length limit (3072 bytes InnoDB DYNAMIC / 767 bytes older). The
--   unique key therefore may never have been created, and every file_path
--   lookup did a full table scan.
--
--   We add file_path_hash = CRC32(file_path), index THAT, and move the
--   uniqueness key onto (record_id, file_path_hash). The app computes the
--   same value with java.util.zip.CRC32 over UTF-8 bytes (MediaFileEntity
--   .hashPath), so DB and app agree — every lookup is `hash = ? AND
--   file_path = ?` (the path check neutralises the rare CRC32 collision).
--
-- WHEN
--   Run this BEFORE deploying the backend build that expects the column, so
--   there is never a window where the app queries by a hash that legacy rows
--   lack. The old code ignores the new column, so it is safe to run early.
--
-- SAFETY
--   Idempotent — every step guards on information_schema and can be re-run.
-- ============================================================================

-- 1. Add the column (nullable first: instant metadata-only change, backfillable).
SET @col := (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_schema = 'db_world' AND table_name = 'media_files'
               AND column_name = 'file_path_hash');
SET @sql := IF(@col = 0,
    'ALTER TABLE db_world.media_files ADD COLUMN file_path_hash BIGINT NULL',
    'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. Backfill. MySQL CRC32() == java.util.zip.CRC32 over the same UTF-8 bytes.
UPDATE db_world.media_files
   SET file_path_hash = CRC32(file_path)
 WHERE file_path_hash IS NULL;

-- 3. Enforce NOT NULL now that every row has a value.
ALTER TABLE db_world.media_files
    MODIFY COLUMN file_path_hash BIGINT NOT NULL;

-- 4. Lookup index (used by findByFilePath / deleteByFilePath / activity tracking).
SET @ix := (SELECT COUNT(*) FROM information_schema.statistics
            WHERE table_schema = 'db_world' AND table_name = 'media_files'
              AND index_name = 'idx_media_files_path_hash');
SET @sql := IF(@ix = 0,
    'ALTER TABLE db_world.media_files ADD INDEX idx_media_files_path_hash (file_path_hash)',
    'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 5. Drop the old (record_id, file_path) unique key if it exists — it may never
--    have been created (see WHY). Harmless when absent.
SET @uk := (SELECT COUNT(*) FROM information_schema.statistics
            WHERE table_schema = 'db_world' AND table_name = 'media_files'
              AND index_name = 'uq_media_file_record_path');
SET @sql := IF(@uk > 0,
    'ALTER TABLE db_world.media_files DROP INDEX uq_media_file_record_path',
    'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 6. Add the hash-based unique key — but ONLY if there are no pre-existing
--    duplicate (record_id, file_path) rows (a known outcome of buggy ingestion
--    runs). NULL record_id is excluded: UNIQUE treats NULLs as distinct, so
--    unassigned files never conflict. If duplicates exist the key is skipped
--    and a note is emitted; dedupe with the diagnostic below, then re-run.
SET @dupes := (SELECT COUNT(*) FROM (
    SELECT record_id, file_path_hash
      FROM db_world.media_files
     WHERE record_id IS NOT NULL
     GROUP BY record_id, file_path_hash
    HAVING COUNT(*) > 1
) d);
SET @uk2 := (SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = 'db_world' AND table_name = 'media_files'
               AND index_name = 'uq_media_file_record_path_hash');
SET @sql := IF(@dupes = 0 AND @uk2 = 0,
    'ALTER TABLE db_world.media_files
        ADD CONSTRAINT uq_media_file_record_path_hash UNIQUE (record_id, file_path_hash)',
    CONCAT('SELECT ', @dupes, ' AS duplicate_groups_skipping_unique_key'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── Diagnostic: list duplicate (record_id, file_path) groups to clean up ─────
-- SELECT record_id, file_path, COUNT(*) AS n
--   FROM db_world.media_files
--  WHERE record_id IS NOT NULL
--  GROUP BY record_id, file_path
-- HAVING COUNT(*) > 1;
