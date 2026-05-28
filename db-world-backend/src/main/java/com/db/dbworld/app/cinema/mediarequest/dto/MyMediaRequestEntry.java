package com.db.dbworld.app.cinema.mediarequest.dto;

import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight record describing a single PENDING request the caller has voted for.
 * Returned in batch by GET /api/cinema/media-requests/mine so the frontend can
 * compute "have I requested this kind for this record?" without round trips.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyMediaRequestEntry {
    private Long recordId;
    private MediaRequestKind kind;
}
