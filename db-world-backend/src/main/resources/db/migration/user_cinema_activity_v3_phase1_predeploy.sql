-- =============================================================================
-- user_cinema_activity v3 — PHASE 1: PRE-DEPLOY BACKFILL
-- =============================================================================
-- Run this BEFORE deploying the v3 build.
--
-- Purpose: legacy rows created before record_id / media_file_id were added
-- (v2 era) have NULLs in those columns. Subsequent phases (the log shipper
-- and the recommendation rails) depend on record_id being populated. This
-- script fills them in from media_files using file_path as the join key.
--
-- After this runs and step 3 returns 0, deploy the v3 build. Then run
-- user_cinema_activity_v3_phase2_postdeploy.sql.
--
-- Schema: new_db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. DRY-RUN: how many rows are missing record_id and have a match in media_files? ----
SELECT COUNT(*) AS rows_to_be_backfilled
FROM new_db_world.user_cinema_activity uca
JOIN new_db_world.media_files mf ON mf.file_path = uca.file_path
WHERE uca.record_id IS NULL;

-- ---- 2. PERFORM the backfill ----
UPDATE new_db_world.user_cinema_activity uca
JOIN new_db_world.media_files mf ON mf.file_path = uca.file_path
SET uca.record_id     = mf.record_id,
    uca.media_file_id = mf.id
WHERE uca.record_id IS NULL;

-- ---- 3. VERIFY: should return 0 (rows with file_path matching media_files that still lack record_id) ----
SELECT COUNT(*) AS still_missing_record_id_with_match
FROM new_db_world.user_cinema_activity uca
JOIN new_db_world.media_files mf ON mf.file_path = uca.file_path
WHERE uca.record_id IS NULL;

-- ---- 4. REPORT: rows still missing record_id because file_path has no match in media_files ----
-- (these are orphan activity rows — file was deleted or path drifted; they stay null and
--  are tolerated by Phase 3's LEFT JOIN. No further action required.)
SELECT COUNT(*) AS orphan_rows_no_match
FROM new_db_world.user_cinema_activity uca
LEFT JOIN new_db_world.media_files mf ON mf.file_path = uca.file_path
WHERE uca.record_id IS NULL
  AND mf.id IS NULL;