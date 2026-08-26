-- TMDB age ratings (certifications)
--
-- Certifications are not part of TMDB's flat detail payload; they arrive through a per-type
-- append (release_dates for movies, content_ratings for series) that the client did not
-- previously request. Nothing was fetched and nothing was stored, so these columns start
-- empty for every existing row and fill in as titles are re-synced.
--
-- tmdb_data is SINGLE_TABLE inheritance (record_type discriminator), so movies and series
-- share these two columns.
--
-- certification_country is kept alongside the value because the two are meaningless apart:
-- "UA" is a CBFC rating and "TV-14" a US one. Resolution prefers IN, falls back to US, then
-- to any country that rated the title, so without the country there is no way to tell an
-- Indian rating from a fallback.

ALTER TABLE db_world.tmdb_data
    ADD COLUMN certification VARCHAR(16) NULL,
    ADD COLUMN certification_country VARCHAR(2) NULL;

-- Backfill: none possible from existing data. The values only exist in TMDB's API, so rows
-- populate when the scheduled TMDB sync next touches them, or immediately for a title
-- refreshed by hand from the admin console. Existing rows stay NULL until then, which the
-- UI already treats as "no badge".
--
-- To force a full refresh rather than waiting for the recheck window, clear the sync
-- watermark so the scheduler re-fetches everything:
--
--   UPDATE db_world.scheduler_job_config
--      SET last_run_at = NULL
--    WHERE job_name = 'tmdbSync';
--
-- Verify coverage after a sync pass:
--
--   SELECT record_type,
--          certification_country,
--          COUNT(*) AS titles
--     FROM db_world.tmdb_data
--    WHERE certification IS NOT NULL
--    GROUP BY record_type, certification_country
--    ORDER BY titles DESC;
