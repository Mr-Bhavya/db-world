package com.db.dbworld.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.Arrays;
import java.util.Comparator;

/**
 * One-shot migration runner. Executes every {@code classpath:db/migration/*.sql} file in
 * alphabetical order on application startup, then stops. Intended for bootstrapping a
 * fresh environment without running SQL by hand.
 *
 * <h3>How to use</h3>
 * <ol>
 *   <li>Set {@code dbworld.migrations.run-on-startup=true} (env var
 *       {@code DBWORLD_MIGRATIONS_RUN_ON_STARTUP=true}) and start the app.</li>
 *   <li>Watch the logs — each script is announced before it runs.</li>
 *   <li>Once successful, set the flag back to {@code false} (or remove it) AND delete
 *       this class so it cannot fire again.</li>
 * </ol>
 *
 * <h3>Caveats</h3>
 * <ul>
 *   <li>The scripts in {@code db/migration/} are NOT idempotent (some contain ALTER /
 *       UPDATE / DELETE). Running them twice against the same DB may fail or corrupt
 *       state. There is no tracking table by design — this is a one-time bootstrap.</li>
 *   <li>Order is alphabetical by filename. The current set sorts to a sane phase order
 *       (v2 phase1 → phase2 → hotfix → v3 phase1 → phase2). If you add a script that
 *       must run earlier/later, prefix the filename to control ordering.</li>
 *   <li>Each script runs in its own transaction; a failure aborts the runner.</li>
 * </ul>
 */
@Log4j2
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "dbworld.migrations", name = "run-on-startup", havingValue = "true")
public class OneShotMigrationRunner implements ApplicationRunner {

    private static final String MIGRATION_PATTERN = "classpath:db/migration/*.sql";

    private final DataSource dataSource;

    @Override
    public void run(org.springframework.boot.ApplicationArguments args) throws Exception {
        ResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Resource[] resources = resolver.getResources(MIGRATION_PATTERN);

        if (resources.length == 0) {
            log.warn("OneShotMigrationRunner: no scripts found at {}", MIGRATION_PATTERN);
            return;
        }

        Arrays.sort(resources, Comparator.comparing(r -> {
            String n = r.getFilename();
            return n == null ? "" : n;
        }));

        log.warn("OneShotMigrationRunner: about to execute {} migration script(s). " +
                "Remember to disable dbworld.migrations.run-on-startup and delete this class once done.",
                resources.length);

        for (int i = 0; i < resources.length; i++) {
            Resource r = resources[i];
            String name = r.getFilename();
            log.info("OneShotMigrationRunner: [{}/{}] running {}", i + 1, resources.length, name);
            try {
                ResourceDatabasePopulator populator = new ResourceDatabasePopulator(r);
                populator.setSeparator(";");
                populator.setIgnoreFailedDrops(true);
                populator.setContinueOnError(false);
                populator.execute(dataSource);
                log.info("OneShotMigrationRunner: [{}/{}] {} OK", i + 1, resources.length, name);
            } catch (Exception ex) {
                log.error("OneShotMigrationRunner: [{}/{}] {} FAILED — aborting. " +
                        "Fix the script (or DB state), then re-run.", i + 1, resources.length, name, ex);
                throw ex;
            }
        }

        log.warn("OneShotMigrationRunner: all {} script(s) executed successfully. " +
                "DISABLE dbworld.migrations.run-on-startup and delete OneShotMigrationRunner.java now.",
                resources.length);
    }
}
