-- =============================================================================
-- tally_group: rename one-to-one ledgers that became groups under the old code
-- =============================================================================
-- A one-to-one ledger (kind = 'DIRECT') has no name of its own. The stored
-- tally_group.name is only the CREATOR's view of the other person -- "Rashmi
-- Dudhia" when Bhavya started it -- and the server swaps it per reader, so
-- Rashmi sees "Bhavya Dudhia" instead. That swap only happens while the ledger
-- is DIRECT.
--
-- Adding a third person turns the ledger into kind = 'GROUP'. The old code
-- flipped the kind and left the name alone, so from then on EVERYONE read the
-- creator's view: Rashmi opens a group called "Rashmi Dudhia", which is her own
-- name. The current code renames at promotion time to "Bhavya Dudhia, Rashmi
-- Dudhia & Jainaksh Dudhia" (active members, in the order they joined), but
-- that only covers promotions from now on. This script gives the older ones the
-- name a promotion would give them today.
--
-- WHICH ROWS
--   kind = 'GROUP' and the group's name is exactly (case-insensitively) one of
--   its own members' display names. That is the fingerprint of a promoted
--   ledger nobody has renamed: at creation the ledger's name and the other
--   member's display_name are written from the same string. A group somebody
--   has since renamed -- "Flat 4B" -- does not match and is left alone.
--   A group deliberately named after one of its members would also match, which
--   is why step 1 exists: read the list before running step 2.
--
-- WHAT IT DOES NOT DO
--   * No History entry. Renames made in the app are logged; this backfill is
--     not, so the old name simply stops appearing.
--   * updated_at is not touched, so the ledger does not jump to "today" in the
--     list.
--   * The icon is not touched (a promoted ledger keeps its handshake).
--
-- Re-runnable: once renamed, a row no longer matches.
-- Any member can also rename a group from the app ("Edit group"), which is the
-- alternative to running this at all.
-- =============================================================================

USE db_world;
SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- 1. PREVIEW. Run this on its own first and read every row.
-- -----------------------------------------------------------------------------
SELECT g.id,
       g.name            AS current_name,
       labels.new_name,
       labels.active_members
FROM tally_group g
JOIN (
    SELECT j.group_id,
           j.n AS active_members,
           CASE WHEN CHAR_LENGTH(j.full_label) <= 120 THEN j.full_label
                ELSE CONCAT(RTRIM(LEFT(j.full_label, 119)), '…')
           END AS new_name
    FROM (
        SELECT c.group_id,
               c.n,
               CASE WHEN c.n = 1 THEN c.names
                    ELSE CONCAT(REPLACE(SUBSTRING_INDEX(c.names, '|~|', c.n - 1), '|~|', ', '),
                                ' & ',
                                SUBSTRING_INDEX(c.names, '|~|', -1))
               END AS full_label
        FROM (
            SELECT m.group_id,
                   COUNT(*) AS n,
                   GROUP_CONCAT(m.display_name ORDER BY m.created_at, m.id SEPARATOR '|~|') AS names
            FROM tally_group_member m
            WHERE m.status = 'ACTIVE'
            GROUP BY m.group_id
        ) c
    ) j
) labels ON labels.group_id = g.id
WHERE g.kind = 'GROUP'
  AND EXISTS (SELECT 1 FROM tally_group_member m
              WHERE m.group_id = g.id AND m.display_name = g.name)
  AND g.name <> labels.new_name;

-- -----------------------------------------------------------------------------
-- 2. APPLY. Same rows as step 1.
--    If step 1 listed a group you want to keep as it is, add
--      AND g.id NOT IN ('<id>', ...)
--    to the WHERE clause below before running it.
--
--    The member subqueries read tally_group_member only, never tally_group, so
--    this does not hit MySQL error 1093 (updating a table the subquery reads).
-- -----------------------------------------------------------------------------
UPDATE tally_group g
JOIN (
    SELECT j.group_id,
           CASE WHEN CHAR_LENGTH(j.full_label) <= 120 THEN j.full_label
                ELSE CONCAT(RTRIM(LEFT(j.full_label, 119)), '…')
           END AS new_name
    FROM (
        SELECT c.group_id,
               CASE WHEN c.n = 1 THEN c.names
                    ELSE CONCAT(REPLACE(SUBSTRING_INDEX(c.names, '|~|', c.n - 1), '|~|', ', '),
                                ' & ',
                                SUBSTRING_INDEX(c.names, '|~|', -1))
               END AS full_label
        FROM (
            SELECT m.group_id,
                   COUNT(*) AS n,
                   GROUP_CONCAT(m.display_name ORDER BY m.created_at, m.id SEPARATOR '|~|') AS names
            FROM tally_group_member m
            WHERE m.status = 'ACTIVE'
            GROUP BY m.group_id
        ) c
    ) j
) labels ON labels.group_id = g.id
SET g.name = labels.new_name,
    g.updated_at = g.updated_at
WHERE g.kind = 'GROUP'
  AND EXISTS (SELECT 1 FROM tally_group_member m
              WHERE m.group_id = g.id AND m.display_name = g.name)
  AND g.name <> labels.new_name;
