-- =============================================================================
-- rails v2 — PHASE 3: drop the legacy single-page column
-- =============================================================================
-- Run this AFTER the new build is up and the rails_page_types join table has
-- been populated for every rail (verify with step 1 below).
--
-- Hibernate (ddl-auto=update) does NOT drop columns it stops mapping. The
-- legacy `page_type` column on `rails` is left orphan after the entity field
-- was removed — this script cleans it up.
--
-- Schema: new_db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. Sanity: every rail has at least one entry in rails_page_types ------
-- Must return 0 — otherwise dropping page_type would leave those rails homeless.
SELECT COUNT(*) AS rails_without_pagetypes
FROM   new_db_world.rails r
WHERE  NOT EXISTS (
    SELECT 1 FROM new_db_world.rails_page_types pt WHERE pt.rail_id = r.id
);

-- ---- 2. If step 1 was non-zero, backfill from the legacy column ------------
-- Safe to run unconditionally; INSERT IGNORE skips rows that already exist.
INSERT IGNORE INTO new_db_world.rails_page_types (rail_id, page_type)
SELECT id, COALESCE(page_type, 'HOME')
FROM   new_db_world.rails
WHERE  NOT EXISTS (
    SELECT 1 FROM new_db_world.rails_page_types pt WHERE pt.rail_id = rails.id
);

-- ---- 3. Drop the legacy column ---------------------------------------------
ALTER TABLE new_db_world.rails DROP COLUMN page_type;

-- ---- 4. Verify --------------------------------------------------------------
-- Should NOT include page_type.
SHOW COLUMNS FROM new_db_world.rails;
