-- =============================================================================
-- user_cinema_activity v2 — PHASE 1: PRE-DEPLOY DEDUP
-- =============================================================================
-- Run this BEFORE deploying the new build. Uses only columns that already exist
-- on the live schema, so it works whether or not Hibernate has run yet.
--
-- Purpose: collapse rows that would violate the new unique key
-- uk_user_file_activity (user_id, file_path, activity_type). Hibernate refuses
-- to add the constraint if duplicates exist.
--
-- After this runs and step 4 returns 0, deploy the new build. Then run
-- user_cinema_activity_v2_phase2_postdeploy.sql to backfill the new columns.
--
-- Schema: new_db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. DRY-RUN: how many duplicates do you have? --------------------------
SELECT
    COUNT(*) AS duplicate_clusters,
    SUM(c) - COUNT(*) AS rows_to_be_deleted
FROM (
    SELECT user_id, file_path, activity_type, COUNT(*) AS c
    FROM new_db_world.user_cinema_activity
    GROUP BY user_id, file_path, activity_type
    HAVING COUNT(*) > 1
) AS dupes;

-- ---- 2. COLLAPSE duplicates -------------------------------------------------
-- Picks the OLDEST id (smallest) as the canonical row, sums bytes_transferred
-- and update_count from the duplicates into it, then deletes the rest.
-- Atomic via START TRANSACTION / COMMIT.

START TRANSACTION;

-- 2a. Build aggregates per cluster into a temp table
DROP TEMPORARY TABLE IF EXISTS _uca_aggregates;
CREATE TEMPORARY TABLE _uca_aggregates AS
SELECT
    MIN(id) AS canonical_id,
    user_id,
    file_path,
    activity_type,
    SUM(COALESCE(bytes_transferred, 0)) AS total_bytes,
    SUM(COALESCE(update_count, 0))      AS total_updates,
    MAX(last_updated)                   AS latest_update,
    MIN(created_time)                   AS earliest_seen
FROM new_db_world.user_cinema_activity
GROUP BY user_id, file_path, activity_type
HAVING COUNT(*) > 1;

-- 2b. Roll the aggregate into the canonical row
UPDATE new_db_world.user_cinema_activity uca
JOIN   _uca_aggregates agg ON agg.canonical_id = uca.id
SET    uca.bytes_transferred = agg.total_bytes,
       uca.update_count      = agg.total_updates,
       uca.last_updated      = agg.latest_update;

-- 2c. Delete the non-canonical duplicates
DELETE uca
FROM   new_db_world.user_cinema_activity uca
JOIN   _uca_aggregates agg
       ON  uca.user_id       = agg.user_id
       AND uca.file_path     = agg.file_path
       AND uca.activity_type = agg.activity_type
       AND uca.id           <> agg.canonical_id;

DROP TEMPORARY TABLE IF EXISTS _uca_aggregates;

COMMIT;

-- ---- 3. Sanity check -- must return 0 --------------------------------------
SELECT COUNT(*) AS remaining_clusters
FROM (
    SELECT 1
    FROM new_db_world.user_cinema_activity
    GROUP BY user_id, file_path, activity_type
    HAVING COUNT(*) > 1
) AS x;

-- If remaining_clusters = 0, you're safe to deploy the new build.
-- After deploy, run phase 2 to backfill record_id / media_file_id.
