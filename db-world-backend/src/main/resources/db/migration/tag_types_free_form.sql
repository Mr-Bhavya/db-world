-- =============================================================================
-- tag types become free-form strings (admin-creatable tags)
-- =============================================================================
-- `record_tags.tag_type` was a Java enum persisted via @Enumerated(STRING); it is
-- now a plain String, so admins can create their own curated tags ("Diwali
-- Special", "Hidden Gems") from the admin UI without a deploy.
--
-- THE COLUMN TYPE DOES NOT CHANGE. @Enumerated(STRING) already stored VARCHAR(50),
-- and every JPQL comparison was already string-vs-string, so existing rows and
-- every existing rail keep working untouched. This script only adds the guardrails
-- that the Java enum used to provide for free:
--
--   1. Referential integrity between record_tags and tag_definitions — previously
--      impossible to violate (the enum wouldn't parse), now possible via the API,
--      so it is checked here.
--   2. An index for the tag_definitions join the admin summary does per tag.
--
-- Nothing here is required for the app to boot; it verifies and tidies. Safe to
-- run before or after deploy. Idempotent + re-runnable.
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. Report any orphaned tag rows ----------------------------------------
-- Rows whose tag_type has no tag_definitions entry. Expect ZERO. Anything here
-- predates the change (e.g. a retired tag like NEW_RELEASE / SHOW_ON_TOP) and is
-- invisible in the admin UI, because the UI is driven by tag_definitions.
SELECT 'ORPHANED record_tags (no matching tag_definitions row)' AS check_name;
SELECT rt.tag_type, COUNT(*) AS rows_affected
FROM   db_world.record_tags rt
LEFT   JOIN db_world.tag_definitions td ON td.tag_type = rt.tag_type
WHERE  td.tag_type IS NULL
GROUP  BY rt.tag_type;

-- ---- 2. Clean up orphans ----------------------------------------------------
-- These can never render (no definition = not listed anywhere), so they are dead
-- weight on the idx_record_tags_type_priority index.
-- COMMENTED OUT BY DEFAULT: run step 1 first and eyeball the output. If a tag you
-- still want appears there, create it in the admin UI instead of deleting.
--
-- DELETE rt FROM db_world.record_tags rt
-- LEFT JOIN db_world.tag_definitions td ON td.tag_type = rt.tag_type
-- WHERE td.tag_type IS NULL;

-- ---- 3. Normalise casing ----------------------------------------------------
-- Tag identities are canonical UPPER_SNAKE (see TagNames.canonicalize). Legacy
-- rows should already comply since enum names were upper-case, but a mixed-case
-- value would be a silently separate tag, so this makes it explicit.
SELECT 'NON-CANONICAL tag_type values (should be empty)' AS check_name;
SELECT DISTINCT tag_type FROM db_world.record_tags     WHERE tag_type <> UPPER(tag_type)
UNION
SELECT DISTINCT tag_type FROM db_world.tag_definitions WHERE tag_type <> UPPER(tag_type);

-- ---- 4. Index for the admin summary join ------------------------------------
-- The admin tag summary counts record_tags per tag_definitions row. The existing
-- idx_record_tags_type_priority (tag_type, priority) already leads on tag_type and
-- covers this, so nothing new is needed on record_tags. Confirm it is present:
SELECT 'record_tags indexes' AS check_name;
SHOW INDEX FROM db_world.record_tags;

-- ---- 5. Verify --------------------------------------------------------------
-- Every tag with its record count and whether it is admin-created. `automatic` is
-- reconciled against the registered TagStrategy beans on every boot, so a tag
-- showing automatic = 0 is genuinely safe to curate by hand.
SELECT td.tag_type,
       td.display_name,
       td.automatic,
       td.active,
       td.default_sort,
       COUNT(rt.id) AS tagged_records
FROM   db_world.tag_definitions td
LEFT   JOIN db_world.record_tags rt ON rt.tag_type = td.tag_type
GROUP  BY td.tag_type, td.display_name, td.automatic, td.active, td.default_sort
ORDER  BY td.automatic DESC, td.tag_type;
