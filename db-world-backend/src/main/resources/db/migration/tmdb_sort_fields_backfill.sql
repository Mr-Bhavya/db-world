-- =============================================================================
-- TMDB derived sort fields — one-time backfill
-- =============================================================================
-- Adds values for the new rail-sort columns on existing rows. Hibernate
-- (ddl-auto=update) CREATES the columns (primary_date, weighted_rating,
-- updated_at) on boot but does NOT populate them — entity lifecycle hooks only
-- fire when a title is next saved (manual refresh / batch sync). Run this once
-- after deploying so the new "Release / air date", "Top rated" and "Last TMDB
-- update" rail sorts work against the whole catalog immediately.
--
-- Schema: new_db_world — adjust if yours differs. Safe to re-run (idempotent).
-- =============================================================================

-- ---- 1. Combined release/air date -------------------------------------------
-- Movies store release_date, series store first_air_date (SINGLE_TABLE — the
-- other column is NULL). COALESCE picks whichever is set; blanks → NULL so they
-- sort last under DESC.
UPDATE new_db_world.tmdb_data
SET primary_date = NULLIF(TRIM(COALESCE(release_date, first_air_date)), '');

-- ---- 2. Weighted "Top rated" (Bayesian) score -------------------------------
-- Mirrors TmdbEntity.computeWeightedRating: min votes = 50, prior mean = 6.5.
UPDATE new_db_world.tmdb_data
SET weighted_rating =
        (vote_count / (vote_count + 50.0)) * vote_average
        + (50.0 / (vote_count + 50.0)) * 6.5;

-- ---- 3. Last-TMDB-update baseline -------------------------------------------
-- No history exists for past syncs, so seed NULLs to "now" — gives the sort a
-- usable baseline; real values diverge as titles are re-synced going forward.
UPDATE new_db_world.tmdb_data
SET updated_at = NOW()
WHERE updated_at IS NULL;

-- ---- 4. Verify --------------------------------------------------------------
SELECT
    COUNT(*)                                AS total,
    SUM(primary_date    IS NOT NULL)        AS with_date,
    SUM(weighted_rating IS NOT NULL)        AS with_weighted,
    SUM(updated_at      IS NOT NULL)        AS with_updated
FROM new_db_world.tmdb_data;
