package com.db.dbworld.audit.tracking.search;

import com.db.dbworld.audit.tracking.admin.dto.SearchKeywordProjection;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.entity.SearchHistoryEntity;
import com.db.dbworld.audit.tracking.repository.SearchHistoryRepository;
import com.db.dbworld.audit.tracking.search.dto.SearchKeywordDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Per-user search-history storage backing the search bar's "recent searches"
 * dropdown, plus admin keyword analytics. Modeled on {@code AdminActivityService}
 * for the projection-to-record DTO mapping style.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SearchHistoryService {

    private static final int MIN_RECENT_LIMIT = 1;
    private static final int MAX_RECENT_LIMIT = 20;

    private final SearchHistoryRepository searchHistoryRepository;
    private final TrackingProperties trackingProperties;

    /**
     * Records a search, collapsing prefix-chains typed within a short window
     * (e.g. "d" -> "da" -> "dark") into a single row holding the longest query
     * seen so far. Never throws on blank input — the caller (controller) treats
     * search-history recording as best-effort telemetry.
     */
    @Transactional
    public void record(Long userId, String rawQuery, Integer resultCount, Long openedRecordId, String channel) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return;
        }
        String trimmedRaw = rawQuery.trim();
        String queryNorm = trimmedRaw.toLowerCase();

        Instant now = Instant.now();
        var existing = searchHistoryRepository.findTopByUserIdOrderByCreatedAtDesc(userId);

        if (existing.isPresent() && isPrefixCollapseCandidate(existing.get(), queryNorm, now)) {
            SearchHistoryEntity entity = existing.get();
            boolean newIsLonger = queryNorm.length() >= entity.getQueryNorm().length();
            if (newIsLonger) {
                entity.setQueryRaw(trimmedRaw);
                entity.setQueryNorm(queryNorm);
            }
            entity.setResultCount(resultCount);
            entity.setCreatedAt(now);
            if (openedRecordId != null) {
                entity.setOpenedRecordId(openedRecordId);
            }
            if (channel != null) {
                entity.setChannel(channel);
            }
            searchHistoryRepository.save(entity);
            return;
        }

        SearchHistoryEntity entity = SearchHistoryEntity.builder()
                .userId(userId)
                .queryRaw(trimmedRaw)
                .queryNorm(queryNorm)
                .resultCount(resultCount)
                .openedRecordId(openedRecordId)
                .channel(channel)
                .createdAt(now)
                .build();
        searchHistoryRepository.save(entity);
    }

    private boolean isPrefixCollapseCandidate(SearchHistoryEntity lastEntry, String newNorm, Instant now) {
        Instant createdAt = lastEntry.getCreatedAt();
        if (createdAt == null) {
            return false;
        }
        long windowSec = trackingProperties.getSearchPrefixCollapseSec();
        boolean withinWindow = ChronoUnit.SECONDS.between(createdAt, now) <= windowSec;
        if (!withinWindow) {
            return false;
        }
        String lastNorm = lastEntry.getQueryNorm();
        if (lastNorm == null) {
            return false;
        }
        return lastNorm.startsWith(newNorm) || newNorm.startsWith(lastNorm);
    }

    @Transactional(readOnly = true)
    public List<String> recent(Long userId, int limit) {
        int safeLimit = Math.max(MIN_RECENT_LIMIT, Math.min(limit, MAX_RECENT_LIMIT));
        log.debug("recent userId={} limit={} (clamped={})", userId, limit, safeLimit);
        return searchHistoryRepository.findRecentDistinctQueries(userId, safeLimit);
    }

    @Transactional
    public long clearAll(Long userId) {
        return searchHistoryRepository.deleteByUserId(userId);
    }

    @Transactional
    public long clearOne(Long userId, String rawQuery) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return 0L;
        }
        String queryNorm = rawQuery.trim().toLowerCase();
        return searchHistoryRepository.deleteByUserIdAndQueryNorm(userId, queryNorm);
    }

    @Transactional(readOnly = true)
    public List<SearchKeywordDto> topKeywords(int days, int limit) {
        int safeDays = Math.max(1, Math.min(days, 365));
        int safeLimit = Math.max(1, Math.min(limit, 100));
        log.debug("topKeywords days={} limit={}", safeDays, safeLimit);
        List<SearchKeywordProjection> rows = searchHistoryRepository.findTopKeywords(safeDays, safeLimit);
        return rows.stream()
                .map(p -> new SearchKeywordDto(p.getQueryNorm(), nz(p.getSearchCount()), nz(p.getZeroResultCount())))
                .toList();
    }

    private static long nz(Long value) {
        return value != null ? value : 0L;
    }
}
