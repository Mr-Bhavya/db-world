package com.db.dbworld.app.live.repository;

import com.db.dbworld.app.live.entity.LiveChannelSourceEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LiveChannelSourceRepository extends JpaRepository<LiveChannelSourceEntity, String> {

    List<LiveChannelSourceEntity> findByChannelIdOrderByPriorityAscCreatedAtAsc(String channelId);

    List<LiveChannelSourceEntity> findByChannelIdIn(Collection<String> channelIds);

    Optional<LiveChannelSourceEntity> findByChannelIdAndUrlHash(String channelId, String urlHash);

    List<LiveChannelSourceEntity> findByPlaylistId(String playlistId);

    long countByPlaylistId(String playlistId);

    @Modifying
    @Query("delete from LiveChannelSourceEntity s where s.playlistId = :playlistId")
    int deleteByPlaylistId(@Param("playlistId") String playlistId);

    @Modifying
    @Query("delete from LiveChannelSourceEntity s where s.channelId = :channelId")
    int deleteByChannelId(@Param("channelId") String channelId);

    /**
     * The next slice of sources to probe, least-recently-checked first.
     *
     * <p>Bounded by {@code Pageable} because it must be: a large playlist is thousands of
     * URLs, and probing all of them at a few concurrent connections with an 8s timeout
     * takes many minutes — long enough for a run to still be going when the next one is
     * due, and to be killed mid-flight by a restart. Ordering by {@code lastCheckedAt}
     * turns the cap into a rolling sweep: every run picks up where the last left off, so
     * the whole table is still covered, just across several runs.
     *
     * <p>{@code failCount} is capped by the caller so a URL that has failed many times in
     * a row stops consuming a slot on every single run.
     */
    @Query("""
           select s from LiveChannelSourceEntity s
           where s.enabled = true and s.failCount < :maxFailures
           order by s.lastCheckedAt asc nulls first
           """)
    List<LiveChannelSourceEntity> findProbeQueue(@Param("maxFailures") int maxFailures, Pageable page);

    /** Sources the health sweep has reached at least once — its coverage so far. */
    long countByLastCheckedAtIsNotNull();

    @Query("select max(s.lastCheckedAt) from LiveChannelSourceEntity s")
    java.time.Instant findLastHealthCheckAt();
}
