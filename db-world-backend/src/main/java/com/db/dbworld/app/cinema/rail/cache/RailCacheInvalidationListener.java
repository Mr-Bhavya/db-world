package com.db.dbworld.app.cinema.rail.cache;

import com.db.dbworld.app.cinema.common.events.BulkRecordChangedEvent;
import com.db.dbworld.app.cinema.common.events.RecordChangedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Log4j2
@Component
@RequiredArgsConstructor
public class RailCacheInvalidationListener {

    private final RailCacheService cacheService;

    /* =========================
       SINGLE RECORD UPDATE
    ========================= */

    @EventListener
    public void handleRecordChange(RecordChangedEvent event) {
        log.debug("RecordChangedEvent received; recordId={}", event.recordId());
        cacheService.evictByRecord(event.recordId());
    }

    /* =========================
       BULK UPDATE (TMDB SYNC)
    ========================= */

    @EventListener
    public void handleBulkChange(BulkRecordChangedEvent event) {
        log.debug("BulkRecordChangedEvent received");
        cacheService.evictAll();
    }
}