package com.db.dbworld.app.media.ingestion.download;

import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.aria2.Aria2StatusKeys;
import com.db.dbworld.app.media.aria2.model.Aria2File;
import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class Aria2DownloadStrategyTest {

    @Test
    void recoveredJob_adoptsExistingGidWithoutReAddingOrQueueing() {
        Aria2RpcService rpc = mock(Aria2RpcService.class);
        FileStorageService fs = mock(FileStorageService.class);
        TrackingService tracking = mock(TrackingService.class);
        IngestionJobStore store = mock(IngestionJobStore.class);
        IngestionDownloadQueue queue = mock(IngestionDownloadQueue.class);
        Aria2DownloadStrategy strategy = new Aria2DownloadStrategy(rpc, fs, tracking, store, queue);

        IngestionRequest req = new IngestionRequest();
        req.setUri("https://example.com/file.mkv");
        req.setAdoptGid("abc123");
        IngestionContext ctx = new IngestionContext();
        ctx.setJobId("job-1");
        ctx.setRequest(req);

        when(fs.resolveTempDir(ctx)).thenReturn(Path.of("tmp"));
        when(store.getGid("job-1")).thenReturn(Optional.of("abc123"));
        when(tracking.hasJob("ext-abc123")).thenReturn(true);
        Aria2StatusParam removed = new Aria2StatusParam();
        removed.setStatus("removed");
        when(rpc.tellStatus(eq("abc123"), any())).thenReturn(removed);

        DownloadResult result = strategy.download(ctx);

        assertFalse(result.isSuccess());
        verify(store).setGid("job-1", "abc123");
        verify(tracking).remove("ext-abc123");
        verify(queue, never()).enqueue(anyString(), anyBoolean());
        verify(rpc, never()).addUri(anyString(), anyString(), any());
        verify(rpc, never()).addTorrent(anyString(), anyString(), any());
    }

    @Test
    void errorStatus_reportsReadableAria2Reason() {
        Aria2RpcService rpc = mock(Aria2RpcService.class);
        FileStorageService fs = mock(FileStorageService.class);
        TrackingService tracking = mock(TrackingService.class);
        IngestionJobStore store = mock(IngestionJobStore.class);
        Aria2DownloadStrategy strategy = new Aria2DownloadStrategy(rpc, fs, tracking, store,
                mock(IngestionDownloadQueue.class));

        IngestionRequest req = new IngestionRequest();
        req.setAdoptGid("g1");
        IngestionContext ctx = new IngestionContext();
        ctx.setJobId("job-2");
        ctx.setRequest(req);
        when(fs.resolveTempDir(ctx)).thenReturn(Path.of("tmp"));
        when(store.getGid("job-2")).thenReturn(Optional.of("g1"));
        Aria2StatusParam err = new Aria2StatusParam();
        err.setStatus("error");
        err.setErrorCode(3);
        when(rpc.tellStatus(eq("g1"), eq(Aria2StatusKeys.POLL_KEYS))).thenReturn(err);

        DownloadResult result = strategy.download(ctx);

        assertFalse(result.isSuccess());
        assertTrue(result.getErrorMessage().contains("404"), result.getErrorMessage());
        verify(rpc).removeDownloadResult("g1");
    }

    @Test
    void partialArtifacts_returnsTopLevelEntriesAndControlFilesInsideTemp(@TempDir Path temp) {
        Aria2RpcService rpc = mock(Aria2RpcService.class);
        Aria2DownloadStrategy strategy = new Aria2DownloadStrategy(rpc, mock(FileStorageService.class),
                mock(TrackingService.class), mock(IngestionJobStore.class), mock(IngestionDownloadQueue.class));

        Aria2StatusParam meta = new Aria2StatusParam();
        meta.setFiles(List.of(new Aria2File(1L, "[METADATA]abc", 0L, 0L, true, null)));
        meta.setFollowedBy(List.of("real"));
        Aria2StatusParam real = new Aria2StatusParam();
        real.setFiles(List.of(
                new Aria2File(1L, temp.resolve("Show.S01/e1.mkv").toString(), 1L, 0L, true, null),
                new Aria2File(2L, temp.resolve("Show.S01/e2.mkv").toString(), 1L, 0L, true, null),
                new Aria2File(3L, temp.getParent().resolve("outside.mkv").toString(), 1L, 0L, true, null)));
        when(rpc.tellStatus(eq("meta"), any())).thenReturn(meta);
        when(rpc.tellStatus(eq("real"), any())).thenReturn(real);

        List<Path> out = strategy.partialArtifacts("meta", temp);

        Path root = temp.toAbsolutePath().normalize();
        assertEquals(List.of(root.resolve("Show.S01"), root.resolve("Show.S01.aria2")), out);
    }
}
