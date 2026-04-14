package com.db.dbworld.app.cinema.catalog.tags.scheduler;

import com.db.dbworld.app.cinema.catalog.tags.services.RecordTaggingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Scheduled job that refreshes all auto-managed tag pools.
 *
 * <p>Runs every 6 hours by default. Each tag strategy re-scores all records
 * and replaces the previous tag pool atomically (DELETE + bulk INSERT per strategy).
 *
 * <p>The {@link TagStrategyExecutor} records the {@code lastRefreshedAt} timestamp
 * in {@code tag_definitions} after each successful tag strategy run.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TagScheduler {

    private final RecordTaggingService recordTaggingService;

    @Scheduled(cron = "0 0 */6 * * *")
    public void updateTags() {

        Instant start = Instant.now();
        log.info("Starting catalog tag recalculation");

        try {
            recordTaggingService.recalculateAllTags();
            long elapsed = Instant.now().toEpochMilli() - start.toEpochMilli();
            log.info("Finished catalog tag recalculation in {}ms", elapsed);
        } catch (Exception ex) {
            log.error("Tag recalculation failed after {}ms: {}",
                    Instant.now().toEpochMilli() - start.toEpochMilli(), ex.getMessage(), ex);
        }
    }
}
