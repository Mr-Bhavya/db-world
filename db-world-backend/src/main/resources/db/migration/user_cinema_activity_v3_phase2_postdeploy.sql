-- =============================================================================
-- user_cinema_activity v3 — PHASE 2: POST-DEPLOY FINALIZE
-- =============================================================================
-- Run this AFTER the v3 build is live in production.
--
-- Purpose:
--   1. Add the FK constraint on watch_progress_id (Hibernate added the column
--      but not the constraint, because the entity field is a plain Long, not
--      @ManyToOne — by design, to avoid proxy overhead on the hot path).
--   2. Physically drop the 5 unused columns that the v3 code no longer reads
--      or writes. Hibernate's ddl-auto: update does NOT drop columns; this is
--      the manual step.
--
-- Schema: db_world.
-- =============================================================================

-- ---- 1. SANITY CHECK: confirm watch_progress_id column exists ----
-- (Hibernate adds it on first startup of the v3 build. If this returns 0,
--  the build has not yet been deployed — stop and deploy first.)
SELECT COUNT(*) AS column_exists
FROM information_schema.columns
WHERE table_schema = 'db_world'
  AND table_name   = 'user_cinema_activity'
  AND column_name  = 'watch_progress_id';

-- ---- 2. ADD FK CONSTRAINT ----
ALTER TABLE db_world.user_cinema_activity
    ADD CONSTRAINT fk_uca_watch_progress
        FOREIGN KEY (watch_progress_id) REFERENCES db_world.watch_progress(id)
        ON DELETE SET NULL;

-- ---- 3. DROP 5 UNUSED COLUMNS ----
-- These were declared on the entity until v2 but never read/written by
-- live code. The nginx log format does not expose the data needed to
-- populate http_protocol/referer/country_code; error_code overlapped
-- with completion_status=ABORTED; update_count was a derived counter
-- never read.
ALTER TABLE db_world.user_cinema_activity
    DROP COLUMN http_protocol,
    DROP COLUMN referer,
    DROP COLUMN country_code,
    DROP COLUMN error_code,
    DROP COLUMN update_count;

-- ---- 4. VERIFY: count remaining columns ----
-- (Spot-check that the 5 columns are gone and watch_progress_id is present.)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'db_world'
  AND table_name   = 'user_cinema_activity'
ORDER BY ordinal_position;
