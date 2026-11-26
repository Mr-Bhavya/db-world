package com.db.dbworld.app.home.service;

import com.db.dbworld.app.home.dto.HomeSummaryDto;
import com.db.dbworld.config.RedisConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.serializer.RedisSerializer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The shared home snapshot is an optimisation: it must never serve a broken tile or fail the page. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HomeSummaryCacheTest {

    @Mock private RedisTemplate<String, Object> redisTemplate;
    @Mock private ValueOperations<String, Object> ops;

    private HomeSummaryCache cache;

    private static final HomeSummaryCache.PublicSnapshot COMPLETE = new HomeSummaryCache.PublicSnapshot(
            new HomeSummaryDto.IpoSection(1, 0, null, null, List.of()),
            new HomeSummaryDto.CinemaSection(List.of(), null, 1, 1, 0, 0),
            null);

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(ops);
        cache = new HomeSummaryCache(redisTemplate);
    }

    @Test
    void hitIsServedWithoutBuilding() {
        when(ops.get(HomeSummaryCache.KEY)).thenReturn(COMPLETE);
        AtomicInteger builds = new AtomicInteger();

        assertThat(cache.getOrBuild(() -> { builds.incrementAndGet(); return null; })).isEqualTo(COMPLETE);
        assertThat(builds).hasValue(0);
    }

    @Test
    void missBuildsAndStoresWithTheTtl() {
        assertThat(cache.getOrBuild(() -> COMPLETE)).isEqualTo(COMPLETE);
        verify(ops).set(HomeSummaryCache.KEY, COMPLETE, HomeSummaryCache.TTL);
    }

    /** A failed IPO feed must cost one request its tile, not every visitor for a full TTL. */
    @Test
    void snapshotWithAFailedSectionIsNotStored() {
        var partial = new HomeSummaryCache.PublicSnapshot(null, COMPLETE.cinema(), null);

        assertThat(cache.getOrBuild(() -> partial)).isEqualTo(partial);
        verify(ops, never()).set(anyString(), any(), any(java.time.Duration.class));
    }

    @Test
    void redisOutageFallsBackToBuilding() {
        when(ops.get(anyString())).thenThrow(new RedisConnectionFailureException("down"));
        doThrow(new RedisConnectionFailureException("down"))
                .when(ops).set(anyString(), any(), any(java.time.Duration.class));

        assertThat(cache.getOrBuild(() -> COMPLETE)).isEqualTo(COMPLETE);
    }

    /** Round-trips through the app's real value serializer, immutable lists, dates and decimals included. */
    @Test
    @SuppressWarnings("unchecked")
    void snapshotSurvivesTheConfiguredRedisSerializer() {
        RedisSerializer<Object> serializer = (RedisSerializer<Object>) new RedisConfig()
                .redisTemplate(mock(RedisConnectionFactory.class)).getValueSerializer();
        var ipo = new HomeSummaryDto.IpoHighlight("x", "Acme", null, "open",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5), new BigDecimal("12.5"));
        var snapshot = new HomeSummaryCache.PublicSnapshot(
                new HomeSummaryDto.IpoSection(1, 0, ipo, ipo, Stream.of(ipo).toList()),
                new HomeSummaryDto.CinemaSection(
                        List.of(new HomeSummaryDto.CinemaTitle(1L, "Dune", "MOVIE", "/d.jpg")), null, 1, 1, 0, 0),
                new HomeSummaryDto.LiveSection(3, 2, 1, List.of()));

        Object back = serializer.deserialize(serializer.serialize(snapshot));

        assertThat(back).isEqualTo(snapshot);
    }
}
