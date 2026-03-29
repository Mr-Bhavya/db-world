package com.db.dbworld.services.media;

import com.db.dbworld.payloads.MirrorStatus;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Async;

import java.util.concurrent.CompletableFuture;

/**
 * @deprecated Superseded by {@link com.db.dbworld.app.media.enrichment.TmdbMediaEnrichmentService}.
 * Disabled — depends on removed MediaFileHandler and StatusService.
 * Pending full deletion once callers are confirmed migrated.
 */
@Deprecated(forRemoval = true)
@Log4j2
// @Service — disabled: depends on removed MediaFileHandler and StatusService
public class MediaModificationService {

    @Async
    public CompletableFuture<Void> processMediaAsync(MirrorStatus mirrorStatus) {
        log.warn("MediaModificationService is deprecated and disabled. Ignoring processMediaAsync call for id={}",
                mirrorStatus != null ? mirrorStatus.getId() : "null");
        return CompletableFuture.completedFuture(null);
    }
}
