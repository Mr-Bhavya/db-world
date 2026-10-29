package com.db.dbworld.app.downloader;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.ActiveProfiles;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class DownloadJobRepositoryTest {
    @TestConfiguration static class CacheStub {
        @Bean CacheManager cacheManager() { return new NoOpCacheManager(); }
    }
    @Autowired DownloadJobRepository repository;

    @Test void storesOwnedJobsAndQueriesQueueAndExpiry() {
        DownloadJob job = new DownloadJob();
        job.setId("repository-test");
        job.setOwner("alice");
        job.setUrl("https://example.com/video");
        job.setStatus("QUEUED");
        job.setVideoFormat("401");
        job.setAudioFormat("251");
        job.setContainer("webm");
        job.setCreatedAt(Instant.now());
        repository.saveAndFlush(job);
        assertEquals("401", repository.findById(job.getId()).orElseThrow().getVideoFormat());
        assertEquals(1, repository.findByOwnerOrderByCreatedAtDesc("alice").size());
        assertTrue(repository.findByOwnerOrderByCreatedAtDesc("bob").isEmpty());
        assertEquals(1, repository.findByStatusInOrderByCreatedAtAsc(List.of("QUEUED")).size());
        job.setStatus("READY");
        job.setExpiresAt(Instant.now().minusSeconds(1));
        repository.saveAndFlush(job);
        assertEquals(1, repository.findByExpiresAtBeforeAndStatus(Instant.now(), "READY").size());
    }
}