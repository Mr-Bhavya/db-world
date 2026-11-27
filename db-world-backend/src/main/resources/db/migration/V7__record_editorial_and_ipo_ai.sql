-- V7: optional, first-party editorial copy and IPO AI fields.
-- A published record becomes sitemap-eligible only after its note contains at least
-- 300 non-whitespace characters; existing records remain noindex.

SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'records') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'records'
      AND COLUMN_NAME = 'editorial_note') = 0,
    'ALTER TABLE records ADD COLUMN `editorial_note` TEXT NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ipo_listing' AND COLUMN_NAME = 'ai_analysis') = 0
    AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ipo_listing') > 0,
    'ALTER TABLE ipo_listing ADD COLUMN ai_analysis TEXT NULL, ADD COLUMN ai_view VARCHAR(30) NULL, ADD COLUMN ai_confidence_score INT NULL, ADD COLUMN ai_updated_at DATETIME(6) NULL, ADD COLUMN ai_model VARCHAR(100) NULL, ADD COLUMN ai_source_fingerprint VARCHAR(64) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'records' AND COLUMN_NAME = 'ai_verdict') = 0
    AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'records') > 0,
    'ALTER TABLE records ADD COLUMN ai_verdict VARCHAR(30) NULL, ADD COLUMN ai_quality_score INT NULL, ADD COLUMN ai_best_for VARCHAR(1200) NULL, ADD COLUMN ai_considerations VARCHAR(1200) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'records'
      AND COLUMN_NAME = 'editorial_source') = 0
    AND (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'records') > 0,
    'ALTER TABLE records ADD COLUMN `editorial_source` VARCHAR(16) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'records'
      AND COLUMN_NAME = 'editorial_model') = 0
    AND (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'records') > 0,
    'ALTER TABLE records ADD COLUMN `editorial_model` VARCHAR(100) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;

SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'records'
      AND COLUMN_NAME = 'editorial_updated_at') = 0
    AND (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'records') > 0,
    'ALTER TABLE records ADD COLUMN `editorial_updated_at` DATETIME(6) NULL',
    'DO 0'));
PREPARE step FROM @stmt; EXECUTE step; DEALLOCATE PREPARE step;
