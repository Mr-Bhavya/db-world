-- =============================================================================
-- Tracking v2 cutover — DROP legacy cinema-activity tables
-- =============================================================================
-- Run this MANUALLY (this project has no auto-migration runner) and ONLY AFTER:
--   1. The new tracking system (com.db.dbworld.audit.tracking.*) is deployed and
--      verified on real traffic: downloads/streams populate `activity_session`,
--      the admin Activity console (/admin/activity-center) shows sessions, and
--      the cinema home-page rails still render (genre-affinity, rewatch, recent)
--      — those were repointed to `activity_session`, so they no longer depend on
--      the tables dropped below.
--   2. You have confirmed you do NOT need the historical data in these tables.
--      THIS IS IRREVERSIBLE — take a database backup first if unsure.
--
-- The old cinema-activity tracking code (entity/repo/service, nginx log shipper,
-- old read APIs, old /me/activity, old admin analytics) has been deleted from the
-- application, so these tables are now orphaned.
--
-- Schema: new_db_world.
-- KEEP (do NOT drop — separate, still-used features):
--   login_data          (login history)
--   watch_progress      (playback position)
--   user_activity_logs  (generic HTTP request audit)
-- =============================================================================

-- ---- 1. SANITY: confirm the new tables exist before dropping the old ones ----
SELECT COUNT(*) AS activity_session_exists
FROM information_schema.tables
WHERE table_schema = 'new_db_world' AND table_name = 'activity_session';
-- Expect 1. If 0, STOP — the new system is not deployed; do not drop the old tables.

-- ---- 2. Drop the orphaned legacy tables ----
DROP TABLE IF EXISTS new_db_world.log_shipper_state;
DROP TABLE IF EXISTS new_db_world.user_cinema_activity;
