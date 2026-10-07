package com.db.dbworld.app.media.link;

import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.infrastructure.storage.MediaDiskGuard;
import com.db.dbworld.infrastructure.storage.MediaDiskGuards;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Symlinks live under data-path; with the media disk missing none may be created there. */
class SymlinkServiceMediaDiskTest {

    @TempDir Path data;
    @TempDir Path disk;

    AppProperties props = mock(AppProperties.class);
    MediaFileRepository repo = mock(MediaFileRepository.class);
    Path symlinks;
    SymlinkService service;

    @BeforeEach
    void setUp() {
        symlinks = data.resolve("symlinks");
        when(props.getSymlinkPath()).thenReturn(symlinks);
        MediaDiskGuard missing = MediaDiskGuards.withMarker(disk.resolve(".dbworld-media-disk"), data);
        service = new SymlinkService(props, repo, missing);
    }

    @Test
    void create_isRefused_andTheSymlinksFolderIsNotBuilt() throws Exception {
        Path film = Files.writeString(data.resolve("film.mkv"), "x");

        assertThatThrownBy(() -> service.create("id-1", film.toString()))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Creating the media symlink was not started");

        assertThat(symlinks).doesNotExist();
    }

    /** A repair that ran anyway would see every link as broken and every entry as an orphan. */
    @Test
    void repairs_areRefusedWhole_evenAsDryRuns() throws Exception {
        Files.createDirectories(symlinks);
        Path orphan = Files.writeString(symlinks.resolve("orphan-id"), "x");

        assertThatThrownBy(() -> service.ensureAll(false)).hasMessageContaining("not mounted");
        assertThatThrownBy(() -> service.ensureAll(true)).hasMessageContaining("not mounted");
        assertThatThrownBy(() -> service.ensureOne("orphan-id", false)).hasMessageContaining("not mounted");

        assertThat(orphan).exists();
        verify(repo, never()).findAll();
    }
}
