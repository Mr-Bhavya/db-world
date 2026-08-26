-- =============================================================================
-- tag_definitions.rule — admin-defined automatic tags
-- =============================================================================
-- Adds the `rule` column that stores an admin-authored TagRule as JSON. A tag with
-- a rule is recomputed on every scheduler run by RuleTagRefresher, which is what
-- makes a tag automatic WITHOUT writing a TagStrategy class.
--
-- The rule is compiled into a JPA Specification, never interpolated into SQL, so
-- what an admin types only ever reaches the database as bound parameters.
--
-- Hibernate ddl-auto=update also adds this column on boot; this script exists so
-- the change is explicit and re-runnable, and so the verification queries below
-- are on hand. Idempotent.
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. Add `rule` (nullable TEXT) if it isn't there yet ---------------------
-- NULL means "not rule-driven": either a built-in tag computed by a TagStrategy,
-- or a purely manual list an admin curates by hand.
SET @add_rule := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'tag_definitions' AND COLUMN_NAME = 'rule'
);
SET @sql := IF(@add_rule,
    'ALTER TABLE db_world.tag_definitions ADD COLUMN `rule` TEXT NULL',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 2. Sanity-check: no rule on a built-in tag ------------------------------
-- The eight built-ins are computed by TagStrategy beans, which always win over a
-- rule, so a rule stored on one would be dead config. TagDefinitionService.update
-- refuses to create this state; this catches anything hand-inserted. Expect ZERO.
SELECT 'BUILT-IN tags carrying a rule (should be empty)' AS check_name;
SELECT tag_type, LEFT(`rule`, 120) AS rule_preview
FROM   db_world.tag_definitions
WHERE  `rule` IS NOT NULL
  AND  tag_type IN ('TRENDING','TOP_10','FEATURED','EDITOR_PICK','RECENTLY_ADDED',
                    'AVAILABLE_FOR_DOWNLOAD','NEW_SEASON','NEW_EPISODE');

-- ---- 3. Verify --------------------------------------------------------------
-- How each tag gets its records. `automatic` is reconciled on every boot, so:
--   automatic=1, rule IS NULL      → built-in, computed by a TagStrategy
--   automatic=1, rule IS NOT NULL  → admin-defined rule, computed by RuleTagRefresher
--   automatic=0                    → manual list, only ever what an admin added
SELECT td.tag_type,
       td.display_name,
       td.automatic,
       td.active,
       CASE
           WHEN td.`rule` IS NOT NULL THEN 'admin rule'
           WHEN td.automatic          THEN 'built-in code'
           ELSE                            'manual'
       END                    AS filled_by,
       td.default_sort,
       td.last_refreshed_at,
       COUNT(rt.id)           AS tagged_records
FROM   db_world.tag_definitions td
LEFT   JOIN db_world.record_tags rt ON rt.tag_type = td.tag_type
GROUP  BY td.tag_type, td.display_name, td.automatic, td.active, td.`rule`,
         td.default_sort, td.last_refreshed_at
ORDER  BY filled_by, td.tag_type;
