-- =============================================================================
--  Email verification and password reset tokens
-- =============================================================================
--  Hibernate's ddl-auto=update creates this table on its own, so this file is
--  only needed for a deploy that manages schema explicitly. Safe to re-run.
--
--  Only the SHA-256 of each token is stored. The raw value exists once, in the
--  email — so a database leak yields nothing redeemable, which matters most for
--  PASSWORD_RESET, where a live token is equivalent to the password.
-- =============================================================================

USE db_world;

CREATE TABLE IF NOT EXISTS verification_token (
    id          BINARY(16)   NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL,
    purpose     VARCHAR(32)  NOT NULL,
    created     DATETIME(6)  NULL,
    expiry      DATETIME(6)  NOT NULL,
    used_at     DATETIME(6)  NULL,
    user_id     BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_verification_token_hash (token_hash),
    KEY idx_verification_token_user_purpose (user_id, purpose),
    CONSTRAINT fk_verification_token_user
        FOREIGN KEY (user_id) REFERENCES USERS (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

SELECT 'verification_token.sql complete' AS status;
