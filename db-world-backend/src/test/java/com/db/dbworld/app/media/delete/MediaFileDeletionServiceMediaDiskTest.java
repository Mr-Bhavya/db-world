package com.db.dbworld.app.media.delete;

import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MediaFileDeletionServiceMediaDiskTest {

    @TempDir Path disk;

    MediaInfoService mediaInfo = mock(MediaInfoService.class);
    SymlinkService   symlinks  = mock(SymlinkService.class);
    MediaFileDeletionService service;

    @BeforeEach
    void setUp() {
        service = new MediaFileDeletionService(mediaInfo, symlinks,
                MediaDiskGuards.withMarker(disk.resolve(".dbworld-media-disk"), disk));
        MediaFileDto dto = MediaFileDto.builder()
                .id("id-1").filePath(disk.resolve("streams/film.mkv").toString()).build();
        when(mediaInfo.getById("id-1")).thenReturn(Optional.of(dto));
    }

    /** It would read "already gone", drop the row, and the file would return as unassigned. */
    @Test
    void permanentDelete_isRefused_andTheRowStays() {
        assertThatThrownBy(() -> service.deleteById("id-1", true))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Deleting the file from disk was not started");

        verify(mediaInfo, never()).deleteByFilePath(anyString());
        verify(symlinks, never()).deleteById(anyString());
    }

    /** Removing from the library (file kept) is a database change the admin asked for. */
    @Test
    void removeFromLibrary_isStillAllowed() {
        MediaFileDeleteResult result = service.deleteById("id-1", false);

        assertThat(result.dbRecordDeleted()).isTrue();
        verify(mediaInfo).deleteByFilePath(disk.resolve("streams/film.mkv").toString());
    }
}
