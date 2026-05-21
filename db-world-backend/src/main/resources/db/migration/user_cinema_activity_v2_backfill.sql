-- =============================================================================
-- user_cinema_activity v2 backfill — RUN MANUALLY BEFORE DEPLOYING THE NEW BUILD
-- =============================================================================
-- Background
-- ----------
-- The new code adds:
--   * columns: record_id, media_file_id, download_count, stream_count,
--     connection_count, completion_status, completion_percent, last_completed_at,
--     first_seen_at, client_type, http_protocol, referer, country_code, error_code,
--     avg_speed_bps
--   * unique key: uk_user_file_activity (user_id, file_path, activity_type)
--   * indexes: idx_uca_record_type, idx_uca_media_file, idx_uca_user_completed
--
-- Hibernate (ddl-auto=update) WILL add the columns and indexes by itself, but it
-- will REFUSE to add the unique constraint if existing rows violate it. This script:
--   1. Reports how many duplicate clusters exist (read-only — safe to run first).
--   2. Collapses duplicates into one canonical row per (user, file_path, type),
--      summing bytes_transferred and update_count, taking MAX(last_updated).
--   3. Backfills record_id + media_file_id from media_files where the file_path matches.
--
-- After this runs cleanly, deploy the new build. Hibernate will then add the
-- unique constraint and indexes on next startup.
--
-- All statements use new_db_world schema — adjust if your DB names differ.
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
-- Wrap in a transaction so it's atomic.

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

-- 2b. Update the canonical row with the aggregate
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

-- ---- 3. BACKFILL record_id + media_file_id from media_files ----------------
-- Hibernate will have added these columns by now. Match on file_path.
-- Only runs once meaningfully — rows already populated are skipped.

UPDATE new_db_world.user_cinema_activity uca
JOIN   new_db_world.media_files mf ON mf.file_path = uca.file_path
SET    uca.record_id     = COALESCE(uca.record_id,     mf.record_id),
       uca.media_file_id = COALESCE(uca.media_file_id, mf.id)
WHERE  uca.record_id IS NULL OR uca.media_file_id IS NULL;

-- ---- 4. Sanity check --------------------------------------------------------
-- Should return 0 — if not, the unique constraint will fail.
SELECT COUNT(*) AS remaining_clusters
FROM (
    SELECT 1
    FROM new_db_world.user_cinema_activity
    GROUP BY user_id, file_path, activity_type
    HAVING COUNT(*) > 1
) AS x;

-- ---- 5. Reporting -----------------------------------------------------------
SELECT
    COUNT(*)                                                AS total_rows,
    SUM(record_id IS NOT NULL)                              AS with_record_id,
    SUM(media_file_id IS NOT NULL)                          AS with_media_file_id,
    SUM(record_id IS NULL AND media_file_id IS NULL)        AS unenriched,
    SUM(completion_status = 'COMPLETED')                    AS completed_sessions
FROM new_db_world.user_cinema_activity;
