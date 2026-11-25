package com.db.dbworld.app.media.ingestion.download;

import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.aria2.model.Aria2StatusParam;
import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.queue.IngestionDownloadQueue;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
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
        when(rpc.tellStatus("abc123")).thenReturn(removed);

        DownloadResult result = strategy.download(ctx);

        assertFalse(result.isSuccess());
        verify(store).setGid("job-1", "abc123");
        verify(tracking).remove("ext-abc123");
        verify(queue, never()).enqueue(anyString(), anyBoolean());
        verify(rpc, never()).addUri(anyString(), anyString(), any());
        verify(rpc, never()).addTorrent(anyString(), anyString(), any());
    }
}
