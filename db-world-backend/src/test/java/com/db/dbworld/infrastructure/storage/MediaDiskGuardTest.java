package com.db.dbworld.infrastructure.storage;

import com.db.dbworld.core.exception.DbWorldException;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Configuration;
import org.apache.logging.log4j.core.config.LoggerConfig;
import org.apache.logging.log4j.core.config.Property;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaDiskGuardTest {

    private static final String LOGGER = MediaDiskGuard.class.getName();

    @TempDir Path disk;

    Path marker;
    final List<String> warnings = new CopyOnWriteArrayList<>();
    AbstractAppender capture;

    @BeforeEach
    void setUp() {
        marker = disk.resolve(".dbworld-media-disk");
        capture = new AbstractAppender("media-disk-guard-test", null, null, true, Property.EMPTY_ARRAY) {
            @Override
            public void append(LogEvent event) {
                if (event.getLevel() == Level.WARN) warnings.add(event.getMessage().getFormattedMessage());
            }
        };
        capture.start();
        LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
        Configuration config = ctx.getConfiguration();
        LoggerConfig loggerConfig = new LoggerConfig(LOGGER, Level.WARN, false);
        loggerConfig.addAppender(capture, Level.WARN, null);
        config.addLogger(LOGGER, loggerConfig);
        ctx.updateLoggers();
    }

    @AfterEach
    void tearDown() {
        LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
        ctx.getConfiguration().removeLogger(LOGGER);
        ctx.updateLoggers();
        capture.stop();
    }

    @Test
    void noMarkerConfigured_isOff_andAlwaysMounted() {
        MediaDiskGuard guard = MediaDiskGuards.off();

        assertThat(guard.isEnabled()).isFalse();
        assertThat(guard.isMounted()).isTrue();
        assertThatCode(() -> guard.requireMounted("Media sync")).doesNotThrowAnyException();
        assertThatCode(() -> guard.requireMountedFor(disk.resolve("streams"), "Upload")).doesNotThrowAnyException();
        assertThat(warnings).isEmpty();
    }

    @Test
    void markerPresent_isMounted() throws IOException {
        Files.createFile(marker);
        MediaDiskGuard guard = MediaDiskGuards.withMarker(marker, disk);

        assertThat(guard.isEnabled()).isTrue();
        assertThat(guard.isMounted()).isTrue();
        assertThatCode(() -> guard.requireMounted("Media sync")).doesNotThrowAnyException();
        assertThat(warnings).isEmpty();
    }

    @Test
    void markerMissing_refusesWithA503ThatSaysWhereAndWhat() {
        MediaDiskGuard guard = MediaDiskGuards.withMarker(marker, disk);

        assertThat(guard.isMounted()).isFalse();
        assertThatThrownBy(() -> guard.requireMounted("Media sync"))
                .isInstanceOfSatisfying(DbWorldException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE))
                .hasMessage("The media disk is not mounted (" + disk + "). Media sync was not started.");
    }

    @Test
    void markerIsCheckedOnEveryCall_neverCached() throws IOException {
        MediaDiskGuard guard = MediaDiskGuards.withMarker(marker, disk);

        assertThat(guard.isMounted()).isFalse();
        Files.createFile(marker);
        assertThat(guard.isMounted()).isTrue();
        Files.delete(marker);
        assertThat(guard.isMounted()).isFalse();
    }

    @Test
    void eachFlipIsWarnedOnce_notEveryCall() throws IOException {
        Files.createFile(marker);
        MediaDiskGuard guard = MediaDiskGuards.withMarker(marker, disk);

        guard.isMounted();
        guard.isMounted();
        assertThat(warnings).as("mounted from the start is not news").isEmpty();

        Files.delete(marker);
        guard.isMounted();
        guard.isMounted();
        guard.isMounted();
        assertThat(warnings).hasSize(1);
        assertThat(warnings.getLast()).contains("NOT mounted").contains(marker.toString());

        Files.createFile(marker);
        guard.isMounted();
        guard.isMounted();
        assertThat(warnings).hasSize(2);
        assertThat(warnings.getLast()).contains("mounted again");
    }

    @Test
    void missingAtFirstCheck_isWarned() {
        MediaDiskGuard guard = MediaDiskGuards.withMarker(marker, disk);

        guard.isMounted();
        guard.isMounted();

        assertThat(warnings).hasSize(1);
    }

    @Test
    void pathScopedCheck_onlyRefusesInsideTheMediaTree(@TempDir Path internalStorage) {
        MediaDiskGuard guard = MediaDiskGuards.withMarker(marker, disk);

        assertThat(guard.isInMediaTree(disk)).isTrue();
        assertThat(guard.isInMediaTree(disk.resolve("streams/MOVIE/a.mkv"))).isTrue();
        assertThat(guard.isInMediaTree(disk.resolve("streams/../temp"))).isTrue();
        assertThat(guard.isInMediaTree(internalStorage.resolve("docs"))).isFalse();
        assertThat(guard.isInMediaTree(null)).isFalse();

        assertThatThrownBy(() -> guard.requireMountedFor(disk.resolve("temp/uploads"), "Upload"))
                .isInstanceOf(DbWorldException.class)
                .hasMessageContaining("Upload was not started");
        assertThatCode(() -> guard.requireMountedFor(internalStorage.resolve("docs"), "Upload"))
                .doesNotThrowAnyException();
    }
}
