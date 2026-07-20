-- =============================================================================
-- DIAGNOSTIC: Why is the "Because you watched" rail hidden?
-- =============================================================================
-- The rail is filtered out by RailServiceImpl.hasContent when the user has no
-- progress / activity row with a non-null record_id. Run these queries against
-- the prod DB to confirm what's actually there.
--
-- Replace <USER_EMAIL> with the email of the user testing the feature.
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 0. Find your user id --------------------------------------------------
SELECT id, email
FROM   db_world.users
WHERE  email = '<USER_EMAIL>';
-- → use the returned id as :uid in the queries below.

-- ---- 1. Watch-progress signal ----------------------------------------------
SELECT
    COUNT(*)                                        AS wp_rows,
    SUM(record_id IS NOT NULL)                      AS wp_with_record,
    MAX(updated_at)                                 AS wp_last_activity
FROM   db_world.watch_progress
WHERE  user_id = :uid;

-- ---- 2. Activity signal (downloads / streams) ------------------------------
SELECT
    activity_type,
    COUNT(*)                                        AS rows,
    SUM(record_id IS NOT NULL)                      AS with_record,
    SUM(record_id IS NULL)                          AS unenriched,
    MAX(last_updated)                               AS last_activity
FROM   db_world.user_cinema_activity
WHERE  user_id = :uid
GROUP  BY activity_type;

-- ---- 3. Spot-check unenriched rows -----------------------------------------
-- A non-zero unenriched count from step 2 means the file_path of those rows
-- doesn't match any media_files.file_path. Compare a sample to see the drift.
SELECT id, activity_type, file_path
FROM   db_world.user_cinema_activity
WHERE  user_id = :uid AND record_id IS NULL
LIMIT  5;

SELECT id, file_path
FROM   db_world.media_files
LIMIT  5;

-- ---- 4. Same record viewable via the rail's source query? ------------------
-- This is what pickBecauseYouWatchedSource() actually runs. If it returns
-- nothing, the rail is correctly hidden (hasContent = false).
SELECT 'watch_progress' AS source, wp.record_id, wp.updated_at AS activity_at
FROM   db_world.watch_progress wp
WHERE  wp.user_id = :uid AND wp.record_id IS NOT NULL
ORDER  BY wp.updated_at DESC
LIMIT  1
UNION ALL
SELECT 'user_cinema_activity' AS source, uca.record_id, uca.last_updated
FROM   db_world.user_cinema_activity uca
WHERE  uca.user_id = :uid AND uca.record_id IS NOT NULL
ORDER  BY uca.last_updated DESC
LIMIT  1;

-- ---- 5. If both step-1 and step-2 with_record are zero ---------------------
-- The user has no eligible source record. Cause is one of:
--   a. Player hasn't sent a watch-progress save with recordId yet.
--   b. The phase-2 backfill (record_id from media_files) wasn't run.
--   c. file_path in user_cinema_activity differs from media_files.file_path.
-- If (b) or (c), run user_cinema_activity_v2_phase2_postdeploy.sql and
-- re-check. If step 3 shows path drift, normalize one side and re-backfill.
