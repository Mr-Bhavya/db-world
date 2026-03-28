package com.db.dbworld.app.cinema.rail.rule;

import lombok.Data;

import java.util.List;

@Data
public class RailRule {

    /**
     * manual | tag | genre | language | filter
     */
    private String type;

    /**
     * Filters
     */
    private String tag;

    private Long genreId;

    private List<String> languages;

    private String field;

    private Object value;

    /**
     * Optional record type filter: "MOVIE" or "TV_SERIES".
     * If null, defaults based on rail's pageType.
     */
    private String recordType;

    /**
     * Sorting
     */
    private String sort;

    private String direction;

}