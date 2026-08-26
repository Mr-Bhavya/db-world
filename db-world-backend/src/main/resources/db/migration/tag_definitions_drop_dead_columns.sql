-- =============================================================================
-- tag_definitions — drop the two write-only columns
-- =============================================================================
-- `pool_size` and `refresh_cron` were editable in the admin UI and persisted here,
-- but NOTHING ever read them:
--
--   * pool_size   — each TagStrategy hardcodes its own POOL_SIZE constant, because
--                   the limit is tied to that strategy's scoring formula (TOP_10
--                   keeps 20 so a limitSize=10 rail always fills).
--   * refresh_cron— every row held the same '0 0 */6 * * *' literal. The real
--                   cadence lives in scheduler_job_config and drives TagScheduler
--                   for all tags at once (Scheduler admin page).
--
-- Editing them looked like it did something and never did. Removed rather than
-- wired up, so the Tag Config panel only shows knobs that take effect.
--
-- `active` is NOT dropped — it is now genuinely honoured by
-- TagStrategyExecutor.executeAll(), which skips inactive tags.
--
-- Idempotent + re-runnable. Run AFTER deploying the build that stops referencing
-- these columns (Hibernate ddl-auto=update never drops columns, so an older build
-- would keep working anyway — pool_size is NOT NULL with a default of 30).
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. Drop pool_size -------------------------------------------------------
SET @has_pool := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'tag_definitions'
      AND COLUMN_NAME = 'pool_size'
);
SET @sql := IF(@has_pool > 0,
    'ALTER TABLE db_world.tag_definitions DROP COLUMN pool_size',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 2. Drop refresh_cron ----------------------------------------------------
SET @has_cron := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'tag_definitions'
      AND COLUMN_NAME = 'refresh_cron'
);
SET @sql := IF(@has_cron > 0,
    'ALTER TABLE db_world.tag_definitions DROP COLUMN refresh_cron',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 3. Verify ---------------------------------------------------------------
-- Expect: no pool_size, no refresh_cron; active + default_sort still present.
SHOW COLUMNS FROM db_world.tag_definitions;
SELECT tag_type, display_name, automatic, active, default_sort, default_direction,
       last_refreshed_at
FROM   db_world.tag_definitions
ORDER  BY tag_type;
