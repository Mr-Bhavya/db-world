package com.db.dbworld.app.media.storyboard;

import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.processor.ProcessExecutor;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StoryboardServiceMediaDiskTest {

    @TempDir Path data;
    @TempDir Path disk;

    /** Sprites go to {data}/storyboards: with the disk missing, that is the SD card. */
    @Test
    void diskMissing_generationIsSkipped_withoutRunningFfmpegOrWritingAnything() throws Exception {
        AppProperties props = mock(AppProperties.class);
        when(props.getSymlinkPath()).thenReturn(data.resolve("symlinks"));
        ProcessExecutor ffmpeg = mock(ProcessExecutor.class);
        MediaFileRepository repo = mock(MediaFileRepository.class);
        StoryboardService service = new StoryboardService(props, ffmpeg, repo, mock(SettingsService.class),
                MediaDiskGuards.withMarker(disk.resolve(".dbworld-media-disk"), data));

        assertThatCode(() -> service.generate("id-1", data.resolve("streams/film.mkv"), 3_600_000L))
                .doesNotThrowAnyException();

        verify(ffmpeg, never()).executeFfmpegWithSimpleOutput(anyList());
        verify(repo, never()).save(any());
        assertThat(data.resolve("storyboards")).doesNotExist();
    }
}
