package com.db.dbworld.app.stream.service;

import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.stream.service.impl.StreamServiceImpl;
import com.db.dbworld.audit.tracking.ingest.TrackingIngestService;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.utils.DbWorldUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Containment tests for {@link StreamServiceImpl#resolveRealPath(String)}.
 *
 * <p>The method turns a client-supplied, root-relative path into a real file, and two endpoints
 * hand it a raw request parameter ({@code GET /api/stream/resolve?path=} and
 * {@code GET /api/stream/search/media-info?path=}), both open to any signed-in role. It therefore
 * has to keep its answer inside the configured media roots.
 */
class StreamPathResolutionTest {

    @TempDir
    Path tmp;

    private Path streamRoot;
    private Path externalRoot;
    private StreamServiceImpl service;

    @BeforeEach
    void setUp() throws IOException {
        streamRoot   = Files.createDirectories(tmp.resolve("media/stream"));
        externalRoot = Files.createDirectories(tmp.resolve("media/external"));

        AppProperties props = mock(AppProperties.class);
        when(props.getStreamPath()).thenReturn(streamRoot);
        when(props.getExternalVideosPath()).thenReturn(externalRoot);

        service = new StreamServiceImpl(
                props,
                mock(DbWorldUtils.class),
                mock(MediaInfoService.class),
                mock(CdnUrlBuilder.class),
                mock(TrackingIngestService.class));
    }

    /* ---------- legitimate paths must keep working ---------- */

    @Test
    void aRootRelativePathResolvesInsideTheStreamRoot() throws IOException {
        Path file = Files.createFile(Files.createDirectories(streamRoot.resolve("Movies")).resolve("foo.mkv"));

        // Leading slash: exactly the shape toRelativePath hands back to clients.
        assertThat(service.resolveRealPath("/Movies/foo.mkv")).isEqualTo(file.toAbsolutePath().normalize());
        assertThat(service.resolveRealPath("Movies/foo.mkv")).isEqualTo(file.toAbsolutePath().normalize());
    }

    @Test
    void aFileOnlyInTheExternalRootIsStillFound() throws IOException {
        Path file = Files.createFile(externalRoot.resolve("bar.mkv"));

        assertThat(service.resolveRealPath("/bar.mkv")).isEqualTo(file.toAbsolutePath().normalize());
    }

    @Test
    void aMissingFileInsideTheRootIsReturnedSoTheCallerCanReportNotFound() {
        // Must NOT throw: callers distinguish "absent" from "rejected" via their own Files.exists.
        assertThat(service.resolveRealPath("/Movies/absent.mkv"))
                .isEqualTo(streamRoot.resolve("Movies/absent.mkv").toAbsolutePath().normalize());
    }

    /* ---------- escapes must be rejected ---------- */

    /**
     * The case that would actually have leaked. Without the containment check the method returns
     * {@code tmp/secret.txt}, {@code Files.exists} is true, and the caller streams it or reports
     * its media info.
     */
    @Test
    void aTraversalToAnExistingFileOutsideTheRootIsRejected() throws IOException {
        Path secret = Files.createFile(tmp.resolve("secret.txt"));
        assertThat(secret).exists();

        assertThatThrownBy(() -> service.resolveRealPath("../../secret.txt"))
                .isInstanceOf(DbWorldException.class)
                .extracting(e -> ((DbWorldException) e).getHttpStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void aTraversalIsRejectedRegardlessOfDepth() {
        for (String attack : new String[]{
                "../secret.txt",
                "../../secret.txt",
                "../../../../../../etc/passwd",
                "Movies/../../../secret.txt",
                "/../../secret.txt"}) {
            assertThatThrownBy(() -> service.resolveRealPath(attack))
                    .describedAs("expected rejection for %s", attack)
                    .isInstanceOf(DbWorldException.class);
        }
    }

    /**
     * A drive-letter path does not start with {@code /}, so the leading-slash strip leaves it
     * intact and {@code resolve} then discards the base entirely. This is the exact case the
     * old commented-out guard targeted, and it is Windows-only: on Linux {@code C:/...} is just
     * a relative directory named {@code C:}.
     */
    @Test
    @EnabledOnOs(OS.WINDOWS)
    void aWindowsDriveLetterPathIsRejected() {
        assertThatThrownBy(() -> service.resolveRealPath("C:/Windows/win.ini"))
                .isInstanceOf(DbWorldException.class)
                .extracting(e -> ((DbWorldException) e).getHttpStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        assertThatThrownBy(() -> service.resolveRealPath("C:\\Windows\\win.ini"))
                .isInstanceOf(DbWorldException.class);
    }

    /**
     * A POSIX absolute path is neutralised rather than rejected: the leading-slash strip makes it
     * root-relative, so it lands harmlessly inside the root instead of escaping. Asserted so the
     * distinction is recorded — this is why the absolute-path escape was Windows-only.
     */
    @Test
    @EnabledOnOs({OS.LINUX, OS.MAC})
    void aPosixAbsolutePathIsContainedByTheLeadingSlashStrip() {
        assertThat(service.resolveRealPath("/etc/passwd"))
                .isEqualTo(streamRoot.resolve("etc/passwd").toAbsolutePath().normalize())
                .startsWithRaw(streamRoot.toAbsolutePath().normalize());
    }

    /**
     * External-videos is optional configuration, so the getter can return null. Before the
     * containment rewrite this combination threw NullPointerException on any path whose file was
     * missing from the stream root.
     */
    @Test
    void anUnconfiguredExternalRootDoesNotBlowUp() {
        AppProperties props = mock(AppProperties.class);
        when(props.getStreamPath()).thenReturn(streamRoot);
        when(props.getExternalVideosPath()).thenReturn(null);

        StreamServiceImpl svc = new StreamServiceImpl(
                props,
                mock(DbWorldUtils.class),
                mock(MediaInfoService.class),
                mock(CdnUrlBuilder.class),
                mock(TrackingIngestService.class));

        assertThat(svc.resolveRealPath("/Movies/absent.mkv"))
                .isEqualTo(streamRoot.resolve("Movies/absent.mkv").toAbsolutePath().normalize());
        assertThatThrownBy(() -> svc.resolveRealPath("../../secret.txt"))
                .isInstanceOf(DbWorldException.class);
    }
}
