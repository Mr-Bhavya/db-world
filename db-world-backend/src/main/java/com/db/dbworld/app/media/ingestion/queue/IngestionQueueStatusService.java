package com.db.dbworld.app.media.ingestion.queue;

import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.aria2.model.Aria2GlobalStat;
import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Read-only snapshot of the download queue, aria2 throughput and free disk for the admin queue bar. */
@Log4j2
@Service
@RequiredArgsConstructor
public class IngestionQueueStatusService {

    private final IngestionDownloadQueue downloadQueue;
    private final Aria2RpcService aria2RpcService;
    private final AppProperties appProperties;

    public record Aria2Status(boolean online, long downloadSpeed, long uploadSpeed, int numActive, int numWaiting) {}

    public record DiskStatus(String label, long freeBytes, long totalBytes) {}

    public record QueueStatus(String slotJobId, List<String> waiting, int parallelCount,
                              Aria2Status aria2, List<DiskStatus> disks) {}

    public QueueStatus snapshot() {
        return new QueueStatus(
                downloadQueue.getCurrentlyRunningJobId(),
                downloadQueue.getQueueSnapshot(),
                downloadQueue.getParallelCount(),
                aria2Status(),
                disks());
    }

    private Aria2Status aria2Status() {
        try {
            Aria2GlobalStat g = aria2RpcService.getGlobalStat();
            if (g == null) return new Aria2Status(false, 0, 0, 0, 0);
            return new Aria2Status(true, nz(g.getDownloadSpeed()), nz(g.getUploadSpeed()),
                    nz(g.getNumActive()), nz(g.getNumWaiting()));
        } catch (RuntimeException e) {
            log.debug("aria2 global stat unavailable: {}", e.getMessage());
            return new Aria2Status(false, 0, 0, 0, 0);
        }
    }

    private List<DiskStatus> disks() {
        List<DiskStatus> out = new ArrayList<>(2);
        addDisk(out, "temp", appProperties.getTempPath());
        addDisk(out, "library", appProperties.getStreamPath());
        return out;
    }

    private static void addDisk(List<DiskStatus> out, String label, Path path) {
        if (path == null || !Files.exists(path)) return;
        try {
            FileStore store = Files.getFileStore(path);
            out.add(new DiskStatus(label, store.getUsableSpace(), store.getTotalSpace()));
        } catch (IOException | RuntimeException e) {
            log.debug("disk stat unavailable for {}: {}", path, e.getMessage());
        }
    }

    private static long nz(Long v) { return v != null ? v : 0L; }

    private static int nz(Integer v) { return v != null ? v : 0; }
}
