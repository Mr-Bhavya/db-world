package com.db.dbworld.app.cinema.catalogrequest.dto;

import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestStatus;
import com.db.dbworld.app.cinema.common.dto.VoterSummary;
import com.db.dbworld.app.cinema.enums.RecordType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class CatalogIngestRequestDto {
    private Long id;
    private Long tmdbId;
    private RecordType mediaType;
    private String title;
    private String posterPath;
    private String releaseYear;
    private String note;
    private CatalogIngestRequestStatus status;
    private int voteCount;
    private boolean hasMyVote;
    private List<VoterSummary> voters;
    private Instant createdAt;
    private Instant ingestedAt;
    private String ingestedByUsername;
    private Long createdRecordId;
    private String dismissReason;
}
