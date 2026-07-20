-- ============================================================================
-- Rename schema: new_db_world  ->  db_world
--
-- MySQL has no `RENAME DATABASE`, so we create the target schema and move every
-- BASE TABLE across with RENAME TABLE (atomic, in-place, preserves data and
-- triggers). This schema has NO stored routines/views (verified via
-- information_schema), so tables are all that need to move.
--
-- !! RUN WITH THE APP STOPPED. Cutover order:
--     1. Stop the backend service.
--     2. Run this script as root/admin:  sudo mysql -u root -p < rename_schema_new_db_world_to_db_world.sql
--     3. Verify db_world has all 57 tables (query at the bottom).
--     4. Grant the app user on db_world.* (see step 3 below) if it wasn't global.
--     5. Ensure DB_NAME=db_world in the app env, then start the backend.
--     6. Once healthy, DROP the old schema MANUALLY (last line, commented out).
-- ============================================================================

-- 1. Create the target schema, matching the source charset/collation.
SET @cs  := (SELECT default_character_set_name FROM information_schema.schemata WHERE schema_name = 'new_db_world');
SET @col := (SELECT default_collation_name     FROM information_schema.schemata WHERE schema_name = 'new_db_world');
SET @ddl := CONCAT('CREATE DATABASE IF NOT EXISTS db_world CHARACTER SET ', @cs, ' COLLATE ', @col);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. Move every base table from new_db_world to db_world in one atomic statement.
SET SESSION group_concat_max_len = 1024 * 1024;
SET @moves := (
    SELECT GROUP_CONCAT('`new_db_world`.`', table_name, '` TO `db_world`.`', table_name, '`' SEPARATOR ', ')
    FROM information_schema.tables
    WHERE table_schema = 'new_db_world' AND table_type = 'BASE TABLE'
);
SET @rename := CONCAT('RENAME TABLE ', @moves);
PREPARE s FROM @rename; EXECUTE s; DEALLOCATE PREPARE s;

-- 3. Grants. RENAME TABLE does NOT move schema-scoped privileges. If the app user
--    (DB_USER) has only new_db_world.* grants, re-grant on db_world.*. Skip if the
--    user already has global *.* (e.g. an admin account). Replace <APP_USER>/<HOST>:
--        GRANT ALL PRIVILEGES ON db_world.* TO '<APP_USER>'@'<HOST>';
--        FLUSH PRIVILEGES;

-- 4. Verify (expect 57), then drop the old schema MANUALLY once the app is healthy:
--        SELECT COUNT(*) AS tables_in_db_world FROM information_schema.tables
--        WHERE table_schema = 'db_world' AND table_type = 'BASE TABLE';
--        DROP DATABASE new_db_world;
