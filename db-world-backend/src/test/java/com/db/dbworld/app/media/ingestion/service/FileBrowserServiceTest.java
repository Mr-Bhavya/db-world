package com.db.dbworld.app.media.ingestion.service;

import com.db.dbworld.app.media.ingestion.model.FileBrowserItem;
import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FileBrowserServiceTest {

    @TempDir Path stream;
    @TempDir Path outside;

    FileBrowserService service;

    @BeforeEach
    void setUp() {
        AppProperties props = mock(AppProperties.class);
        when(props.getStreamPath()).thenReturn(stream);
        service = new FileBrowserService(props);
    }

    @Test
    void listsFoldersFirstThenMediaOnly() throws Exception {
        Files.createDirectory(stream.resolve("Shows"));
        Files.createFile(stream.resolve("b.mkv"));
        Files.createFile(stream.resolve("notes.txt"));

        List<FileBrowserItem> items = service.browse("stream", "");

        assertThat(items).extracting(FileBrowserItem::getName).containsExactly("Shows", "b.mkv");
    }

    @Test
    void rejectsTraversal() {
        assertThatThrownBy(() -> service.browse("stream", "../" + outside.getFileName()))
                .isInstanceOf(SecurityException.class);
    }

    @Test
    void rejectsSymlinkEscapingTheRoot() throws Exception {
        Path link = stream.resolve("escape");
        boolean created;
        try {
            Files.createSymbolicLink(link, outside);
            created = true;
        } catch (Exception e) {
            created = false;
        }
        assumeTrue(created, "symlinks not permitted on this machine");
        assertThatThrownBy(() -> service.browse("stream", "escape"))
                .isInstanceOf(SecurityException.class);
    }

    @Test
    void rejectsMissingFolderAndUnknownRoot() {
        assertThatThrownBy(() -> service.browse("stream", "missing"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.browse("etc", ""))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
