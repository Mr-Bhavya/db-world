-- =============================================================================
-- tmdb_data.primary_date — backfill from the per-type source column
-- =============================================================================
-- `primary_date` is a denormalised sort/display column: a movie's release date or
-- a series' first-air date, unified so a mixed rail can sort by one field. It is
-- kept current by @PrePersist/@PreUpdate hooks on MovieTmdbEntity and
-- TvSeriesTmdbEntity.
--
-- Those hooks only fire when a row is written THROUGH JPA. Rows persisted before
-- the hooks existed — or by any path that bypassed them — still hold their
-- release_date / first_air_date but have a NULL primary_date.
--
-- The visible symptom: the record page title renders as "Bell Bottom" instead of
-- "Bell Bottom (2021)", the sitemap/JSON-LD carries no datePublished, and
-- date-based rail sorts drop the row. "<title> <year>" is one of the most common
-- search patterns, so this costs real search traffic.
--
-- NO TMDB CALLS ARE NEEDED. The source data is already in the table; only the
-- derived column is missing. Re-syncing 2,500 titles against the TMDB API to
-- recompute a value we already hold would be slow, rate-limited and pointless.
--
-- Idempotent and re-runnable: only NULL targets with a usable source are touched.
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 0. Before ---------------------------------------------------------------
SELECT 'BEFORE' AS stage,
       record_type,
       COUNT(*)                                                      AS rows_total,
       SUM(primary_date IS NULL)                                     AS primary_date_null,
       SUM(primary_date IS NULL AND COALESCE(NULLIF(release_date,   ''), NULLIF(first_air_date, '')) IS NOT NULL)
                                                                     AS fixable_now
FROM   db_world.tmdb_data
GROUP  BY record_type;

-- ---- 1. Movies ---------------------------------------------------------------
-- NULLIF guards the blank string: the entity hook uses blankToNull(), so '' must
-- be treated as absent here too or primary_date ends up holding an empty string,
-- which sorts and renders worse than NULL.
UPDATE db_world.tmdb_data
SET    primary_date = NULLIF(release_date, '')
WHERE  record_type = 'MOVIE'
  AND  primary_date IS NULL
  AND  NULLIF(release_date, '') IS NOT NULL;

-- ---- 2. Series ---------------------------------------------------------------
UPDATE db_world.tmdb_data
SET    primary_date = NULLIF(first_air_date, '')
WHERE  record_type = 'TV_SERIES'
  AND  primary_date IS NULL
  AND  NULLIF(first_air_date, '') IS NOT NULL;

-- ---- 3. Tidy any blank strings already stored --------------------------------
-- Older rows may carry '' rather than NULL. extractYear() reads the first four
-- characters, so a blank yields no year but still counts as "present" and blocks
-- the backfill above from ever filling it.
UPDATE db_world.tmdb_data
SET    primary_date = NULL
WHERE  primary_date = '';

-- ---- 4. After ----------------------------------------------------------------
-- Expect fixable_now = 0. Any remaining primary_date_null are titles where TMDB
-- genuinely has no date (unreleased, or an incomplete sync) — those need a TMDB
-- re-sync, not this script.
SELECT 'AFTER' AS stage,
       record_type,
       COUNT(*)                                                      AS rows_total,
       SUM(primary_date IS NULL)                                     AS primary_date_null,
       SUM(primary_date IS NULL AND COALESCE(NULLIF(release_date,   ''), NULLIF(first_air_date, '')) IS NOT NULL)
                                                                     AS fixable_now
FROM   db_world.tmdb_data
GROUP  BY record_type;

-- ---- 5. Spot check -----------------------------------------------------------
-- The record that surfaced this: expect primary_date = '2021-08-19'.
-- The FK lives on `records` (RecordEntity owns the @OneToOne; tmdb_data has no
-- record_id column), so the join goes records.tmdb_id -> tmdb_data.id.
SELECT r.id AS record_id, t.title, t.record_type,
       t.release_date, t.first_air_date, t.primary_date
FROM   db_world.records r
JOIN   db_world.tmdb_data t ON t.id = r.tmdb_id
WHERE  r.id IN (1, 2, 3, 5, 10)
ORDER  BY r.id;
