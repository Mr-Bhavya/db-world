package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Advances stored IPO statuses that the calendar has moved past, without waiting for a poll.
 *
 * <h2>Why this exists</h2>
 * Every status boundary an Indian IPO has is a pure function of two things we already store and
 * the clock: bidding opens at 10&nbsp;AM IST on the open date and closes at 5&nbsp;PM IST on the
 * close date. Nothing needs fetching to know an issue is now open.
 *
 * <p>Despite that, status was only ever recomputed inside {@code IpoIngestService} — i.e. only
 * during an {@code ipo-poll} run, and only for IPOs a source happened to re-report in that run.
 * Three consequences, all of them user-visible:
 * <ul>
 *   <li><b>An IPO stayed "Upcoming" for hours after it opened.</b> The poll is expensive (dozens
 *       of HTTP calls) so it runs every couple of hours; bidding opens at 10&nbsp;AM and the list
 *       kept saying Upcoming until the next poll. Production showed five IPOs all flipping to open
 *       in the 12:00 pass on their open day — two hours late, and the "IPO is open" push with
 *       them.</li>
 *   <li><b>Overnight the gap is far worse than a couple of hours</b>, because the poll cron only
 *       covers daytime IST: the last run of one day to the first of the next is a long silence,
 *       and any boundary crossed inside it waits the whole way.</li>
 *   <li><b>An IPO a source stopped reporting froze permanently.</b> NSE drops an issue once it is
 *       no longer current, so nothing re-derived its status ever again.</li>
 * </ul>
 *
 * <h2>How</h2>
 * Runs on the {@code ipo-live} tick (every 30 minutes across the notification window) — one query
 * over a couple of hundred rows and a write only for the ones that actually moved, so it is cheap
 * enough to sit alongside the live GMP refresh. It applies
 * {@link IpoStatusCanonicalizer#calendarCorrected} — the exact same rule the ingest path applies to
 * an incoming source row — so a swept row and a polled row can never disagree.
 *
 * <p>Each change is written as a {@code STATUS} change event as well as to the listing, so the
 * "IPO is open" push rides the existing notification queue and arrives within half an hour of the
 * real open moment instead of at whatever hour the next poll happened to fall.
 */
@Log4j2
@Service
public class IpoStatusSweepService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String EVENT_STATUS = "STATUS";

    private final IpoListingRepository listingRepo;
    private final IpoChangeEventRepository changeEventRepo;
    private final Clock clock;

    @Autowired
    public IpoStatusSweepService(IpoListingRepository listingRepo, IpoChangeEventRepository changeEventRepo) {
        this(listingRepo, changeEventRepo, Clock.systemUTC());
    }

    /** Test-friendly constructor with an injectable clock for deterministic boundaries. */
    IpoStatusSweepService(IpoListingRepository listingRepo, IpoChangeEventRepository changeEventRepo, Clock clock) {
        this.listingRepo = listingRepo;
        this.changeEventRepo = changeEventRepo;
        this.clock = clock;
    }

    /**
     * One sweep. Never throws — a failure here must not take down the live refresh it shares a job
     * with, and the next tick simply tries again.
     *
     * @return how many listings were advanced
     */
    public int sweepQuietly() {
        try {
            return sweep();
        } catch (Exception e) {
            log.warn("IPO status sweep failed — statuses stay as they are until the next tick: {}", e.toString());
            return 0;
        }
    }

    /** @return how many listings the calendar moved. Visible for tests. */
    @Transactional
    public int sweep() {
        LocalDateTime nowIst = LocalDateTime.now(clock.withZone(IST));
        Instant now = clock.instant();

        List<IpoListingEntity> advanced = new ArrayList<>();
        List<IpoChangeEventEntity> events = new ArrayList<>();
        for (IpoListingEntity ipo : listingRepo.findAllLive()) {
            String current = ipo.getStatus();
            String corrected = IpoStatusCanonicalizer.calendarCorrected(
                    current, ipo.getOpenDate(), ipo.getCloseDate(), nowIst);
            if (Objects.equals(current, corrected)) {
                continue;
            }
            ipo.setStatus(corrected);
            advanced.add(ipo);
            // Same shape the ingest path writes, so IpoLifecycleChange maps it to the OPENED push
            // exactly as it would have done had a poll caught the transition.
            events.add(IpoChangeEventEntity.builder()
                    .ipoId(ipo.getId())
                    .eventType(EVENT_STATUS)
                    .oldValue(current)
                    .newValue(corrected)
                    .createdAt(now)
                    .build());
        }
        if (advanced.isEmpty()) {
            return 0;
        }
        listingRepo.saveAll(advanced);
        changeEventRepo.saveAll(events);
        log.info("IPO status sweep: advanced {} listing(s) — {}", advanced.size(),
                advanced.stream()
                        .map(i -> i.getCompanyName() + " -> " + i.getStatus())
                        .toList());
        return advanced.size();
    }
}
