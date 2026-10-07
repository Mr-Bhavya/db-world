package com.db.dbworld.app.media.ingestion.pipeline;

import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.media.enrichment.SmartTrackFilterService;
import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.app.media.ingestion.model.SourceMetadata;
import com.db.dbworld.app.media.ingestion.persistence.IngestionRepository;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.spi.DownloadStrategy;
import com.db.dbworld.app.media.ingestion.spi.ProcessingStrategy;
import com.db.dbworld.app.media.ingestion.spi.SourceHandler;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.TrackReviewCoordinator;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.app.media.ingestion.tracking.log.LogCollector;
import com.db.dbworld.core.push.PushService;
import com.db.dbworld.infrastructure.storage.MediaDiskGuard;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Refused work FAILS with the reason, through the pipeline's normal failure path: the job state
 * model has no "held until the disk returns" state, and a FAILED job keeps its reason in history
 * and can be rerun.
 */
class DefaultIngestionPipelineMediaDiskTest {

    @TempDir Path disk;
    @TempDir Path temp;

    SourceHandler       handler    = mock(SourceHandler.class);
    DownloadStrategy    downloader = mock(DownloadStrategy.class);
    ProcessingStrategy  processor  = mock(ProcessingStrategy.class);
    TrackingService     tracking   = mock(TrackingService.class);
    IngestionRepository repository = mock(IngestionRepository.class);
    ExecutorService     executor   = Executors.newSingleThreadExecutor();

    @BeforeEach
    void setUp() {
        when(tracking.getLogCollector(any())).thenReturn(new LogCollector());
        when(handler.supports(any())).thenReturn(true);
        SourceMetadata http = new SourceMetadata();
        http.setType("HTTP");
        when(handler.resolve(any())).thenReturn(http);
        when(downloader.supports(any())).thenReturn(true);
        when(processor.supports(any())).thenReturn(true);
    }

    private Path marker() {
        return disk.resolve(".dbworld-media-disk");
    }

    private DefaultIngestionPipeline pipeline(MediaDiskGuard guard) {
        return new DefaultIngestionPipeline(List.of(handler), List.of(downloader), List.of(processor),
                tracking, repository, executor, mock(IngestionJobStore.class), mock(IngestionDownloadQueue.class),
                mock(RecordRepository.class), mock(PushService.class), mock(CatalogService.class),
                mock(SmartTrackFilterService.class), mock(TrackReviewCoordinator.class),
                mock(SettingsService.class), mock(FileStorageService.class), guard);
    }

    /** Starts a job and waits for the (single-threaded) executor to finish it. */
    private String runJob(DefaultIngestionPipeline pipeline) throws InterruptedException {
        IngestionRequest request = new IngestionRequest();
        request.setUri("https://example.com/film.mkv");
        String jobId = pipeline.start(request);
        executor.shutdown();
        assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        return jobId;
    }

    @Test
    void diskMissing_jobFailsWithTheReason_beforeAnyDownloadStarts() throws Exception {
        String jobId = runJob(pipeline(MediaDiskGuards.withMarker(marker())));

        verify(tracking).fail(eq(jobId), contains("Ingestion was not started"));
        verify(handler, never()).resolve(anyString());
        verify(downloader, never()).download(any());
        verify(repository).save(any()); // the FAILED job is persisted, reason and all
    }

    @Test
    void diskDropsDuringTheDownload_processingIsNotStarted() throws Exception {
        Files.createFile(marker());
        Path downloaded = Files.writeString(temp.resolve("film.mkv"), "x");
        when(downloader.download(any())).thenAnswer(inv -> {
            Files.delete(marker());
            return DownloadResult.success("job", downloaded, "film.mkv", 1);
        });

        String jobId = runJob(pipeline(MediaDiskGuards.withMarker(marker())));

        verify(tracking).fail(eq(jobId), contains("Processing was not started"));
        verify(processor, never()).process(any());
    }

    @Test
    void diskMounted_theJobRunsAsBefore() throws Exception {
        Files.createFile(marker());
        when(downloader.download(any())).thenReturn(DownloadResult.failure("job", "boom"));

        String jobId = runJob(pipeline(MediaDiskGuards.withMarker(marker())));

        verify(downloader).download(any());
        verify(tracking).fail(eq(jobId), contains("boom"));
    }
}
