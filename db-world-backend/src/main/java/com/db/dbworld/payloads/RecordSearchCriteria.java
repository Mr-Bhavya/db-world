package com.db.dbworld.payloads;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RecordSearchCriteria {
    private String recordType;
    private String genres;
    private String languages;
    private String nameSearchQuery;
    private Boolean showOnTop;
    private int pageNumber;
    private int pageSize;


    /**
     * Constructs a new {@code RecordSearchCriteria} instance with the specified search parameters.
     *
     * @param recordType    the type of record to filter by (e.g., "movie", "tv show")
     * @param genres        a comma-separated list of genres to filter records by genre
     * @param languages     a comma-separated list of language codes used to filter records by their original language
     * @param nameSearchQuery the search query used to match against record names or titles (applied with a LIKE query)
     * @param showOnTop     if {@code true}, only records marked to be shown on top are returned
     * @param pageNumber    the zero-based index of the page to retrieve
     * @param pageSize      the number of records per page
     */
    public RecordSearchCriteria(String recordType, String genres, String languages, String nameSearchQuery, Boolean showOnTop, int pageNumber, int pageSize) {
        this.recordType = recordType;
        this.genres = genres;
        this.languages = languages;
        this.nameSearchQuery = nameSearchQuery;
        this.showOnTop = showOnTop;
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
    }

}
