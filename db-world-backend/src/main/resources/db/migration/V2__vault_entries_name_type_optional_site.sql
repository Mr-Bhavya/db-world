-- V2: vault entries get a name and a type, the website becomes optional, custom-field values get room.
--
-- Written to be safe in every state the database can be in, because Flyway runs BEFORE Hibernate:
--   * fresh install: the tables do not exist yet, every step does nothing, Hibernate creates them
--     with the new columns afterwards;
--   * production today: the tables exist without the new columns, the steps add them;
--   * a development database Hibernate already updated: the columns exist, the steps do nothing.
-- Each step is "run this statement only if it is needed", via a prepared statement.

-- 1. credential_custom_fields.field_value: VARCHAR(512) -> LONGTEXT.
--    The value is AES + base64 encoded, so a 3 KB SSH private key needs ~4.5 KB.
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credential_custom_fields'
        AND COLUMN_NAME = 'field_value' AND DATA_TYPE <> 'longtext') > 0,
    'ALTER TABLE credential_custom_fields MODIFY COLUMN field_value LONGTEXT NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

-- 2. credentials.name: what the user calls the entry. NULL on old rows; the app then shows the host.
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials' AND COLUMN_NAME = 'name') = 0,
    'ALTER TABLE credentials ADD COLUMN `name` VARCHAR(512) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

-- 3. credentials.type: LOGIN / SERVER / NOTE. A plain VARCHAR on purpose: Hibernate would create an
--    ENUM column, and adding a value later (PASSKEY) would then need another ALTER.
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials' AND COLUMN_NAME = 'type') = 0,
    'ALTER TABLE credentials ADD COLUMN `type` VARCHAR(16) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

-- 4. Entries saved before types existed are logins.
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credentials' AND COLUMN_NAME = 'type') > 0,
    'UPDATE credentials SET `type` = ''LOGIN'' WHERE `type` IS NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

-- 5. password_manager.host must allow NULL: an entry with no website has no host.
--    Hibernate creates the column nullable, so this normally does nothing.
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_manager'
        AND COLUMN_NAME = 'host' AND IS_NULLABLE = 'NO') > 0,
    (SELECT CONCAT('ALTER TABLE password_manager MODIFY COLUMN `host` ', COLUMN_TYPE, ' NULL')
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_manager' AND COLUMN_NAME = 'host'),
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;
