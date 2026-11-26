package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.admin.scheduler.service.SchedulerAdminService;
import com.db.dbworld.app.ipo.dto.IpoChangeDto;
import com.db.dbworld.app.ipo.dto.IpoStatusPreviewDto;
import com.db.dbworld.app.ipo.dto.SourceHealthDto;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoSourcePollRepository;
import com.db.dbworld.app.ipo.scheduler.IpoPollScheduler;
import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
public class IpoAdminService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final IpoSourcePollRepository sourcePollRepository;
    private final IpoChangeEventRepository changeEventRepository;
    private final SchedulerAdminService schedulerAdminService;
    private final IpoMapper mapper;
    private final IpoStatusSweepService sweepService;
    private final SettingsService settings;
    private final Clock clock;

    @Autowired
    public IpoAdminService(IpoSourcePollRepository sourcePollRepository,
                           IpoChangeEventRepository changeEventRepository,
                           SchedulerAdminService schedulerAdminService, IpoMapper mapper,
                           IpoStatusSweepService sweepService, SettingsService settings) {
        this(sourcePollRepository, changeEventRepository, schedulerAdminService, mapper,
                sweepService, settings, Clock.systemUTC());
    }

    IpoAdminService(IpoSourcePollRepository sourcePollRepository,
                    IpoChangeEventRepository changeEventRepository,
                    SchedulerAdminService schedulerAdminService, IpoMapper mapper,
                    IpoStatusSweepService sweepService, SettingsService settings, Clock clock) {
        this.sourcePollRepository = sourcePollRepository;
        this.changeEventRepository = changeEventRepository;
        this.schedulerAdminService = schedulerAdminService;
        this.mapper = mapper;
        this.sweepService = sweepService;
        this.settings = settings;
        this.clock = clock;
    }

    /**
     * Dry run of the next status sweep: what would move, whether it would push, and whether a row
     * turning "listed" is already past the public list's hide window. Writes nothing.
     */
    public IpoStatusPreviewDto.Report statusPreview() {
        long hideAfterDays = settings.getLong(ConfigKeys.IPO_LIST_HIDE_LISTED_AFTER_DAYS);
        LocalDate cutoff = hideAfterDays > 0
                ? LocalDate.now(clock.withZone(IST)).minusDays(hideAfterDays) : null;
        List<IpoStatusPreviewDto.Row> rows = sweepService.preview().stream()
                .map(change -> {
                    var ipo = change.ipo();
                    boolean hidden = cutoff != null && "listed".equals(change.to())
                            && ipo.getListingDate() != null && ipo.getListingDate().isBefore(cutoff);
                    return new IpoStatusPreviewDto.Row(ipo.getId(), ipo.getCompanyName(),
                            ipo.getIpoType(), change.from(), change.to(), ipo.getListingDate(),
                            ipo.getListingPrice(), change.announces(), hidden);
                })
                .toList();
        return new IpoStatusPreviewDto.Report(hideAfterDays, rows);
    }

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
     * One page of the change feed. {@code eventType} filters (blank = all); {@code before} is the
     * {@code createdAt} of the last row already shown ("load older"); {@code limit} is clamped to 1..200.
     */
    public List<IpoChangeDto> recentChanges(String eventType, Instant before, String beforeId, int limit) {
        String type = eventType == null || eventType.isBlank() ? null : eventType.trim().toUpperCase(java.util.Locale.ROOT);
        return changeEventRepository.findFeedPage(type, before, beforeId,
                        org.springframework.data.domain.Limit.of(Math.clamp(limit, 1, 200)))
                .stream()
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
