package com.db.dbworld.app.pm.service.impl;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.pm.service.PasswordManagerService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Removes vault entries that have sat in Trash for more than 30 days.
 *
 * <p>Runs once a day, driven by the {@code VaultTrashPurge} entry in {@code scheduler_job_config}
 * (seeded in {@code SchedulerAdminService}), so it gets the usual run-now / history / enable-disable
 * treatment on the admin Scheduler page. The removal itself is {@link PasswordManagerService#purgeTrashedEntry},
 * the same removal "Delete forever" does.
 */
@Log4j2
@Component
public class TrashPurgeJob {

    /** Job id used in scheduler_job_config. */
    public static final String JOB_ID = "VaultTrashPurge";

    /** How long an entry stays restorable. */
    public static final Duration RETENTION = Duration.ofDays(30);

    private final PasswordManagerService service;
    private final Clock clock;

    @Autowired
    public TrashPurgeJob(PasswordManagerService service) {
        this(service, Clock.systemUTC());
    }

    public TrashPurgeJob(PasswordManagerService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    /**
     * One daily pass: removes what was trashed before now - 30 days. Each entry is removed in its own
     * transaction, so one that fails (and is retried the next day) does not hold back the others.
     */
    public void purgeExpired(JobRunSummary.Builder summary) {
        Instant cutoff = clock.instant().minus(RETENTION);
        int removed = 0;
        int failed = 0;
        for (String id : service.findTrashedBefore(cutoff)) {
            try {
                if (service.purgeTrashedEntry(id, cutoff)) removed++;
            } catch (RuntimeException e) {
                failed++;
                log.error("Vault trash purge could not remove credentialId={}", id, e);   // ids only, never a value
            }
        }
        log.info("Vault trash purge: removed={}, failed={}, cutoff={}", removed, failed, cutoff);
        summary.count("entriesRemoved", removed).count("entriesFailed", failed);
        String note = removed == 0 && failed == 0
                ? "Nothing to purge — nothing has been in Trash for more than 30 days"
                : "Removed " + removed + " entr" + (removed == 1 ? "y" : "ies") + " trashed more than 30 days ago";
        summary.note(failed == 0 ? note : note + "; " + failed + " failed and will be retried tomorrow (see the log)");
    }
}
