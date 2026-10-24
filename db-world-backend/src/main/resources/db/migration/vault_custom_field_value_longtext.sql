-- Custom-field values are encrypted + base64 encoded, so a 3 KB SSH private key needs ~4.5 KB.
-- The column was VARCHAR(512): "Data too long for column 'field_value'". ddl-auto=update never
-- widens an existing column, so this has to be run by hand, once, before deploying.
ALTER TABLE db_world.credential_custom_fields MODIFY COLUMN field_value LONGTEXT NULL;
