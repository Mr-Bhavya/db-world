package com.db.dbworld.audit.activity.recommend;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Maintains the site-wide list of "Popular rewatches this week" record IDs.
 *
 * <p>Refreshed on a cron schedule (default hourly, see {@link RewatchSchedulingConfig})
 * so the rail render path never hits the heavy aggregate query. The cached list is
 * plain {@code volatile} — single writer, many readers — which is enough for the
 * small set we maintain.
 *
 * <p>Cold-start: when no records meet the score threshold the list is empty and the
 * rail resolver yields an empty Slice (rail hidden by the existing {@code hasContent}
 * guard).
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class RewatchTrendService {

    private final SettingsService           settings;
    private final ActivitySessionRepository activitySessionRepository;

    private volatile List<Long> topRecordIds = List.of();

    @PostConstruct
    void warmOnStartup() {
        if (!settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)) return;
        try {
            refresh();
        } catch (Exception ex) {
            log.warn("RewatchTrendService: initial warmup failed, will retry on schedule", ex);
        }
    }

    /** Invoked by {@link RewatchSchedulingConfig} on the live cron schedule. */
    public void refresh() {
        if (!settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)) return;
        int windowDays = settings.getInt(ConfigKeys.RECOMMEND_REWATCH_WINDOW_DAYS);
        int minScore   = settings.getInt(ConfigKeys.RECOMMEND_REWATCH_MIN_SCORE);
        int topN       = settings.getInt(ConfigKeys.RECOMMEND_REWATCH_TOP_N);
        topRecordIds = List.copyOf(
                activitySessionRepository.findTopRewatchedRecordIds(windowDays, minScore, topN));
        log.info("RewatchTrendService: refreshed top rewatches → {} records (windowDays={}, minScore={})",
                topRecordIds.size(), windowDays, minScore);
    }

    /** Immutable snapshot of the latest top-rewatched record IDs (most rewatched first). */
    public List<Long> snapshot() {
        return topRecordIds;
    }
}
