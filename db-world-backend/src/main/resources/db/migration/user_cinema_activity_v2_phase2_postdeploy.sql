-- =============================================================================
-- user_cinema_activity v2 — PHASE 2: POST-DEPLOY BACKFILL
-- =============================================================================
-- Run this AFTER the new build has started (and Hibernate has added the new
-- columns + unique constraint + indexes). It backfills:
--   * record_id from media_files.record_id (matched on file_path)
--   * media_file_id from media_files.id
--
-- Existing tracking columns are left alone — Hibernate's update mode preserves
-- their data when adding columns alongside.
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. Quick sanity: columns exist? --------------------------------------
-- This SELECT will error if the new build hasn't deployed yet. Stop and deploy
-- first if you see "Unknown column 'record_id'".
SELECT
    COUNT(*) AS total_rows,
    SUM(record_id IS NOT NULL)                         AS already_with_record_id,
    SUM(media_file_id IS NOT NULL)                     AS already_with_media_file_id
FROM db_world.user_cinema_activity;

-- ---- 2. Backfill record_id + media_file_id from media_files ---------------
-- Only touches rows that are still NULL — safe to re-run.

UPDATE db_world.user_cinema_activity uca
JOIN   db_world.media_files mf ON mf.file_path = uca.file_path
SET    uca.record_id     = COALESCE(uca.record_id,     mf.record_id),
       uca.media_file_id = COALESCE(uca.media_file_id, mf.id)
WHERE  uca.record_id IS NULL OR uca.media_file_id IS NULL;

-- ---- 3. Report --------------------------------------------------------------
SELECT
    COUNT(*)                                                AS total_rows,
    SUM(record_id IS NOT NULL)                              AS with_record_id,
    SUM(media_file_id IS NOT NULL)                          AS with_media_file_id,
    SUM(record_id IS NULL AND media_file_id IS NULL)        AS unenriched,
    SUM(completion_status = 'COMPLETED')                    AS completed_sessions,
    SUM(activity_type = 'DOWNLOAD')                         AS download_rows,
    SUM(activity_type = 'STREAM')                           AS stream_rows
FROM db_world.user_cinema_activity;

-- 'unenriched' rows are activity entries whose file_path doesn't match any
-- media_files row. That's expected for activities on files that have since been
-- removed, or for files ingested with a different path format. They stay in the
-- table for audit purposes but won't drive the "Because you watched" rail.
