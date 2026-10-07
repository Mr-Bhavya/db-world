package com.db.dbworld.app.media.ingestion.processing.fs;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** What the pipeline's end-of-job cleanup asks the storage service to prune. */
class DefaultFileStorageServiceTempCleanupTest {

    @TempDir
    Path tempRoot;

    @TempDir
    Path disk;

    AppProperties props;
    RecordRepository recordRepository;
    DefaultFileStorageService storage;

    @BeforeEach
    void setUp() {
        props = mock(AppProperties.class);
        when(props.getTempPath()).thenReturn(tempRoot);
        when(props.getStreamPath()).thenReturn(tempRoot.resolve("streams"));
        recordRepository = mock(RecordRepository.class);
        storage = new DefaultFileStorageService(props, recordRepository, MediaDiskGuards.off());
    }

    // ── Media-disk guard ─────────────────────────────────────────────────────

    private DefaultFileStorageService storageWithDiskMissing() {
        return new DefaultFileStorageService(props, recordRepository,
                MediaDiskGuards.withMarker(disk.resolve(".dbworld-media-disk"), tempRoot));
    }

    @Test
    void diskMissing_emptyFoldersAreLeftAlone() throws Exception {
        Path job = Files.createDirectories(tempRoot.resolve("42-Inception"));

        storageWithDiskMissing().removeEmptyTempDirs(jobWithFolder("42-Inception"));

        assertThat(job).isDirectory();
    }

    /** Both download strategies call this right before aria2 / yt-dlp would start writing. */
    @Test
    void diskMissing_downloadIsRefused_andNoFolderIsCreated() {
        IngestionContext ctx = jobWithFolder("42-Inception");

        assertThatThrownBy(() -> storageWithDiskMissing().prepareDirectories(ctx))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Download was not started");

        assertThat(tempRoot.resolve("42-Inception")).doesNotExist();
        assertThat(tempRoot.resolve("streams")).doesNotExist();
    }

    @Test
    void guardOff_prepareDirectoriesCreatesBothFolders() {
        storage.prepareDirectories(jobWithFolder("42-Inception"));

        assertThat(tempRoot.resolve("42-Inception")).isDirectory();
        assertThat(tempRoot.resolve("streams/unassigned/42-Inception")).isDirectory();
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
