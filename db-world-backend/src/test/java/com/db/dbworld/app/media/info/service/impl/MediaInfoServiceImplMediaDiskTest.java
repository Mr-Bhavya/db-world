package com.db.dbworld.app.media.info.service.impl;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.app.media.storyboard.StoryboardService;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.processor.ProcessExecutor;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.context.ApplicationEventPublisher;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * collectAndPersist replaces the row for a path. A rescan with the disk missing must stop before
 * that replacement, not after mediainfo has read nothing from a file that is not there.
 */
class MediaInfoServiceImplMediaDiskTest {

    @TempDir Path data;
    @TempDir Path disk;

    ProcessExecutor     processExecutor = mock(ProcessExecutor.class);
    MediaFileRepository repo            = mock(MediaFileRepository.class);
    StoryboardService   storyboards     = mock(StoryboardService.class);
    MediaInfoServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new MediaInfoServiceImpl(processExecutor, repo, mock(RecordRepository.class),
                mock(ApplicationEventPublisher.class), new ObjectMapper(), mock(AppProperties.class),
                storyboards, mock(SymlinkService.class),
                MediaDiskGuards.withMarker(disk.resolve(".dbworld-media-disk"), data));

        MediaFileEntity row = new MediaFileEntity();
        row.setId("id-1");
        row.setFilePath(data.resolve("streams/film.mkv").toString());
        when(repo.findById("id-1")).thenReturn(Optional.of(row));
    }

    @Test
    void rescan_isRefused_andTheRowIsNotReplaced() throws Exception {
        assertThatThrownBy(() -> service.rescan("id-1"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Reading media info was not started");

        verify(processExecutor, never()).runMediaInfoCommand(any());
        verify(repo, never()).delete(any());
        verify(repo, never()).save(any());
    }

    @Test
    void storyboardRequest_isRefusedWithTheReason() {
        assertThatThrownBy(() -> service.generateStoryboard("id-1"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Storyboard generation was not started");

        verify(storyboards, never()).generate(any(), any(), org.mockito.ArgumentMatchers.anyLong());
    }
}
