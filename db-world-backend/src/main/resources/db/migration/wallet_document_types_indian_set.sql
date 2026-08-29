-- =============================================================================
-- wallet document types — grouping columns + the full Indian document set
-- =============================================================================
-- Adds `category` to wallet_document_type, backfills `category` + `icon_key` on
-- the six types seeded before those columns existed, and inserts the rest of the
-- Indian set.
--
-- WHY A MIGRATION AT ALL, given WalletTypeService.seedDefaults() also does this:
-- that method was insert-only until now, so on an existing install the six
-- original rows would have kept a NULL category and icon_key forever and fallen
-- into the picker's catch-all group. The service has since gained a matching
-- null-only backfill, so either path fixes it — this file exists so the data is
-- correct BEFORE the new build boots, and so a deploy that rolls back doesn't
-- leave the types half-grouped.
--
-- Idempotent and re-runnable. Safe to run before or after the new build boots:
-- Hibernate ddl-auto=update also adds the column, and every write here is
-- conditional. It only ever fills a NULL, so an admin who has customised a
-- type's icon, category, name or sort order is never overruled.
--
-- Schema: db_world — adjust if yours differs.
-- =============================================================================

-- ---- 1. Add `category` if it isn't there yet --------------------------------
SET @add_category := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world'
      AND TABLE_NAME = 'wallet_document_type'
      AND COLUMN_NAME = 'category'
);
SET @sql := IF(@add_category,
    'ALTER TABLE db_world.wallet_document_type ADD COLUMN category VARCHAR(40) NULL',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- `icon_key` has existed on the entity since the feature shipped, but guard it
-- anyway: an install created before that column was added would not have it, and
-- this file must not fail there.
SET @add_icon := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world'
      AND TABLE_NAME = 'wallet_document_type'
      AND COLUMN_NAME = 'icon_key'
);
SET @sql := IF(@add_icon,
    'ALTER TABLE db_world.wallet_document_type ADD COLUMN icon_key VARCHAR(40) NULL',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 1c. Add `has_expiry` if it isn't there yet ------------------------------
-- Nullable, and null does NOT mean false: it means nobody has said. The client shows
-- the optional expiry field unless this is explicitly false, so an admin-created type
-- keeps the field rather than silently losing it.
SET @add_expiry := (
    SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'db_world'
      AND TABLE_NAME = 'wallet_document_type'
      AND COLUMN_NAME = 'has_expiry'
);
SET @sql := IF(@add_expiry,
    'ALTER TABLE db_world.wallet_document_type ADD COLUMN has_expiry BIT(1) NULL',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Only about a dozen of the set expire at all. Everything else — Aadhaar, PAN, every
-- certificate, every marksheet — does not, and prompting for a date on those is a field
-- guaranteed to stay blank.
UPDATE db_world.wallet_document_type
   SET has_expiry = (code IN ('PASSPORT','VISA','OCI_CARD','DRIVING_LICENCE','VEHICLE_RC',
                              'VEHICLE_INSURANCE','PUC_CERTIFICATE','HEALTH_INSURANCE',
                              'DISABILITY_UDID','EMPLOYEE_ID','RENT_AGREEMENT','RATION_CARD'))
 WHERE has_expiry IS NULL;

-- ---- 2. Backfill the six originals ------------------------------------------
-- NULL-only on purpose. `displayName`, `number_label` and `sort_order` are left
-- exactly as they are: those are the admin's to customise, and this file has no
-- business deciding a rename is wanted.
UPDATE db_world.wallet_document_type
   SET category = CASE code
                    WHEN 'AADHAAR'         THEN 'IDENTITY'
                    WHEN 'PAN'             THEN 'IDENTITY'
                    WHEN 'VOTER_ID'        THEN 'IDENTITY'
                    WHEN 'PASSPORT'        THEN 'TRAVEL'
                    WHEN 'DRIVING_LICENCE' THEN 'VEHICLE'
                    WHEN 'OTHER'           THEN 'OTHER'
                    ELSE category
                  END
 WHERE (category IS NULL OR category = '')
   AND code IN ('AADHAAR','PAN','VOTER_ID','PASSPORT','DRIVING_LICENCE','OTHER');

UPDATE db_world.wallet_document_type
   SET icon_key = CASE code
                    WHEN 'AADHAAR'         THEN 'identity'
                    WHEN 'PAN'             THEN 'tax'
                    WHEN 'VOTER_ID'        THEN 'vote'
                    WHEN 'PASSPORT'        THEN 'passport'
                    WHEN 'DRIVING_LICENCE' THEN 'licence'
                    WHEN 'OTHER'           THEN 'other'
                    ELSE icon_key
                  END
 WHERE (icon_key IS NULL OR icon_key = '')
   AND code IN ('AADHAAR','PAN','VOTER_ID','PASSPORT','DRIVING_LICENCE','OTHER');

-- ---- 3. Insert the rest of the set ------------------------------------------
-- `code` carries a unique key, so INSERT IGNORE makes each row a no-op when it
-- already exists — which is what makes this re-runnable and what makes it
-- coexist with the service's own seeding on boot.
--
-- `sort_order` matches the order of WalletTypeService.DEFAULTS, so the picker
-- reads the same whichever path created the row. Ids are generated here because
-- the entity uses GenerationType.UUID and there is no DB default.
--
-- Credit and debit cards are deliberately absent: a wallet that invites you to
-- photograph a card — number, expiry and CVV on one image — is a liability
-- whatever the encryption at rest, and nothing legitimately asks for one.
INSERT IGNORE INTO db_world.wallet_document_type
    (id, code, display_name, description, icon_key, category, requires_number, number_label, has_expiry, active, sort_order, created_at, updated_at)
VALUES
    (UUID(), 'RATION_CARD',          'Ration Card',                    NULL, 'identity',    'IDENTITY',  1, 'Ration Card Number',     1, 1,  3, NOW(), NOW()),
    (UUID(), 'BIRTH_CERTIFICATE',    'Birth Certificate',              NULL, 'certificate', 'IDENTITY',  0, NULL,                     0, 1,  4, NOW(), NOW()),
    (UUID(), 'MARRIAGE_CERTIFICATE', 'Marriage Certificate',           NULL, 'certificate', 'IDENTITY',  0, NULL,                     0, 1,  5, NOW(), NOW()),
    (UUID(), 'DOMICILE_CERTIFICATE', 'Domicile Certificate',           NULL, 'certificate', 'IDENTITY',  0, NULL,                     0, 1,  6, NOW(), NOW()),
    (UUID(), 'CASTE_CERTIFICATE',    'Caste Certificate',              NULL, 'certificate', 'IDENTITY',  0, NULL,                     0, 1,  7, NOW(), NOW()),
    (UUID(), 'INCOME_CERTIFICATE',   'Income Certificate',             NULL, 'certificate', 'IDENTITY',  0, NULL,                     0, 1,  8, NOW(), NOW()),
    (UUID(), 'DISABILITY_UDID',      'Disability (UDID) Card',         NULL, 'health',      'IDENTITY',  1, 'UDID Number',            1, 1,  9, NOW(), NOW()),
    (UUID(), 'VISA',                 'Visa',                           NULL, 'travel',      'TRAVEL',    1, 'Visa Number',            1, 1, 11, NOW(), NOW()),
    (UUID(), 'OCI_CARD',             'OCI / PIO Card',                 NULL, 'passport',    'TRAVEL',    1, 'OCI Number',             1, 1, 12, NOW(), NOW()),
    (UUID(), 'VEHICLE_RC',           'Vehicle RC',                     NULL, 'vehicle',     'VEHICLE',   1, 'Registration Number',    1, 1, 14, NOW(), NOW()),
    (UUID(), 'VEHICLE_INSURANCE',    'Vehicle Insurance',              NULL, 'insurance',   'VEHICLE',   1, 'Policy Number',          1, 1, 15, NOW(), NOW()),
    (UUID(), 'PUC_CERTIFICATE',      'PUC Certificate',                NULL, 'vehicle',     'VEHICLE',   0, NULL,                     1, 1, 16, NOW(), NOW()),
    (UUID(), 'MARKSHEET_10',         'Class 10 Marksheet',             NULL, 'education',   'EDUCATION', 0, NULL,                     0, 1, 17, NOW(), NOW()),
    (UUID(), 'MARKSHEET_12',         'Class 12 Marksheet',             NULL, 'education',   'EDUCATION', 0, NULL,                     0, 1, 18, NOW(), NOW()),
    (UUID(), 'DEGREE_CERTIFICATE',   'Degree Certificate',             NULL, 'education',   'EDUCATION', 0, NULL,                     0, 1, 19, NOW(), NOW()),
    (UUID(), 'TRANSFER_CERTIFICATE', 'Transfer / Leaving Certificate', NULL, 'education',   'EDUCATION', 0, NULL,                     0, 1, 20, NOW(), NOW()),
    (UUID(), 'BANK_PASSBOOK',        'Bank Passbook',                  NULL, 'bank',        'FINANCIAL', 1, 'Account Number',         0, 1, 21, NOW(), NOW()),
    (UUID(), 'CANCELLED_CHEQUE',     'Cancelled Cheque',               NULL, 'bank',        'FINANCIAL', 0, NULL,                     0, 1, 22, NOW(), NOW()),
    (UUID(), 'DEMAT_CMR',            'Demat CMR',                      NULL, 'bank',        'FINANCIAL', 1, 'DP / Client ID',         0, 1, 23, NOW(), NOW()),
    (UUID(), 'FORM_16',              'Form 16',                        NULL, 'tax',         'FINANCIAL', 0, NULL,                     0, 1, 24, NOW(), NOW()),
    (UUID(), 'ITR_ACKNOWLEDGEMENT',  'ITR Acknowledgement',            NULL, 'tax',         'FINANCIAL', 1, 'Acknowledgement Number', 0, 1, 25, NOW(), NOW()),
    (UUID(), 'HEALTH_INSURANCE',     'Health Insurance',               NULL, 'insurance',   'HEALTH',    1, 'Policy Number',          1, 1, 26, NOW(), NOW()),
    (UUID(), 'ABHA_CARD',            'ABHA Health ID',                 NULL, 'health',      'HEALTH',    1, 'ABHA Number',            0, 1, 27, NOW(), NOW()),
    (UUID(), 'VACCINATION_CERT',     'Vaccination Certificate',        NULL, 'health',      'HEALTH',    0, NULL,                     0, 1, 28, NOW(), NOW()),
    (UUID(), 'EMPLOYEE_ID',          'Employee ID',                    NULL, 'work',        'WORK',      1, 'Employee ID',            1, 1, 29, NOW(), NOW()),
    (UUID(), 'OFFER_LETTER',         'Offer Letter',                   NULL, 'work',        'WORK',      0, NULL,                     0, 1, 30, NOW(), NOW()),
    (UUID(), 'EXPERIENCE_LETTER',    'Experience / Relieving Letter',  NULL, 'work',        'WORK',      0, NULL,                     0, 1, 31, NOW(), NOW()),
    (UUID(), 'PF_UAN',               'PF / UAN',                       NULL, 'work',        'WORK',      1, 'UAN',                    0, 1, 32, NOW(), NOW()),
    (UUID(), 'PROPERTY_DEED',        'Sale Deed / Property Papers',    NULL, 'property',    'PROPERTY',  0, NULL,                     0, 1, 33, NOW(), NOW()),
    (UUID(), 'RENT_AGREEMENT',       'Rent Agreement',                 NULL, 'property',    'PROPERTY',  0, NULL,                     1, 1, 34, NOW(), NOW()),
    (UUID(), 'UTILITY_BILL',         'Utility Bill',                   NULL, 'property',    'PROPERTY',  1, 'Consumer Number',        0, 1, 35, NOW(), NOW());

-- ---- 4. Verify ---------------------------------------------------------------
-- SELECT category, COUNT(*) FROM db_world.wallet_document_type GROUP BY category;
-- SELECT code, category, icon_key FROM db_world.wallet_document_type
--  WHERE category IS NULL OR icon_key IS NULL;   -- expect zero rows
