package com.db.dbworld.app.media.ingestion.processing.fs;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** What the pipeline's end-of-job cleanup asks the storage service to prune. */
class DefaultFileStorageServiceTempCleanupTest {

    @TempDir
    Path tempRoot;

    RecordRepository recordRepository;
    DefaultFileStorageService storage;

    @BeforeEach
    void setUp() {
        AppProperties props = mock(AppProperties.class);
        when(props.getTempPath()).thenReturn(tempRoot);
        recordRepository = mock(RecordRepository.class);
        storage = new DefaultFileStorageService(props, recordRepository);
    }

    @Test
    void jobFolder_isRemovedOnceItsFilesAreGone() throws Exception {
        Path job = Files.createDirectories(tempRoot.resolve("42-Inception"));

        storage.removeEmptyTempDirs(jobWithFolder("42-Inception"));

        assertThat(job).doesNotExist();
        assertThat(tempRoot).isDirectory();
    }

    @Test
    void jobFolder_isKeptWhileAnotherJobStillHasFilesInIt() throws Exception {
        Path job = Files.createDirectories(tempRoot.resolve("42-Inception"));
        Files.writeString(job.resolve("S01E03.mkv.aria2"), "x");

        storage.removeEmptyTempDirs(jobWithFolder("42-Inception"));

        assertThat(job).isDirectory();
    }

    /** Linking a record mid-flight renames the job folder; the download's old folder is pruned too. */
    @Test
    void artifactParent_isPrunedEvenWhenItIsNotTheJobFolder() throws Exception {
        Path earlier = Files.createDirectories(tempRoot.resolve("7-Old-Name"));
        IngestionContext ctx = jobWithFolder("42-Inception");
        ctx.getTempArtifacts().add(earlier.resolve("movie.zip")); // already deleted by the pipeline

        storage.removeEmptyTempDirs(ctx);

        assertThat(earlier).doesNotExist();
    }

    /** A job with no record works in temp/unassigned, which holds files waiting to be linked. */
    @Test
    void unassignedJob_keepsTheUnassignedFolder() throws Exception {
        Path unassigned = Files.createDirectories(tempRoot.resolve("unassigned"));
        IngestionContext ctx = new IngestionContext();
        ctx.setRequest(new IngestionRequest());

        storage.removeEmptyTempDirs(ctx);

        assertThat(unassigned).isDirectory();
    }

    @Test
    void recordLookupFailure_stillPrunesArtifactParentsAndNeverThrows() throws Exception {
        when(recordRepository.findById(any())).thenThrow(new IllegalStateException("db down"));
        Path earlier = Files.createDirectories(tempRoot.resolve("7-Old-Name"));
        IngestionRequest request = new IngestionRequest();
        request.setRecordId(42L);
        IngestionContext ctx = new IngestionContext();
        ctx.setRequest(request);
        ctx.getTempArtifacts().add(earlier.resolve("movie.mkv"));

        assertThatCode(() -> storage.removeEmptyTempDirs(ctx)).doesNotThrowAnyException();
        assertThat(earlier).doesNotExist();
    }

    private static IngestionContext jobWithFolder(String folder) {
        IngestionRequest request = new IngestionRequest();
        request.setFolderName(folder);
        IngestionContext ctx = new IngestionContext();
        ctx.setJobId("job-1");
        ctx.setRequest(request);
        return ctx;
    }
}
