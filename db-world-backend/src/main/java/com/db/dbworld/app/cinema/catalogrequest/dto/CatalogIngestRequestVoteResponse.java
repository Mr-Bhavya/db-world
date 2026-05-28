package com.db.dbworld.app.cinema.catalogrequest.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CatalogIngestRequestVoteResponse {
    private Long tmdbId;
    private RecordType mediaType;
    private int voteCount;
    private boolean hasMyVote;
}
