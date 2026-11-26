package com.db.dbworld.app.media.ingestion.queue;

import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.aria2.model.Aria2GlobalStat;
import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IngestionQueueStatusServiceTest {

    @TempDir Path temp;

    private final IngestionDownloadQueue queue = mock(IngestionDownloadQueue.class);
    private final Aria2RpcService aria2 = mock(Aria2RpcService.class);
    private final AppProperties props = mock(AppProperties.class);
    private final IngestionQueueStatusService service = new IngestionQueueStatusService(queue, aria2, props);

    @Test
    void reportsQueueAria2AndDisk() {
        when(queue.getCurrentlyRunningJobId()).thenReturn("run-1");
        when(queue.getQueueSnapshot()).thenReturn(List.of("w-1", "w-2"));
        when(queue.getParallelCount()).thenReturn(1);
        when(aria2.getGlobalStat()).thenReturn(new Aria2GlobalStat(2_000L, 10L, 3, 4, 0, 0));
        when(props.getTempPath()).thenReturn(temp);
        when(props.getStreamPath()).thenReturn(temp.resolve("missing"));

        IngestionQueueStatusService.QueueStatus s = service.snapshot();

        assertThat(s.slotJobId()).isEqualTo("run-1");
        assertThat(s.waiting()).containsExactly("w-1", "w-2");
        assertThat(s.parallelCount()).isEqualTo(1);
        assertThat(s.aria2().online()).isTrue();
        assertThat(s.aria2().downloadSpeed()).isEqualTo(2_000L);
        assertThat(s.aria2().numActive()).isEqualTo(3);
        assertThat(s.disks()).extracting(IngestionQueueStatusService.DiskStatus::label).containsExactly("temp");
        assertThat(s.disks().getFirst().totalBytes()).isPositive();
    }

    @Test
    void aria2FailureIsReportedAsOffline() {
        when(queue.getQueueSnapshot()).thenReturn(List.of());
        when(aria2.getGlobalStat()).thenThrow(new RuntimeException("connection refused"));
        when(props.getTempPath()).thenReturn(null);
        when(props.getStreamPath()).thenReturn(null);

        IngestionQueueStatusService.QueueStatus s = service.snapshot();

        assertThat(s.aria2().online()).isFalse();
        assertThat(s.aria2().downloadSpeed()).isZero();
        assertThat(s.disks()).isEmpty();
    }
}
