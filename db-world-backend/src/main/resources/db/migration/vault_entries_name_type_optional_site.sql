-- Vault: long custom-field values, and entries with a name, a type and an OPTIONAL website.
--
-- 1. Run this BEFORE the new backend starts (ddl-auto=update never widens or loosens a column).
-- 2. Start the new backend: ddl-auto adds credentials.name and credentials.type by itself.
-- 3. Run section B once, after that first start.

-- A. Before deploy -----------------------------------------------------------------------------

-- Custom-field values are encrypted + base64 encoded, so a 3 KB SSH private key needs ~4.5 KB.
-- The column was VARCHAR(512): "Data too long for column 'field_value'".
ALTER TABLE db_world.credential_custom_fields MODIFY COLUMN field_value LONGTEXT NULL;

-- An entry with no website has no host. Hibernate creates this column nullable, so this is
-- normally already true; check with: SHOW CREATE TABLE db_world.password_manager;
-- ALTER TABLE db_world.password_manager MODIFY COLUMN host VARCHAR(255) NULL;   -- only if it says NOT NULL

-- B. After the first start of the new backend ----------------------------------------------------

-- Entries saved before types existed are logins. (Names stay empty: the app shows the host.)
UPDATE db_world.credentials SET type = 'LOGIN' WHERE type IS NULL;
