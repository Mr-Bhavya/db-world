-- =============================================================================
-- ipo_listing: alias key, merge tombstone, GMP refresh cursor
-- =============================================================================
-- Three columns behind the IPO de-duplication + GMP-coverage work.
--
-- WHY DUPLICATES EXIST AT ALL
--   ipo_listing.match_key is UNIQUE and is built as normalize(name)|open_date.
--   There is no shared identifier across the three feeds (no ISIN anywhere;
--   ticker_symbol only exists after listing), so the name IS the identity -- and
--   the normalizer is too weak to make the feeds agree on it:
--     * punctuation is DELETED rather than replaced, gluing tokens together, so
--       "Asset Reconstruction Co.(India) Ltd." keys as "...coindia" while
--       "Asset Reconstruction Company (India) Limited" keys as "...company india"
--     * "&" and "and" are not folded, splitting "Manipal Payment & Identity
--       Solutions" from "Manipal Payment and Identity Solutions"
--     * whitespace is kept, so "AnawilWire" and "Anawil Wire" are two rows
--   ...and because open_date is part of the key, a revised or disagreed-upon
--   date mints a THIRD row. Nothing ever retires the losers.
--
--   The knock-on effect is worse than the duplicate card: InvestorgainMatcher
--   squashes whitespace when matching, so a duplicate pair collapses to one name,
--   looks ambiguous, and is skipped -- leaving NEITHER row with a GMP. That is
--   the "no GMP on our app, but other portals have it" symptom.
--
-- WHAT EACH COLUMN IS FOR
--   alias_key       Lossy, date-free resolution key (IpoNormalizer.aliasKey).
--                   NOT unique and NOT an identity -- match_key stays the
--                   identity, because it is persisted on every row and loosening
--                   it in place would orphan the whole catalogue on the next poll.
--                   Ingest consults alias_key only as a FALLBACK, guarded by a
--                   date-overlap check.
--   merged_into_id  Survivor row id once a duplicate has been merged away. The
--                   merge is therefore reversible: the tombstone keeps its own
--                   history and is simply filtered out of the list, the GMP
--                   refresh candidates and investorgain matching.
--   gmp_refreshed_at
--                   Rotation cursor for the per-pass investorgain GMP budget.
--                   The budget used to take a fixed prefix of a stable ordering,
--                   so the same 30 IPOs won every pass and the ~50 behind them
--                   were refreshed NEVER (verified across four consecutive polls:
--                   identical starved sets). Ordering by staleness bounds the
--                   wait for every tracked IPO instead.
--
-- BACKFILL IS NOT DONE HERE, ON PURPOSE. alias_key is computed by
-- IpoAliasKeyBackfill on boot, so the rule lives in Java only -- a hand-written
-- SQL reimplementation would drift from the Java one and silently stop matching.
-- Existing rows keep alias_key NULL until that runs; a NULL alias never matches
-- anything, so the fallback is simply inert in the meantime.
--
-- Idempotent + re-runnable. Safe to run before OR after the new build boots:
-- Hibernate (ddl-auto=update) would add these columns itself, and every step
-- here checks information_schema first.
-- =============================================================================

SET @schema := 'db_world';

-- --------------------------------------------------------------------------
-- 1. alias_key
-- --------------------------------------------------------------------------
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ipo_listing'
                  AND COLUMN_NAME = 'alias_key');
SET @sql := IF(@exists = 0,
    'ALTER TABLE db_world.ipo_listing ADD COLUMN alias_key VARCHAR(200) NULL',
    'SELECT "ipo_listing.alias_key already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------------------------
-- 2. merged_into_id
-- --------------------------------------------------------------------------
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ipo_listing'
                  AND COLUMN_NAME = 'merged_into_id');
SET @sql := IF(@exists = 0,
    'ALTER TABLE db_world.ipo_listing ADD COLUMN merged_into_id VARCHAR(36) NULL',
    'SELECT "ipo_listing.merged_into_id already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------------------------
-- 3. gmp_refreshed_at
-- --------------------------------------------------------------------------
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ipo_listing'
                  AND COLUMN_NAME = 'gmp_refreshed_at');
SET @sql := IF(@exists = 0,
    'ALTER TABLE db_world.ipo_listing ADD COLUMN gmp_refreshed_at DATETIME(6) NULL',
    'SELECT "ipo_listing.gmp_refreshed_at already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------------------------
-- 4. Indexes. alias_key is read on every ingest miss; merged_into_id is read on
--    every list/refresh/match query as an IS NULL filter.
-- --------------------------------------------------------------------------
SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ipo_listing'
                  AND INDEX_NAME = 'idx_ipo_listing_alias_key');
SET @sql := IF(@exists = 0,
    'CREATE INDEX idx_ipo_listing_alias_key ON db_world.ipo_listing (alias_key)',
    'SELECT "idx_ipo_listing_alias_key already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = 'ipo_listing'
                  AND INDEX_NAME = 'idx_ipo_listing_merged_into');
SET @sql := IF(@exists = 0,
    'CREATE INDEX idx_ipo_listing_merged_into ON db_world.ipo_listing (merged_into_id)',
    'SELECT "idx_ipo_listing_merged_into already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------------------------
-- 5. Report only: how many duplicate clusters are actually out there. This is
--    a rough count using SQL-side folding (the real grouping is the Java alias
--    key, exposed at GET /api/admin/ipo/duplicates) -- it is here so the scale
--    of the problem can be seen from a psql/mysql prompt before deploying.
-- --------------------------------------------------------------------------
SELECT folded, COUNT(*) AS rows_in_cluster, GROUP_CONCAT(company_name SEPARATOR ' | ') AS names
FROM (
    SELECT id, company_name,
           -- Mirrors IpoNormalizer.aliasKey closely enough to size the problem:
           -- "&" -> "and", punctuation -> separator, trailing legal suffixes
           -- dropped, then all whitespace squashed out. The abbreviation map
           -- (co -> company, etc.) is NOT reproduced here, so this UNDER-counts.
           REPLACE(
               REGEXP_REPLACE(
                   TRIM(REGEXP_REPLACE(
                       REGEXP_REPLACE(REPLACE(LOWER(company_name), '&', ' and '), '[^a-z0-9]+', ' '),
                       '^ +| +$', '')),
                   '( (ltd|limited|pvt|private|llp))+$', ''),
               ' ', '') AS folded
    FROM db_world.ipo_listing
    WHERE merged_into_id IS NULL AND company_name IS NOT NULL
) AS f
WHERE folded <> ''
GROUP BY folded
HAVING COUNT(*) > 1
ORDER BY rows_in_cluster DESC, folded;
