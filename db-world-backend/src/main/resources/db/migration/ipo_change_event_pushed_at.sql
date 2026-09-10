-- =============================================================================
-- ipo_change_event: pushed_at (notification volume control)
-- =============================================================================
-- notified_at already existed, but it only means "the delivery queue is done
-- with this row" -- it is stamped just as eagerly on an event that was
-- deliberately suppressed as on one that actually buzzed a phone.
--
-- Every volume control added alongside this file has to count SENDS:
--   * the per-IPO cooldown  ("when did we last alert about this company?")
--   * the daily cap         ("how many notifications have gone out today?")
--   * the GMP baseline      ("what value did we last ANNOUNCE?" -- comparing
--                            against the last POLLED value is what let a
--                            drifting GMP re-clear the threshold every pass and
--                            alert the same IPO four times in 3.5 hours)
-- Counting notified_at would count every silent drop as a notification, so
-- sends get their own column.
--
-- The daily cap counts DISTINCT pushed_at values, not rows: one digest push
-- covers several events, and each event in a given push is stamped with that
-- push's own instant, so a distinct count is exactly the number of
-- notifications delivered.
--
-- Backfill is deliberately none. Leaving pushed_at NULL on history means the
-- first pass after deploy sees an empty cooldown and an empty daily tally,
-- which is correct: those rows were sent under the OLD rules and their values
-- are not a baseline anyone should be held to.
--
-- Idempotent + re-runnable. Hibernate (ddl-auto=update) would add the column
-- and index itself; this exists so a deploy can do it deliberately and up front.
-- =============================================================================

SET @schema := 'db_world';

-- --------------------------------------------------------------------------
-- 1. pushed_at
-- --------------------------------------------------------------------------
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ipo_change_event'
                  AND COLUMN_NAME = 'pushed_at');
SET @sql := IF(@exists = 0,
    'ALTER TABLE db_world.ipo_change_event ADD COLUMN pushed_at DATETIME(6) NULL',
    'SELECT "ipo_change_event.pushed_at already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------------------------
-- 2. Index. Read on every delivery pass twice -- once for the daily tally
--    (range scan from IST midnight) and once per candidate for the cooldown.
-- --------------------------------------------------------------------------
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ipo_change_event'
                  AND INDEX_NAME = 'idx_ipo_change_event_pushed');
SET @sql := IF(@exists = 0,
    'CREATE INDEX idx_ipo_change_event_pushed ON db_world.ipo_change_event (pushed_at)',
    'SELECT "idx_ipo_change_event_pushed already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
