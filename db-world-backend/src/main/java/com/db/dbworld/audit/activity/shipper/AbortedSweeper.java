package com.db.dbworld.audit.activity.shipper;

import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ActivityType;
import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Marks stalled {@code user_cinema_activity} rows as ABORTED.
 *
 * <p>A row is considered stalled when:
 * <ul>
 *   <li>{@code completion_status} ∈ {STARTED, IN_PROGRESS},</li>
 *   <li>{@code completion_percent} &lt; 95, and</li>
 *   <li>{@code last_updated} is older than the type-specific timeout.</li>
 * </ul>
 *
 * <p>Runs every 5 minutes. Two separate UPDATEs (one per ActivityType) keep the SQL simple.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class AbortedSweeper {

    private final AbortedSweeperProperties      props;
    private final UserCinemaActivityRepository  activityRepo;

    @Scheduled(cron = "0 */5 * * * *")
    @Transactional
    public void sweep() {
        if (!props.isEnabled()) return;
        Instant now = Instant.now();

        Instant streamCutoff   = now.minus(Duration.ofMinutes(props.getStreamTimeoutMin()));
        Instant downloadCutoff = now.minus(Duration.ofMinutes(props.getDownloadTimeoutMin()));

        int streams   = activityRepo.sweepAbortedByType(ActivityType.STREAM.name(),   streamCutoff,   now);
        int downloads = activityRepo.sweepAbortedByType(ActivityType.DOWNLOAD.name(), downloadCutoff, now);

        if (streams + downloads > 0) {
            log.info("AbortedSweeper: marked {} streams + {} downloads as ABORTED", streams, downloads);
        }
    }
}
