package com.db.dbworld.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Startup directory creation. With the media disk missing, {@code data-path} is the empty mount
 * point on the SD card, and nothing may be built underneath it; the app's own dirs still are.
 */
class AppPropertiesCreateDirsTest {

    @TempDir Path root;

    Path app;   // internal storage: /app/db_world
    Path data;  // the mount point: /srv/dbworld
    Path marker;

    @BeforeEach
    void setUp() throws IOException {
        app    = root.resolve("app/db_world");
        data   = Files.createDirectories(root.resolve("srv/dbworld")); // the mount point always exists
        marker = data.resolve(".dbworld-media-disk");
    }

    /** The prod layout: logs on internal storage, everything media under data-path. */
    private AppProperties props(String markerSetting) {
        AppProperties p = new AppProperties();
        p.setName("db-world");
        p.setVersion("test");
        p.setBasePath(app.toString());
        p.setDataPath(data.toString());
        p.setStreamPath(data.resolve("streams").toString());
        p.setSymlinkPath(data.resolve("symlinks").toString());
        Path logs = app.resolve("logs");
        p.setPaths(new AppProperties.Paths(
                logs.toString(), logs.resolve("main.json").toString(), logs.resolve("dl.log").toString(),
                app.resolve("config").toString(), data.resolve("temp").toString(),
                data.resolve("downloads").toString(), data.resolve("integration").toString(),
                data.resolve("streams/Torrent Download").toString(), logs.resolve("archived").toString(),
                root.resolve("ext/videos").toString()));
        if (markerSetting != null) p.setMediaDisk(new AppProperties.MediaDisk(markerSetting));
        ReflectionTestUtils.setField(p, "environment", new MockEnvironment());
        p.init();
        return p;
    }

    private static boolean isEmpty(Path dir) throws IOException {
        try (Stream<Path> s = Files.list(dir)) {
            return s.findAny().isEmpty();
        }
    }

    @Test
    void markerMissing_nothingIsCreatedUnderDataPath_butTheAppsOwnDirsAre() throws IOException {
        AppProperties p = props(marker.toString());

        assertThat(isEmpty(data)).as("nothing built on the SD card under the mount point").isTrue();
        assertThat(app.resolve("logs")).isDirectory();
        assertThat(app.resolve("logs/archived")).isDirectory();
        assertThat(p.getMediaDiskMarker()).isEqualTo(marker);
    }

    @Test
    void markerPresent_everythingIsCreated() throws IOException {
        Files.createFile(marker);

        props(marker.toString());

        assertThat(data.resolve("temp")).isDirectory();
        assertThat(data.resolve("streams")).isDirectory();
        assertThat(data.resolve("downloads")).isDirectory();
        assertThat(data.resolve("integration")).isDirectory();
        assertThat(app.resolve("logs")).isDirectory();
    }

    /** The dev default: no marker configured, so startup behaves exactly as it always did. */
    @Test
    void noMarkerConfigured_everythingIsCreated_andTheGuardIsOff() {
        AppProperties p = props(null);

        assertThat(data.resolve("temp")).isDirectory();
        assertThat(data.resolve("streams")).isDirectory();
        assertThat(p.getMediaDiskMarker()).isNull();
    }

    @Test
    void blankMarker_isTheSameAsNone() {
        AppProperties p = props("");

        assertThat(p.getMediaDiskMarker()).isNull();
        assertThat(data.resolve("temp")).isDirectory();
    }

    @Test
    void mediaTreeRoots_coverDataPathAndTheMediaDirs_notTheAppsOwn() {
        AppProperties p = props(null);

        assertThat(p.getMediaTreeRoots())
                .contains(data.toAbsolutePath().normalize(), data.resolve("temp").toAbsolutePath().normalize())
                .noneMatch(r -> r.startsWith(app));
    }
}
