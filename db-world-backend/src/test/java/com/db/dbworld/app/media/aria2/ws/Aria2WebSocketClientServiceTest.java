package com.db.dbworld.app.media.aria2.ws;

import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import com.db.dbworld.app.media.aria2.Aria2DownloadMappingService;
import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the torrent metadata GID remap guards. Two defects lived here:
 * the "already remapped" check compared a String to an {@code Optional<String>}
 * (always false, so it never short-circuited), and {@code getGid} was called with a
 * possibly-null jobId against a ConcurrentHashMap, which throws on a null key.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class Aria2WebSocketClientServiceTest {

    private static final String META_GID   = "meta-1";
    private static final String ACTUAL_GID = "actual-1";
    private static final String JOB_ID     = "job-1";

    @Mock Aria2RpcService             aria2RpcService;
    @Mock Aria2DownloadMappingService mappingService;
    @Mock TrackingService             trackingService;
    @Mock IngestionJobStore           jobStore;

    Aria2WebSocketClientService service;

    @BeforeEach
    void setUp() {
        service = new Aria2WebSocketClientService(
                "ws://localhost:6800/jsonrpc", "secret", new ObjectMapper(),
                aria2RpcService, mappingService, trackingService, jobStore);
    }

    private Aria2StatusParam statusFollowedBy(String... gids) {
        Aria2StatusParam s = new Aria2StatusParam();
        s.setFollowedBy(List.of(gids));
        return s;
    }

    @Test
    void remapsJobToTheActualGid() {
        when(mappingService.getJobIdByGid(ACTUAL_GID)).thenReturn(null);
        when(mappingService.getJobIdByGid(META_GID)).thenReturn(JOB_ID);
        when(jobStore.getGid(JOB_ID)).thenReturn(Optional.of("some-older-gid"));

        service.handleTorrentMetadata(META_GID, statusFollowedBy(ACTUAL_GID));

        verify(jobStore).setGid(JOB_ID, ACTUAL_GID);
        verify(mappingService).removeByGid(META_GID);
        verify(mappingService).addMapping(JOB_ID, ACTUAL_GID);
    }

    @Test
    void skipsWhenTheJobIsAlreadyOnThatGid() {
        // The regression: String.equals(Optional) was always false, so this re-ran
        // the remap and logged a spurious "metadata complete" on every event.
        when(mappingService.getJobIdByGid(ACTUAL_GID)).thenReturn(null);
        when(mappingService.getJobIdByGid(META_GID)).thenReturn(JOB_ID);
        when(jobStore.getGid(JOB_ID)).thenReturn(Optional.of(ACTUAL_GID));

        service.handleTorrentMetadata(META_GID, statusFollowedBy(ACTUAL_GID));

        verify(jobStore, never()).setGid(anyString(), anyString());
        verify(mappingService, never()).addMapping(anyString(), anyString());
    }

    @Test
    void doesNotThrowWhenJobIdCannotBeResolved() {
        when(mappingService.getJobIdByGid(ACTUAL_GID)).thenReturn(null);
        when(mappingService.getJobIdByGid(META_GID)).thenReturn(null);
        when(jobStore.getAllActiveGids()).thenReturn(Map.of());
        // IngestionJobStore is backed by a ConcurrentHashMap, whose get() throws on a
        // null key. Reproduce that here so this test actually exercises the fault
        // rather than relying on a mock's lenient null handling.
        when(jobStore.getGid(null)).thenThrow(new NullPointerException("null key"));

        assertThatCode(() -> service.handleTorrentMetadata(META_GID, statusFollowedBy(ACTUAL_GID)))
                .doesNotThrowAnyException();

        verify(jobStore, never()).getGid(any());
        verify(jobStore, never()).setGid(anyString(), anyString());
    }

    @Test
    void skipsWhenTheActualGidIsAlreadyMapped() {
        when(mappingService.getJobIdByGid(ACTUAL_GID)).thenReturn("some-other-job");

        service.handleTorrentMetadata(META_GID, statusFollowedBy(ACTUAL_GID));

        verify(jobStore, never()).setGid(anyString(), anyString());
        verify(mappingService, never()).addMapping(anyString(), anyString());
    }

    @Test
    void ignoresStatusWithNoFollowedBy() {
        Aria2StatusParam empty = new Aria2StatusParam();

        service.handleTorrentMetadata(META_GID, empty);
        service.handleTorrentMetadata(META_GID, statusFollowedBy());

        verify(mappingService, never()).addMapping(anyString(), anyString());
    }
}
