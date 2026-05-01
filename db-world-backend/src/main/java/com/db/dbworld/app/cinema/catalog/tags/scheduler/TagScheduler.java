package com.db.dbworld.app.cinema.catalog.tags.scheduler;

import com.db.dbworld.app.cinema.catalog.tags.services.RecordTaggingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Tag refresh job. Cron schedule and enabled state are managed by
 * {@link com.db.dbworld.app.admin.scheduler.service.SchedulerAdminService}.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TagScheduler {

    private final RecordTaggingService recordTaggingService;

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
