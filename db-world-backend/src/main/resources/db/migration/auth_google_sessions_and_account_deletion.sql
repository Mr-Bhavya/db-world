-- ============================================================================
--  Google Sign-In, rotating sessions, and account deletion
--
--  RUN THIS BEFORE STARTING THE APP on an existing database.
--  `refresh_token.family_id` is NOT NULL in the entity, and Hibernate's
--  ddl-auto=update cannot add a NOT NULL column to a table that already has
--  rows — so the backfill below has to happen first.
--
--  Safe to re-run: every statement is guarded.
-- ============================================================================

USE db_world;

-- ── 1. USERS: Google identity, token versioning, deletion lifecycle ─────────

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'USERS'
                  AND COLUMN_NAME = 'google_sub') = 0,
    'ALTER TABLE USERS ADD COLUMN google_sub VARCHAR(255) NULL',
    'SELECT "USERS.google_sub already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'USERS'
                  AND COLUMN_NAME = 'avatar_url') = 0,
    'ALTER TABLE USERS ADD COLUMN avatar_url VARCHAR(512) NULL',
    'SELECT "USERS.avatar_url already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'USERS'
                  AND COLUMN_NAME = 'email_verified') = 0,
    'ALTER TABLE USERS ADD COLUMN email_verified BIT(1) NOT NULL DEFAULT b''0''',
    'SELECT "USERS.email_verified already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Rides in every access token as the `tv` claim. Bumping it invalidates all of a
-- user's outstanding access tokens at once, which is what makes a role downgrade,
-- a disable or a reuse-detection take effect now rather than in five minutes.
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'USERS'
                  AND COLUMN_NAME = 'token_version') = 0,
    'ALTER TABLE USERS ADD COLUMN token_version INT NOT NULL DEFAULT 0',
    'SELECT "USERS.token_version already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'USERS'
                  AND COLUMN_NAME = 'deleted_at') = 0,
    'ALTER TABLE USERS ADD COLUMN deleted_at DATETIME(6) NULL',
    'SELECT "USERS.deleted_at already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'USERS'
                  AND COLUMN_NAME = 'purge_after') = 0,
    'ALTER TABLE USERS ADD COLUMN purge_after DATETIME(6) NULL',
    'SELECT "USERS.purge_after already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- UNIQUE, not just indexed: one Google account must never be linked to two DB World
-- accounts, or a sign-in becomes ambiguous. NULLs stay distinct in MySQL, so every
-- password-only account is unaffected.
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'USERS'
                  AND INDEX_NAME = 'uk_users_google_sub') = 0,
    'ALTER TABLE USERS ADD UNIQUE KEY uk_users_google_sub (google_sub)',
    'SELECT "uk_users_google_sub already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'USERS'
                  AND INDEX_NAME = 'idx_users_purge_after') = 0,
    'ALTER TABLE USERS ADD KEY idx_users_purge_after (purge_after)',
    'SELECT "idx_users_purge_after already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 2. refresh_token: rotation family + session metadata ────────────────────

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'refresh_token'
                  AND COLUMN_NAME = 'family_id') = 0,
    'ALTER TABLE refresh_token ADD COLUMN family_id BINARY(16) NULL',
    'SELECT "refresh_token.family_id already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'refresh_token'
                  AND COLUMN_NAME = 'used_at') = 0,
    'ALTER TABLE refresh_token ADD COLUMN used_at DATETIME(6) NULL',
    'SELECT "refresh_token.used_at already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'refresh_token'
                  AND COLUMN_NAME = 'revoked_at') = 0,
    'ALTER TABLE refresh_token ADD COLUMN revoked_at DATETIME(6) NULL',
    'SELECT "refresh_token.revoked_at already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'refresh_token'
                  AND COLUMN_NAME = 'revoked_reason') = 0,
    'ALTER TABLE refresh_token ADD COLUMN revoked_reason VARCHAR(64) NULL',
    'SELECT "refresh_token.revoked_reason already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'refresh_token'
                  AND COLUMN_NAME = 'platform') = 0,
    'ALTER TABLE refresh_token ADD COLUMN platform VARCHAR(16) NULL',
    'SELECT "refresh_token.platform already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'refresh_token'
                  AND COLUMN_NAME = 'user_agent') = 0,
    'ALTER TABLE refresh_token ADD COLUMN user_agent VARCHAR(512) NULL',
    'SELECT "refresh_token.user_agent already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'refresh_token'
                  AND COLUMN_NAME = 'ip_address') = 0,
    'ALTER TABLE refresh_token ADD COLUMN ip_address VARCHAR(64) NULL',
    'SELECT "refresh_token.ip_address already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Each pre-existing token becomes its own single-member family. That is the correct
-- reading: before rotation existed, one row WAS one session.
UPDATE refresh_token SET family_id = id WHERE family_id IS NULL;
UPDATE refresh_token SET platform = 'WEB' WHERE platform IS NULL;

ALTER TABLE refresh_token MODIFY COLUMN family_id BINARY(16) NOT NULL;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = 'db_world' AND TABLE_NAME = 'refresh_token'
                  AND INDEX_NAME = 'idx_refresh_token_family') = 0,
    'ALTER TABLE refresh_token ADD KEY idx_refresh_token_family (family_id)',
    'SELECT "idx_refresh_token_family already present"');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 3. Columns that an account purge detaches instead of deleting ───────────
--
-- Both are NOT NULL today, which would make `SET user_id = NULL` fail and force the
-- purge to delete the rows instead — silently changing every affected record's
-- rating average and rewriting the login-history totals.

ALTER TABLE user_reviews MODIFY COLUMN user_id BIGINT NULL;
ALTER TABLE LOGIN_DATA  MODIFY COLUMN user      BIGINT NULL;

SELECT 'auth_google_sessions_and_account_deletion.sql complete' AS status;
