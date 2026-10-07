package com.db.dbworld.app.media.admin.controller;

import com.db.dbworld.app.media.delete.MediaFileDeletionService;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** "Cleanup" drops every row whose file is not on disk, which is every row while the disk is missing. */
class MediaAdminControllerCleanupTest {

    @TempDir Path disk;

    MediaInfoService         mediaInfo = mock(MediaInfoService.class);
    MediaFileDeletionService deletion  = mock(MediaFileDeletionService.class);

    private Path marker() {
        return disk.resolve(".dbworld-media-disk");
    }

    private MediaAdminController controller() {
        return new MediaAdminController(mediaInfo, mock(SymlinkService.class), deletion,
                MediaDiskGuards.withMarker(marker(), disk));
    }

    private MediaFileDto missingFile(String id) {
        return MediaFileDto.builder().id(id).filePath(disk.resolve("streams/" + id + ".mkv").toString()).build();
    }

    @Test
    void diskMissing_cleanupIsRefused_beforeLookingAtAnyRow() {
        assertThatThrownBy(() -> controller().cleanupMediaFiles())
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Media file cleanup was not started");

        verify(mediaInfo, never()).findAll();
        verify(deletion, never()).deleteById(anyString(), anyBoolean());
    }

    @Test
    void diskDropsMidCleanup_stopsBeforeTheNextRemoval() throws Exception {
        Files.createFile(marker());
        when(mediaInfo.findAll()).thenReturn(List.of(missingFile("a"), missingFile("b"), missingFile("c")));
        when(deletion.deleteById("a", false)).thenAnswer(inv -> {
            Files.delete(marker()); // gone right after the first (genuine) removal
            return null;
        });

        assertThatThrownBy(() -> controller().cleanupMediaFiles()).hasMessageContaining("not mounted");

        verify(deletion, times(1)).deleteById(anyString(), anyBoolean());
    }
}
