package com.db.dbworld.app.cinema.catalog.tags.scheduler;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategyExecutor;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategyExecutor.TagRefreshReport;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Tag refresh job. Cron schedule and enabled state are managed by
 * {@link com.db.dbworld.app.admin.scheduler.service.SchedulerAdminService}, which also owns
 * this run's correlation id, timing and history row (see {@code JobRunRecorder}).
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TagScheduler {

    private final TagStrategyExecutor tagStrategyExecutor;

    public void updateTags(JobRunSummary.Builder summary) {
        Instant start = Instant.now();
        log.info("Starting catalog tag recalculation");

        // Failures propagate: this used to catch and log, which meant a tag refresh that blew
        // up still recorded SUCCESS in the run history.
        TagRefreshReport report = tagStrategyExecutor.executeAll();

        long elapsed = Instant.now().toEpochMilli() - start.toEpochMilli();
        log.info("Finished catalog tag recalculation in {}ms ({})", elapsed, report);

        summary.count("strategiesRun",     report.strategiesRun())
               .count("strategiesSkipped", report.strategiesSkipped())
               .count("ruleTagsRefreshed", report.ruleTagsRefreshed())
               .count("ruleTagsFailed",    report.ruleTagsFailed());
        if (report.ruleTagsFailed() > 0) {
            summary.note(report.ruleTagsFailed() + " admin rule tag(s) failed to refresh — see logs");
        }
    }
}
