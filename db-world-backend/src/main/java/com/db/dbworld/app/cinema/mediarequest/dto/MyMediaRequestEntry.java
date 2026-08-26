package com.db.dbworld.app.cinema.mediarequest.dto;

import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestScope;

/**
 * Lightweight record describing a single PENDING request the caller has voted for.
 * Returned in batch by GET /api/cinema/media-requests/mine so the frontend can
 * compute "have I requested this for this record?" without round trips.
 *
 * <p>{@code season}/{@code episode} are {@code null} when the request covers the whole
 * title — a client matching a whole-title request must check for that, not just the
 * record id, or a per-episode request will read as one.
 */
public record MyMediaRequestEntry(
        Long recordId,
        MediaRequestKind kind,
        Integer season,
        Integer episode
) {
    public static MyMediaRequestEntry from(MediaRequestEntity e) {
        MediaRequestScope scope = e.scope();
        return new MyMediaRequestEntry(e.getRecordId(), e.getKind(), scope.seasonOrNull(), scope.episodeOrNull());
    }
}
