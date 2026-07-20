package com.db.dbworld.app.cinema.common.dto;

/**
 * Lightweight voter projection for admin request views. Used by both
 * {@link com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestDto} and
 * {@link com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestDto}
 * so the admin can see who voted without a second round-trip.
 */
public record VoterSummary(
        Long userId,
        String name,
        String email
) {}
