package com.db.dbworld.app.cinema.rail.dto;

import com.db.dbworld.app.cinema.tmdb.media.projection.*;
import com.db.dbworld.app.cinema.tmdb.providers.dto.TmdbProviderDto;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public record RailAggregationResult(

        Map<Long, List<String>> genres,
        Map<Long, List<PosterImageProjection>> posters,
        Map<Long, List<BackdropImageProjection>> backdrops,
        Map<Long, List<VideoProjection>> videos,
        Map<Long, List<TmdbProviderDto>> providers

) {

    public static RailAggregationResult empty() {
        return new RailAggregationResult(
                Collections.emptyMap(),
                Collections.emptyMap(),
                Collections.emptyMap(),
                Collections.emptyMap(),
                Collections.emptyMap()
        );
    }
}