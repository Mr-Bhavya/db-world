package com.db.dbworld.app.home.service;

import com.db.dbworld.app.home.dto.HomeSummaryDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.function.Supplier;

/**
 * Short-lived Redis cache for the visitor-independent half of the home summary.
 *
 * <p>The IPO list, the newest cinema titles with the library counts, and the Live TV counters are
 * the same for every caller, yet they were recomputed on every hit of the busiest page, including
 * anonymous visitors and crawlers. One snapshot is shared across all callers for {@link #TTL};
 * user-scoped sections are never stored here.
 *
 * <p>Redis is an optimisation, never a dependency: any read or write failure falls back to
 * building the snapshot directly, so an unavailable cache costs latency, not the landing page.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class HomeSummaryCache {

    /** Versioned so a change to the snapshot's shape never deserialises an older entry. */
    static final String KEY = "home:summary:public:v1";

    /** Long enough to absorb bursts, short enough that a new IPO or title shows up within a minute. */
    static final Duration TTL = Duration.ofSeconds(60);

    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * The public sections, shared by every caller. {@code cinema} never carries a
     * {@code continueWatching} item; that is merged per user by the service.
     */
    public record PublicSnapshot(
            HomeSummaryDto.IpoSection ipo,
            HomeSummaryDto.CinemaSection cinema,
            HomeSummaryDto.LiveSection live
    ) {
        /** A snapshot with a failed section must not be served to everyone for a full TTL. */
        boolean complete() {
            return ipo != null && cinema != null;
        }
    }

    public PublicSnapshot getOrBuild(Supplier<PublicSnapshot> build) {
        PublicSnapshot cached = read();
        if (cached != null) return cached;

        PublicSnapshot fresh = build.get();
        if (fresh != null && fresh.complete()) write(fresh);
        return fresh;
    }

    private PublicSnapshot read() {
        try {
            return redisTemplate.opsForValue().get(KEY) instanceof PublicSnapshot snapshot ? snapshot : null;
        } catch (Exception e) {
            log.debug("Home summary cache read failed; building directly: {}", e.getMessage());
            return null;
        }
    }

    private void write(PublicSnapshot snapshot) {
        try {
            redisTemplate.opsForValue().set(KEY, snapshot, TTL);
        } catch (Exception e) {
            log.debug("Home summary cache write failed: {}", e.getMessage());
        }
    }
}
