package com.db.dbworld.app.media.sync;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobConfigRepository;
import com.db.dbworld.app.admin.scheduler.service.JobRunRecorder;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The removal guard. Every test here is a scan whose diff contains removals; the question
 * is whether the scan applies them or refuses and changes nothing.
 */
class MediaSyncServiceTest {

    @TempDir Path streams;

    MediaInfoService    mediaInfo   = mock(MediaInfoService.class);
    MediaFileRepository repo        = mock(MediaFileRepository.class);
    SymlinkService      symlinks    = mock(SymlinkService.class);
    AppProperties       appProps    = mock(AppProperties.class);
    SettingsService     settings    = mock(SettingsService.class);

    MediaSyncService service;
    List<MediaFileEntity> dbRows = new ArrayList<>();

    @BeforeEach
    void setUp() {
        when(appProps.getStreamPath()).thenReturn(streams);
        when(repo.findAll()).thenAnswer(a -> dbRows);
        when(settings.getInt(ConfigKeys.MEDIA_SYNC_MAX_REMOVAL_PERCENT)).thenReturn(20);
        service = new MediaSyncService(new MediaSyncProperties(Duration.ZERO), mediaInfo, repo, symlinks,
                appProps, mock(SchedulerJobConfigRepository.class), mock(JobRunRecorder.class), settings);
    }

    /** {@code onDisk} of {@code total} indexed files still exist; the rest are gone from disk. */
    private void library(int total, int onDisk) throws IOException {
        for (int i = 0; i < total; i++) {
            Path file = streams.resolve("film-" + i + ".mkv");
            if (i < onDisk) {
                Files.writeString(file, "x");
                // Older than any stability window, so a test never races the mtime gate.
                Files.setLastModifiedTime(file, FileTime.from(Instant.now().minusSeconds(3600)));
            }
            MediaFileEntity row = new MediaFileEntity();
            row.setId("id-" + i);
            row.setFilePath(file.toAbsolutePath().toString());
            dbRows.add(row);
        }
    }

    @Test
    void emptyStreamRoot_withALibraryInTheDatabase_changesNothing() throws IOException {
        library(30, 0); // the unmounted-disk case: the folder exists, the files do not
        JobRunSummary.Builder summary = JobRunSummary.builder();

        assertThatThrownBy(() -> service.scan(summary))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not mounted");

        verify(mediaInfo, never()).deleteByFilePath(anyString());
        verify(symlinks, never()).deleteById(anyString());
        assertThat(summary.build().counters())
                .containsEntry("filesOnDisk", 0L)
                .containsEntry("inDatabase", 30L)
                .containsEntry("wouldRemove", 30L);
    }

    @Test
    void emptyStreamRoot_isRefused_evenWithTheLimitOff() throws IOException {
        library(30, 0);
        when(settings.getInt(ConfigKeys.MEDIA_SYNC_MAX_REMOVAL_PERCENT)).thenReturn(100);

        assertThatThrownBy(() -> service.scan(JobRunSummary.builder()))
                .hasMessageContaining("not mounted");
        verify(mediaInfo, never()).deleteByFilePath(anyString());
    }

    @Test
    void removalAboveTheLimit_changesNothing_notEvenAdditions() throws IOException {
        library(20, 10); // half the library gone: 50% against a 20% limit
        Files.writeString(streams.resolve("new-film.mkv"), "x");

        assertThatThrownBy(() -> service.scan(JobRunSummary.builder()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("would remove 10 of 20")
                .hasMessageContaining("20% limit");

        verify(mediaInfo, never()).deleteByFilePath(anyString());
        verify(mediaInfo, never()).collectAndPersist(any(), any(), any());
    }

    @Test
    void removalWithinTheLimit_isApplied() throws IOException {
        library(100, 85); // 15 gone = 15%, past the floor but within 20%

        var report = service.scan(JobRunSummary.builder());

        assertThat(report.removed()).isEqualTo(15);
        verify(mediaInfo, times(15)).deleteByFilePath(anyString());
        verify(symlinks, times(15)).deleteById(anyString());
    }

    @Test
    void smallLibrary_getsTheAlwaysAllowedFloor() throws IOException {
        library(8, 6); // 2 of 8 = 25% is over 20%, but within the floor of 5

        var report = service.scan(JobRunSummary.builder());

        assertThat(report.removed()).isEqualTo(2);
    }

    @Test
    void floor_doesNotCoverMoreThanItsCount() throws IOException {
        int over = MediaSyncService.ALWAYS_ALLOWED_REMOVALS + 1;
        library(over + 1, 1); // 6 of 7 gone

        assertThatThrownBy(() -> service.scan(JobRunSummary.builder()))
                .hasMessageContaining("would remove " + over);
        verify(mediaInfo, never()).deleteByFilePath(anyString());
    }

    @Test
    void limitOf100_turnsThePercentageCheckOff() throws IOException {
        library(20, 10);
        when(settings.getInt(ConfigKeys.MEDIA_SYNC_MAX_REMOVAL_PERCENT)).thenReturn(100);

        var report = service.scan(JobRunSummary.builder());

        assertThat(report.removed()).isEqualTo(10);
    }

    @Test
    void freshInstall_emptyDiskAndEmptyDatabase_isNotAFailure() {
        var report = service.scan(JobRunSummary.builder());

        assertThat(report.failed()).isFalse();
        assertThat(report.changed()).isFalse();
    }

    @Test
    void missingStreamRoot_stillFailsBeforeTouchingTheDatabase() throws IOException {
        library(5, 5);
        when(appProps.getStreamPath()).thenReturn(streams.resolve("not-there"));

        assertThatThrownBy(() -> service.scan(JobRunSummary.builder()))
                .hasMessageContaining("not a directory");
        verify(repo, never()).findAll();
    }

    @Test
    void additionsAlone_areNeverGuarded() throws IOException {
        IntStream.range(0, 50).forEach(i -> {
            try {
                Path f = streams.resolve("fresh-" + i + ".mkv");
                Files.writeString(f, "x");
                Files.setLastModifiedTime(f, FileTime.from(Instant.now().minusSeconds(3600)));
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        });

        var report = service.scan(JobRunSummary.builder());

        assertThat(report.added()).isEqualTo(50);
        verify(mediaInfo, times(50)).collectAndPersist(any(), any(), any());
    }
}
