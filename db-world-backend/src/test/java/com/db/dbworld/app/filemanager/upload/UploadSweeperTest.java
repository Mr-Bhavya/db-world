package com.db.dbworld.app.filemanager.upload;

import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class UploadSweeperTest {

    UploadSessionRepository repo;
    AppProperties props;
    UploadSweeper sweeper;
    Path tempPath;

    @BeforeEach
    void setUp() throws Exception {
        repo = mock(UploadSessionRepository.class);
        props = mock(AppProperties.class);
        tempPath = Files.createTempDirectory("fm-sweep");
        when(props.getTempPath()).thenReturn(tempPath);
        sweeper = new UploadSweeper(repo, props);
    }

    @Test
    void sweepStale_deletesPartFileAndSession() throws Exception {
        Path uploads = tempPath.resolve("uploads");
        Files.createDirectories(uploads);
        UploadSessionEntity stale = UploadSessionEntity.builder()
                .id("u-stale").locationId("l").targetPath("/").fileName("f.bin")
                .totalSize(10).chunkSize(4).receivedBytes(4).nextIndex(1)
                .onConflict("fail").status("PENDING")
                .build();
        Path part = uploads.resolve("u-stale.part");
        Files.writeString(part, "data");

        when(repo.findByStatusAndUpdatedAtBefore(eq("PENDING"), any())).thenReturn(List.of(stale));

        sweeper.sweepStale();

        assertThat(Files.exists(part)).isFalse();
        verify(repo).delete(stale);
    }

    @Test
    void sweepStale_noCandidates_doesNothing() {
        when(repo.findByStatusAndUpdatedAtBefore(eq("PENDING"), any())).thenReturn(List.of());

        sweeper.sweepStale();

        verify(repo, never()).delete(any());
    }
}
