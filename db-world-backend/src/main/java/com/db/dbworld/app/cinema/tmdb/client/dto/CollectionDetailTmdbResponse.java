package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Shape of {@code /collection/{id}}, which is where the {@code parts} list lives. The
 * {@code belongs_to_collection} block embedded in a movie payload carries only the
 * collection's own identity, never its members — see CollectionTmdbResponse.
 */
@Getter
@Setter
public class CollectionDetailTmdbResponse {

    private Long id;

    private String name;

    private String overview;

    private String poster_path;

    private String backdrop_path;

    private List<CollectionPartTmdbResponse> parts;

}
