-- =============================================================================
-- media requests: season / episode scope
-- =============================================================================
-- A media request used to be one row per (record, kind), which is right for a
-- movie and nearly useless for a series -- "needs files for Breaking Bad" says
-- nothing when seasons 1-3 are already in the library. This adds a scope to the
-- request: whole title, one season, or one episode.
--
--   season_number / episode_number = -1  ->  not scoped ("all")
--   season_number = 0                    ->  Specials (a real season, hence -1
--                                             and not 0 as the sentinel)
--
-- The two columns are NOT NULL with DEFAULT -1 on purpose: the scope is part of
-- the request's uniqueness, and MySQL treats NULLs in a unique index as
-- distinct -- nullable columns would let the same whole-title request be
-- created over and over.
--
-- WHAT THIS FILE MUST DO BY HAND: drop uk_media_request_record_kind. Hibernate
-- (ddl-auto=update) adds columns and adds the new constraint, but it never
-- DROPS anything -- and while the old (record_id, kind) key is still in place,
-- the second scope requested on a record fails with "Duplicate entry".
--
-- Idempotent + re-runnable. Best run WITH the deploy, before the new build
-- boots; step 3 also repairs the case where the app booted first.
--
-- Schema: db_world -- adjust if yours differs.
-- =============================================================================

-- ---- 1. Add season_number ---------------------------------------------------
SET @add_season := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'media_requests' AND COLUMN_NAME = 'season_number'
);
SET @sql := IF(@add_season,
    'ALTER TABLE db_world.media_requests ADD COLUMN season_number INT NOT NULL DEFAULT -1',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 2. Add episode_number --------------------------------------------------
SET @add_episode := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'media_requests' AND COLUMN_NAME = 'episode_number'
);
SET @sql := IF(@add_episode,
    'ALTER TABLE db_world.media_requests ADD COLUMN episode_number INT NOT NULL DEFAULT -1',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 3. Repair rows that predate the columns -------------------------------
-- Rows created before the columns existed are whole-title requests. If THIS
-- script added the columns they already read -1 from the DEFAULT. If the new
-- build booted first, Hibernate's ALTER carries the same DEFAULT -- but an
-- older Hibernate or a hand-run ALTER without it leaves MySQL's implicit 0,
-- which would read as "Specials, episode 0". No UI can produce that scope
-- (episode plates start at 1), so 0/0 is unambiguously a legacy row.
UPDATE db_world.media_requests
SET    season_number = -1, episode_number = -1
WHERE  season_number = 0 AND episode_number = 0;

-- ---- 4. Drop the old (record_id, kind) unique key ---------------------------
-- THE BLOCKING STEP. While this exists, a season request on a record that
-- already has a whole-title request of the same kind is rejected outright.
SET @has_old_uk := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'media_requests'
      AND INDEX_NAME = 'uk_media_request_record_kind'
);
SET @sql := IF(@has_old_uk > 0,
    'ALTER TABLE db_world.media_requests DROP INDEX uk_media_request_record_kind',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 5. Add the scoped unique key ------------------------------------------
-- Hibernate adds this too, but only on a boot AFTER the columns exist; adding
-- it here keeps the schema correct even if the app is never restarted between
-- migration and use.
SET @has_new_uk := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'media_requests'
      AND INDEX_NAME = 'uk_media_request_scope'
);
SET @sql := IF(@has_new_uk = 0,
    'ALTER TABLE db_world.media_requests ADD CONSTRAINT uk_media_request_scope UNIQUE (record_id, kind, season_number, episode_number)',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 6. Verify --------------------------------------------------------------
-- Expect: season_number / episode_number present, NOT NULL, DEFAULT -1;
-- uk_media_request_scope present; uk_media_request_record_kind gone; and every
-- pre-existing request still whole-title (-1 / -1).
SHOW COLUMNS FROM db_world.media_requests;
SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
FROM   information_schema.STATISTICS
WHERE  TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'media_requests'
GROUP  BY INDEX_NAME;
SELECT season_number, episode_number, COUNT(*) AS n
FROM   db_world.media_requests
GROUP  BY season_number, episode_number;
