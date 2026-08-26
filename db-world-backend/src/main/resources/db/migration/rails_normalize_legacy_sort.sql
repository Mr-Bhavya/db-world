-- =============================================================================
-- rails — normalise legacy sort field names in rule JSON
-- =============================================================================
-- `releaseDate` (movies) and `firstAirDate` (series) were merged into the combined
-- `releaseAirDate`, backed by the denormalised tmdb_data.primary_date column, so a
-- mixed Home rail can order by date without failing for half its rows.
--
-- RailSortBuilder still resolves the two old names at RENDER TIME via its
-- LEGACY_ALIASES map. This rewrites the stored values so that shim can eventually
-- be deleted. Same for tag_definitions.default_sort, which feeds tag rails.
--
-- SAFE TO SKIP: the runtime shim means nothing breaks without this. Run it when you
-- want to retire the shim. Do NOT delete LEGACY_ALIASES from RailSortBuilder until
-- step 3 below reports zero rows on the live database — an unrecognised sort field
-- now falls back to unsorted, so a missed row would silently lose its ordering.
--
-- Idempotent + re-runnable.
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. What is affected -----------------------------------------------------
SELECT 'RAILS still storing a legacy sort name' AS check_name;
SELECT id, title, `rule`
FROM   db_world.rails
WHERE  `rule` LIKE '%"releaseDate"%'
   OR  `rule` LIKE '%"firstAirDate"%';

SELECT 'TAG DEFINITIONS still storing a legacy sort name' AS check_name;
SELECT tag_type, display_name, default_sort
FROM   db_world.tag_definitions
WHERE  default_sort IN ('releaseDate', 'firstAirDate');

-- ---- 2. Rewrite --------------------------------------------------------------
-- The rule column is JSON-as-TEXT. Both names appear only ever as a JSON string
-- VALUE of "sort", so a targeted REPLACE on the quoted token is safe: no other key
-- or value in RailRule can contain "releaseDate" as a complete quoted string.
UPDATE db_world.rails
SET    `rule` = REPLACE(`rule`, '"releaseDate"', '"releaseAirDate"')
WHERE  `rule` LIKE '%"releaseDate"%';

UPDATE db_world.rails
SET    `rule` = REPLACE(`rule`, '"firstAirDate"', '"releaseAirDate"')
WHERE  `rule` LIKE '%"firstAirDate"%';

UPDATE db_world.tag_definitions
SET    default_sort = 'releaseAirDate'
WHERE  default_sort IN ('releaseDate', 'firstAirDate');

-- ---- 3. Verify — must be EMPTY before dropping LEGACY_ALIASES ---------------
SELECT 'REMAINING legacy sort names (must be zero to retire the shim)' AS check_name;
SELECT id, title, `rule` FROM db_world.rails
WHERE  `rule` LIKE '%"releaseDate"%' OR `rule` LIKE '%"firstAirDate"%'
UNION ALL
SELECT NULL, tag_type, default_sort FROM db_world.tag_definitions
WHERE  default_sort IN ('releaseDate', 'firstAirDate');

-- ---- 4. Sanity-check the rewrite ---------------------------------------------
-- Every rail that now says releaseAirDate, so you can eyeball that the JSON is
-- still well-formed and nothing else got rewritten.
SELECT id, title, `rule`
FROM   db_world.rails
WHERE  `rule` LIKE '%"releaseAirDate"%'
ORDER  BY id;
