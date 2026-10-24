-- V4: vault entries can be moved to Trash. credentials.deleted_at is when it happened; NULL is a live
-- entry, so every row that exists today stays in the vault untouched.
--
-- Same rules as V2 and V3: Flyway runs BEFORE Hibernate, so each step runs only if it is needed.
--   * fresh install: the table does not exist yet, both steps do nothing, Hibernate creates the table
--     with the column and the index afterwards;
--   * production today: the table exists without the column, the steps add the column and the index;
--   * a development database Hibernate already updated: the column and the index exist, nothing runs.

-- 1. credentials.deleted_at. DATETIME(6) is what Hibernate creates for an Instant on MySQL.
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials' AND COLUMN_NAME = 'deleted_at') = 0,
    'ALTER TABLE credentials ADD COLUMN `deleted_at` DATETIME(6) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

-- 2. The purge job looks entries up by this column ("trashed before the cutoff").
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials' AND COLUMN_NAME = 'deleted_at') > 0
    AND (SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials' AND INDEX_NAME = 'idx_credentials_deleted_at') = 0,
    'CREATE INDEX idx_credentials_deleted_at ON credentials (`deleted_at`)',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;
