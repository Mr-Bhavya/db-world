package com.db.dbworld.app.cinema.catalog.migration;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * One-time, idempotent backfill for the record {@code visibility} lifecycle that replaced the old
 * {@code hide_from_rails} boolean. Runs once the context is up (so Hibernate's ddl-auto has already
 * added the nullable {@code visibility} column). Safe to run on every boot:
 *
 * <ol>
 *   <li>Backfill {@code visibility} for null rows from the legacy column
 *       ({@code hide_from_rails = 1 → UNLISTED}, else {@code PUBLISHED}) — only while that column
 *       still exists, so every existing record stays exactly as visible as it was before.</li>
 *   <li>Stamp {@code new_release_notified_at = created_at} on existing non-draft rows, so the
 *       backfilled catalogue is never re-announced as "new".</li>
 *   <li>Drop the now-unused legacy {@code hide_from_rails} column (guarded on existence, so this is a
 *       no-op on later boots).</li>
 * </ol>
 * Mirrors the idempotent-ALTER pattern in {@code SchedulerAdminService.relaxLegacyConstraints};
 * every step is wrapped so a DB hiccup can never block boot.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class RecordVisibilityMigration implements ApplicationRunner {

    private static final String TABLE = "records";
    private static final String LEGACY_COLUMN = "hide_from_rails";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        boolean legacyColumnExists = legacyColumnExists();

        if (legacyColumnExists) {
            try {
                int backfilled = jdbcTemplate.update(
                        "UPDATE " + TABLE + " SET visibility = CASE WHEN " + LEGACY_COLUMN
                                + " = 1 THEN 'UNLISTED' ELSE 'PUBLISHED' END WHERE visibility IS NULL");
                if (backfilled > 0) {
                    log.info("Record visibility migration: backfilled {} row(s) from {}", backfilled, LEGACY_COLUMN);
                }
            } catch (Exception e) {
                log.warn("Record visibility backfill skipped: {}", e.getMessage());
            }
        }

        // Idempotent (WHERE guards): treat the pre-existing public catalogue as already announced so
        // the migration itself never triggers a burst of "new title" pushes.
        try {
            jdbcTemplate.update(
                    "UPDATE " + TABLE + " SET new_release_notified_at = created_at "
                            + "WHERE new_release_notified_at IS NULL AND visibility IS NOT NULL AND visibility <> 'DRAFT'");
        } catch (Exception e) {
            log.warn("Record visibility notified-marker backfill skipped: {}", e.getMessage());
        }

        if (legacyColumnExists) {
            try {
                jdbcTemplate.execute("ALTER TABLE " + TABLE + " DROP COLUMN " + LEGACY_COLUMN);
                log.info("Record visibility migration: dropped legacy column {}", LEGACY_COLUMN);
            } catch (Exception e) {
                log.warn("Dropping legacy {} column skipped: {}", LEGACY_COLUMN, e.getMessage());
            }
        }
    }

    /** Whether the legacy {@code hide_from_rails} column is still present (via information_schema). */
    private boolean legacyColumnExists() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.COLUMNS "
                            + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                    Integer.class, TABLE, LEGACY_COLUMN);
            return count != null && count > 0;
        } catch (Exception e) {
            log.warn("Could not check for legacy {} column — skipping visibility backfill/drop: {}",
                    LEGACY_COLUMN, e.getMessage());
            return false;
        }
    }
}
