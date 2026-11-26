package com.db.dbworld.app.media.ingestion.repository;

import com.db.dbworld.app.media.ingestion.entity.IngestionJobEntity;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class IngestionJobRepositoryHistoryTest {

    @TestConfiguration
    static class CacheStubConfig {
        @Bean
        CacheManager cacheManager() {
            return new NoOpCacheManager();
        }
    }

    @Autowired private IngestionJobRepository repo;

    @BeforeEach
    void seed() {
        repo.deleteAll();
        repo.saveAll(List.of(
                job("a", MirrorStatus.SUCCESS, "Movie.One.mkv", 1),
                job("b", MirrorStatus.FAILED, "Show.S01E01.mkv", 2),
                job("c", MirrorStatus.SUCCESS, "Show.S01E02.mkv", 3)));
    }

    @Test
    void pagesNewestFirstAndFiltersByStatusAndText() {
        PageRequest firstTwo = PageRequest.of(0, 2, Sort.by(Sort.Direction.DESC, "startedAt"));

        Page<IngestionHistoryRow> all = repo.searchHistory(null, null, firstTwo);
        assertThat(all.getTotalElements()).isEqualTo(3);
        assertThat(all.getContent()).extracting(IngestionHistoryRow::jobId).containsExactly("c", "b");

        Page<IngestionHistoryRow> shows = repo.searchHistory(MirrorStatus.SUCCESS, "%show%", firstTwo);
        assertThat(shows.getContent()).extracting(IngestionHistoryRow::jobId).containsExactly("c");

        // "_" is a wildcard unless escaped: "%e!_%" must not match names without a literal underscore.
        assertThat(repo.searchHistory(null, "%e!_%", firstTwo).getContent()).isEmpty();
    }

    @Test
    void countsEveryStatus() {
        assertThat(repo.countGroupedByStatus())
                .extracting(r -> r[0] + "=" + r[1])
                .containsExactlyInAnyOrder("SUCCESS=2", "FAILED=1");
    }

    private static IngestionJobEntity job(String id, MirrorStatus status, String file, int minute) {
        IngestionJobEntity e = new IngestionJobEntity();
        e.setJobId(id);
        e.setStatus(status);
        e.setFileName(file);
        e.setStartedAt(Instant.parse("2026-01-01T00:00:00Z").plusSeconds(60L * minute));
        return e;
    }
}
