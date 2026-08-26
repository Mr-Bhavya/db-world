package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * A single release entry. {@code certification} is frequently an empty string rather than
 * absent — TMDB returns the entry regardless of whether a board rated that release — so
 * consumers must treat blank as "no certification here" and keep looking.
 *
 * <p>{@code type} is TMDB's release type: 1 Premiere, 2 Theatrical (limited),
 * 3 Theatrical, 4 Digital, 5 Physical, 6 TV.
 */
@Getter
@Setter
public class ReleaseDateEntryTmdbResponse {

    private String certification;

    private Integer type;

    private String release_date;

    private String note;

}
