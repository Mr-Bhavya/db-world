package com.db.dbworld.app.cinema.tmdb.sync.dto;

import java.time.Instant;
import java.time.ZoneOffset;

public record SyncWindow(
        Instant start,
        Instant end
) {

    public String startDate() {
        return start.atZone(ZoneOffset.UTC).toLocalDate().toString();
    }

    public String endDate() {
        return end.atZone(ZoneOffset.UTC).toLocalDate().toString();
    }

    @Override
    public String toString() {
        return startDate() + " → " + endDate();
    }
}