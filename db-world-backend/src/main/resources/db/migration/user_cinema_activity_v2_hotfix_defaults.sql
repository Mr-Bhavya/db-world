-- =============================================================================
-- user_cinema_activity v2 — HOTFIX: add DB defaults to counter columns
-- =============================================================================
-- Background
-- ----------
-- Hibernate's ddl-auto=update created download_count, stream_count and
-- connection_count as NOT NULL columns without a SQL DEFAULT. That breaks the
-- upsert path because those columns are not in the INSERT column list (they're
-- only mutated by markCompleted()). MySQL rejects the INSERT with:
--   "Field 'download_count' doesn't have a default value"
--
-- The new build also seeds 0 in the INSERT directly so this is belt-and-
-- suspenders — but it makes hand-written INSERTs and future schema rebuilds
-- well-behaved too.
--
-- Schema: new_db_world — adjust if yours differs.
-- =============================================================================

ALTER TABLE new_db_world.user_cinema_activity
    MODIFY COLUMN download_count   INT NOT NULL DEFAULT 0,
    MODIFY COLUMN stream_count     INT NOT NULL DEFAULT 0,
    MODIFY COLUMN connection_count INT NOT NULL DEFAULT 1;

-- Verify
SHOW COLUMNS FROM new_db_world.user_cinema_activity
    LIKE '%_count';
