package com.db.dbworld.app.filemanager.upload;

import com.db.dbworld.app.filemanager.dto.FileItemDto;
import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.upload.dto.InitUploadRequest;
import com.db.dbworld.app.filemanager.upload.dto.UploadSessionDto;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UploadSessionServiceTest {

    UploadSessionRepository repo;
    FileLocationService locationService;
    AppProperties props;
    UploadSessionService svc;
    Map<String, UploadSessionEntity> store;
    Path base;
    Path tempPath;

    @BeforeEach
    void setUp() throws Exception {
        repo = mock(UploadSessionRepository.class);
        locationService = mock(FileLocationService.class);
        props = mock(AppProperties.class);
        base = Files.createTempDirectory("fm-loc");
        tempPath = Files.createTempDirectory("fm-temp");
        store = new HashMap<>();

        when(locationService.resolveBase("l")).thenReturn(base);
        when(props.getTempPath()).thenReturn(tempPath);

        when(repo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(repo.save(any(UploadSessionEntity.class))).thenAnswer(a -> {
            UploadSessionEntity e = a.getArgument(0);
            if (e.getId() == null) e.setId("u-" + (store.size() + 1));
            store.put(e.getId(), e);
            return e;
        });
        doAnswer(a -> {
            store.remove(((UploadSessionEntity) a.getArgument(0)).getId());
            return null;
        }).when(repo).delete(any(UploadSessionEntity.class));

        svc = new UploadSessionService(repo, locationService, props);
    }

    private Path partOf(String uploadId) {
        return tempPath.resolve("uploads").resolve(uploadId + ".part");
    }

    @Test
    void init_createsSession_withServerChunkSizeWhenNull() throws Exception {
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "big.bin", 20, null, null, null));

        assertThat(s.getChunkSize()).isEqualTo(8388608);
        assertThat(s.getStatus()).isEqualTo("PENDING");
        assertThat(Files.exists(partOf(s.getUploadId()))).isTrue();
    }

    @Test
    void appendChunks_thenComplete_writesFileToLocation() throws Exception {
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "hi.txt", 5, 4, null, null));

        svc.appendChunk(s.getUploadId(), 0, new byte[]{'h', 'e', 'l', 'l'});
        svc.appendChunk(s.getUploadId(), 1, new byte[]{'o'});
        FileItemDto out = svc.complete(s.getUploadId());

        assertThat(Files.readString(base.resolve("hi.txt"))).isEqualTo("hello");
        assertThat(out.getName()).isEqualTo("hi.txt");
    }

    @Test
    void status_reportsNextIndex_forResume() throws Exception {
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "hi.txt", 5, 4, null, null));

        svc.appendChunk(s.getUploadId(), 0, new byte[]{'h', 'e', 'l', 'l'});

        assertThat(svc.status(s.getUploadId()).getNextIndex()).isEqualTo(1);
    }

    @Test
    void complete_wrongSize_throws() throws Exception {
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "hi.txt", 5, 4, null, null));
        svc.appendChunk(s.getUploadId(), 0, new byte[]{'h', 'e', 'l', 'l'});

        assertThatThrownBy(() -> svc.complete(s.getUploadId())).isInstanceOf(DbWorldException.class);
    }

    @Test
    void complete_onConflictFail_whenExists_throws() throws Exception {
        Files.writeString(base.resolve("hi.txt"), "existing");
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "hi.txt", 5, 4, null, "fail"));
        svc.appendChunk(s.getUploadId(), 0, new byte[]{'h', 'e', 'l', 'l'});
        svc.appendChunk(s.getUploadId(), 1, new byte[]{'o'});

        assertThatThrownBy(() -> svc.complete(s.getUploadId())).isInstanceOf(DbWorldException.class);
    }

    @Test
    void appendChunk_isIdempotentPerIndex() throws Exception {
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "hi.txt", 5, 4, null, null));

        svc.appendChunk(s.getUploadId(), 0, new byte[]{'h', 'e', 'l', 'l'});
        // Re-send of an already-received index (0 < nextIndex 1): idempotent no-op.
        svc.appendChunk(s.getUploadId(), 0, new byte[]{'h', 'e', 'l', 'l'});

        assertThat(svc.status(s.getUploadId()).getReceivedBytes()).isEqualTo(4);
        assertThat(svc.status(s.getUploadId()).getNextIndex()).isEqualTo(1);
    }

    @Test
    void appendChunk_outOfOrder_throws() throws Exception {
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "hi.txt", 5, 4, null, null));

        assertThatThrownBy(() -> svc.appendChunk(s.getUploadId(), 2, new byte[]{'o'}))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void init_nonPositiveChunkSize_fallsBackToDefault() throws Exception {
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "big.bin", 20, 0, null, null));
        assertThat(s.getChunkSize()).isEqualTo(8388608);

        UploadSessionDto s2 = svc.init(new InitUploadRequest("l", "/", "big2.bin", 20, -1, null, null));
        assertThat(s2.getChunkSize()).isEqualTo(8388608);
    }

    @Test
    void abort_deletesPartAndSession() throws Exception {
        UploadSessionDto s = svc.init(new InitUploadRequest("l", "/", "hi.txt", 5, 4, null, null));
        Path part = partOf(s.getUploadId());
        assertThat(Files.exists(part)).isTrue();

        svc.abort(s.getUploadId());

        assertThat(Files.exists(part)).isFalse();
        assertThat(store.containsKey(s.getUploadId())).isFalse();
    }
}
