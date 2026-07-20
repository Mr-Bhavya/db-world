package com.db.dbworld.app.filemanager.upload;

import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Deletes PENDING upload sessions (and their .part files) that went stale (untouched for 24h). */
@Log4j2
@Component
@RequiredArgsConstructor
public class UploadSweeper {

    private final UploadSessionRepository repo;
    private final AppProperties appProperties;

    @Scheduled(fixedDelayString = "${dbworld.filemanager.upload-sweep-ms:3600000}")
    public void sweepStale() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(24));
        List<UploadSessionEntity> stale = repo.findByStatusAndUpdatedAtBefore("PENDING", cutoff);
        for (UploadSessionEntity e : stale) {
            Path part = appProperties.getTempPath().resolve("uploads").resolve(e.getId() + ".part");
            try {
                Files.deleteIfExists(part);
            } catch (IOException ex) {
                log.warn("UploadSweeper: failed to delete stale part file {}", part, ex);
            }
            repo.delete(e);
        }
        if (!stale.isEmpty()) {
            log.info("UploadSweeper: swept {} stale upload session(s)", stale.size());
        }
    }
}
