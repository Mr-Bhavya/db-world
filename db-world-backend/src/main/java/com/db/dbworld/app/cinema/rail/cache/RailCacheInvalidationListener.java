package com.db.dbworld.app.cinema.rail.cache;

import com.db.dbworld.cinema.common.events.BulkRecordChangedEvent;
import com.db.dbworld.cinema.common.events.RecordChangedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RailCacheInvalidationListener {

    private final RailCacheService cacheService;

    /* =========================
       SINGLE RECORD UPDATE
    ========================= */

    @EventListener
    public void handleRecordChange(RecordChangedEvent event) {
        cacheService.evictByRecord(event.recordId());
    }

    /* =========================
       BULK UPDATE (TMDB SYNC)
    ========================= */

    @EventListener
    public void handleBulkChange(BulkRecordChangedEvent event) {
        cacheService.evictAll();
    }
}