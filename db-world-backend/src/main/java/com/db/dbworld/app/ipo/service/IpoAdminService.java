package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.scheduler.service.SchedulerAdminService;
import com.db.dbworld.app.ipo.dto.IpoChangeDto;
import com.db.dbworld.app.ipo.dto.SourceHealthDto;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoSourcePollRepository;
import com.db.dbworld.app.ipo.scheduler.IpoPollScheduler;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Backs the admin IPO console: per-source poll health, the recent change feed, and a manual
 * "re-poll now" action.
 *
 * <p>Cadence editing intentionally lives on the existing admin Scheduler page ({@code ipo-poll}
 * is a normal {@code scheduler_job_config} row) — this service only surfaces health/changes and
 * triggers an out-of-band run. The trigger delegates to {@link SchedulerAdminService#triggerNow}
 * so the scheduler's RUNNING guard and job-history bookkeeping apply; it must never call
 * {@link IpoPollScheduler#pollOnce()} directly, which would bypass that guard.
 */
@Service
@RequiredArgsConstructor
public class IpoAdminService {

    private final IpoSourcePollRepository sourcePollRepository;
    private final IpoChangeEventRepository changeEventRepository;
    private final SchedulerAdminService schedulerAdminService;
    private final IpoMapper mapper;

    /** Poll health for every known IPO source. */
    public List<SourceHealthDto> sourceHealth() {
        return sourcePollRepository.findAll().stream()
                .map(mapper::toSourceHealth)
                .toList();
    }

    /** The 50 most recent ingest-detected change events, newest first. */
    public List<IpoChangeDto> recentChanges() {
        return changeEventRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map(mapper::toChangeDto)
                .toList();
    }

    /**
     * Triggers an out-of-cycle {@code ipo-poll} run via the shared scheduler dispatch.
     *
     * @throws DbWorldException 409 CONFLICT if the job is already running (or unknown).
     */
    public void repoll() {
        boolean started = schedulerAdminService.triggerNow(IpoPollScheduler.JOB_ID);
        if (!started) {
            throw new DbWorldException(HttpStatus.CONFLICT, "IPO poll already running");
        }
    }
}
