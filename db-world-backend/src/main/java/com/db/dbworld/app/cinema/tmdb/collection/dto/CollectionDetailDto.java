package com.db.dbworld.app.cinema.tmdb.collection.dto;

import java.util.List;

public record CollectionDetailDto(
        Long id,
        String name,
        String overview,
        String posterPath,
        String backdropPath,
        List<CollectionPartDto> parts,
        int ownedCount
) {
}
