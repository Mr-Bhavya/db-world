package com.db.dbworld.audit.activity.recommend;

import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Picks a "you might like this genre" recommendation for the genre-affinity rail.
 *
 * <p>Computes the user's top engaged genres from {@code user_cinema_activity} joined to
 * {@code tmdb_genres}; results are cached per-user for {@link RecommendProperties.Genre#getCacheTtlMin}
 * minutes to avoid hitting MySQL on every rail render.
 *
 * <p>Cold-start: when the user has fewer than {@code minEngagedRecords}, this returns
 * {@code null} so the rail resolver yields an empty Slice and the rail is hidden.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class GenreAffinityService {

    private final RecommendProperties           props;
    private final UserCinemaActivityRepository  activityRepository;

    /** userId → (pickedGenreId, expiresAt). pickedGenreId may be null (= cold-start no-op). */
    private final Map<Long, CacheEntry> cache = new ConcurrentHashMap<>();

    /**
     * Returns the genre ID the genre-affinity rail should source records from, or null
     * when the user has too few engaged records.
     */
    public Long pickGenreFor(Long userId) {
        if (userId == null || !props.getGenre().isEnabled()) return null;

        CacheEntry entry = cache.get(userId);
        if (entry != null && entry.expiresAt.isAfter(Instant.now())) {
            return entry.genreId;
        }

        long engaged = activityRepository.countEngagedRecordsByUser(
                userId, props.getGenre().getCompletionThreshold());
        if (engaged < props.getGenre().getMinEngagedRecords()) {
            cache.put(userId, new CacheEntry(null, expiry()));
            return null;
        }

        List<Long> top = activityRepository.findTopEngagedGenreIdsByUser(
                userId,
                props.getGenre().getCompletionThreshold(),
                props.getGenre().getTopN());
        Long picked = top.isEmpty() ? null : top.get(0);
        cache.put(userId, new CacheEntry(picked, expiry()));

        if (picked != null) {
            log.debug("GenreAffinity: user {} → genre {} (engaged={}, topN={})",
                    userId, picked, engaged, top.size());
        }
        return picked;
    }

    /** Test/admin hook: drop a single user's cached pick. */
    public void invalidate(Long userId) {
        cache.remove(userId);
    }

    /** Test/admin hook: drop all cached picks. */
    public void invalidateAll() {
        cache.clear();
    }

    private Instant expiry() {
        return Instant.now().plus(Duration.ofMinutes(props.getGenre().getCacheTtlMin()));
    }

    private record CacheEntry(Long genreId, Instant expiresAt) {}
}
