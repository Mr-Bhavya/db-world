package com.db.dbworld.app.media.ingestion.service;

import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.app.media.ingestion.model.PlaylistItem;
import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IngestionInputGuardTest {

    @TempDir Path stream;
    @TempDir Path temp;
    @TempDir Path outside;

    IngestionInputGuard guard;

    @BeforeEach
    void setUp() {
        AppProperties props = mock(AppProperties.class);
        when(props.getStreamPath()).thenReturn(stream);
        when(props.getTempPath()).thenReturn(temp);
        guard = new IngestionInputGuard(props);
    }

    @Test
    void acceptsLocalFileInsideStreamRootAndNormalisesIt() throws Exception {
        Path file = Files.createFile(stream.resolve("movie.mkv"));
        Files.createDirectory(stream.resolve("sub"));
        IngestionRequest r = new IngestionRequest();
        r.setLocalFilePath(stream.resolve("sub/../movie.mkv").toString());

        guard.validate(r);

        assertThat(Path.of(r.getLocalFilePath())).isEqualTo(file.toRealPath());
    }

    @Test
    void rejectsLocalFileOutsideRoots() throws Exception {
        Path file = Files.createFile(outside.resolve("secret.txt"));
        IngestionRequest r = new IngestionRequest();
        r.setLocalFilePath(file.toString());

        assertThatThrownBy(() -> guard.validate(r)).isInstanceOf(SecurityException.class);
    }

    @Test
    void rejectsTraversalOutOfRoot() throws Exception {
        Files.createFile(outside.resolve("x.mkv"));
        IngestionRequest r = new IngestionRequest();
        r.setLocalFilePath(stream.resolve("../" + outside.getFileName() + "/x.mkv").toString());

        assertThatThrownBy(() -> guard.validate(r)).isInstanceOf(SecurityException.class);
    }

    @Test
    void rejectsMissingFileAndDirectories() {
        IngestionRequest missing = new IngestionRequest();
        missing.setLocalFilePath(stream.resolve("nope.mkv").toString());
        assertThatThrownBy(() -> guard.validate(missing)).isInstanceOf(IllegalArgumentException.class);

        IngestionRequest dir = new IngestionRequest();
        dir.setLocalFilePath(stream.toString());
        assertThatThrownBy(() -> guard.validate(dir)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsLoopbackAndMetadataHosts() {
        assertThatThrownBy(() -> guard.validateUri("http://127.0.0.1:6800/jsonrpc"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> guard.validateUri("http://localhost/admin"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> guard.validateUri("http://169.254.169.254/latest/meta-data"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsUnsupportedSchemes() {
        assertThatThrownBy(() -> guard.validateUri("file:///etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> guard.validateUri("gopher://x/y"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> guard.validateUri("file:/etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void allowsPublicLanMagnetAndSchemeLessLinks() {
        assertThatCode(() -> guard.validateUri("https://8.8.8.8/file.mkv")).doesNotThrowAnyException();
        assertThatCode(() -> guard.validateUri("http://192.168.1.20/share/movie.mkv")).doesNotThrowAnyException();
        assertThatCode(() -> guard.validateUri("magnet:?xt=urn:btih:abc")).doesNotThrowAnyException();
        assertThatCode(() -> guard.validateUri("youtube.com/watch?v=abc")).doesNotThrowAnyException();
    }

    @Test
    void validatesEveryUriAndPlaylistItem() {
        IngestionRequest r = new IngestionRequest();
        r.setUris(List.of("https://8.8.8.8/a.mkv", "http://127.0.0.1/b.mkv"));
        assertThatThrownBy(() -> guard.validate(r)).isInstanceOf(IllegalArgumentException.class);

        IngestionRequest p = new IngestionRequest();
        p.setPlaylistItems(List.of(new PlaylistItem("http://[::1]/x", null, null, null)));
        assertThatThrownBy(() -> guard.validate(p)).isInstanceOf(IllegalArgumentException.class);
    }
}
