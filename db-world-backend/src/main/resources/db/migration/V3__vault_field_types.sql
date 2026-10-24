-- V3: custom fields get a type (HIDDEN, TEXT, URL, MULTILINE).
--
-- Same rules as V2: Flyway runs BEFORE Hibernate, so each step runs only if it is needed.
--   * fresh install: the table does not exist yet, both steps do nothing, Hibernate creates it
--     with the column afterwards;
--   * production today: the table exists without the column, the steps add it and fill it;
--   * a development database Hibernate already updated: the column exists, only the backfill runs.

-- 1. credential_custom_fields.field_type. A plain VARCHAR on purpose (see V2, credentials.type):
--    Hibernate would create an ENUM column and a new kind of field would then need another ALTER.
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credential_custom_fields') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credential_custom_fields' AND COLUMN_NAME = 'field_type') = 0,
    'ALTER TABLE credential_custom_fields ADD COLUMN `field_type` VARCHAR(16) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

-- 2. Fields saved before types existed were all masked, which is what HIDDEN means.
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credential_custom_fields' AND COLUMN_NAME = 'field_type') > 0,
    'UPDATE credential_custom_fields SET `field_type` = ''HIDDEN'' WHERE `field_type` IS NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;
