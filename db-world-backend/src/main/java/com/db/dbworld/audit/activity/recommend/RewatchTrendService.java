package com.db.dbworld.audit.activity.recommend;

import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Maintains the site-wide list of "Popular rewatches this week" record IDs.
 *
 * <p>Refreshed on a cron schedule (default hourly) so the rail render path never hits
 * the heavy aggregate query. The cached list is plain {@code volatile} — single writer,
 * many readers — which is enough for the small set we maintain.
 *
 * <p>Cold-start: when no records meet the score threshold the list is empty and the
 * rail resolver yields an empty Slice (rail hidden by the existing {@code hasContent}
 * guard).
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class RewatchTrendService {

    private final RecommendProperties           props;
    private final UserCinemaActivityRepository  activityRepository;

    private volatile List<Long> topRecordIds = List.of();

    @PostConstruct
    void warmOnStartup() {
        if (!props.getRewatch().isEnabled()) return;
        try {
            refresh();
        } catch (Exception ex) {
            log.warn("RewatchTrendService: initial warmup failed, will retry on schedule", ex);
        }
    }

    @Scheduled(cron = "${dbworld.recommend.rewatch.refresh-cron:0 0 * * * *}")
    public void refresh() {
        if (!props.getRewatch().isEnabled()) return;
        List<Long> latest = activityRepository.findTopRewatchedRecordIds(
                props.getRewatch().getWindowDays(),
                props.getRewatch().getMinScore(),
                props.getRewatch().getTopN());
        topRecordIds = List.copyOf(latest);
        log.info("RewatchTrendService: refreshed top rewatches → {} records (windowDays={}, minScore={})",
                topRecordIds.size(),
                props.getRewatch().getWindowDays(),
                props.getRewatch().getMinScore());
    }

    /** Immutable snapshot of the latest top-rewatched record IDs (most rewatched first). */
    public List<Long> snapshot() {
        return topRecordIds;
    }
}
