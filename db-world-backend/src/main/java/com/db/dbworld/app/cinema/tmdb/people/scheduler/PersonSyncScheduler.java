package com.db.dbworld.app.cinema.tmdb.people.scheduler;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.cinema.tmdb.people.service.PersonSyncService;
import com.db.dbworld.app.cinema.tmdb.people.service.PersonSyncService.PersonSyncReport;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Person detail backfill job. Correlation id, timing and the run history row are owned by
 * {@code JobRunRecorder} on the scheduler side.
 */
@Component
@RequiredArgsConstructor
@Log4j2
public class PersonSyncScheduler {

    private final PersonSyncService personSyncService;

    public void runPersonSync(JobRunSummary.Builder summary) {
        long start = System.currentTimeMillis();

        long unsynced = personSyncService.countUnsynced();
        if (unsynced == 0) {
            log.info("PersonSync skipped — all persons already synced");
            summary.count("pending", 0).note("Nothing to do — every person already has full details");
            return;
        }

        log.info("PersonSync scheduled run starting — {} unsynced persons", unsynced);

        // Live progress for the admin page: this run walks every unsynced person at TMDB's
        // rate limit, so it can take minutes and needs to look like it is getting somewhere.
        AtomicLong liveSynced = new AtomicLong();
        AtomicLong liveFailed = new AtomicLong();
        summary.progress(() -> Map.of(
                "pending", unsynced,
                "synced",  liveSynced.get(),
                "failed",  liveFailed.get()));

        PersonSyncReport report = personSyncService.syncUnsyncedPersons((s, f) -> {
            liveSynced.set(s);
            liveFailed.set(f);
        });
        log.info("PersonSync scheduled run completed; took={}ms", System.currentTimeMillis() - start);

        summary.count("pending", report.pending())
               .count("synced",  report.synced())
               .count("failed",  report.failed());
        if (report.interrupted()) {
            summary.note("Stopped early — the run thread was interrupted; the rest is picked up next run");
        }
    }
}
