package com.db.dbworld.app.media.ingestion.model;

import com.db.dbworld.app.media.enrichment.TrackFilter;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@RequiredArgsConstructor
public class IngestionRequest {

    private String uri;
    private List<String> uris;

    private String folderName;

    private String username;
    private String password;
    private boolean urlProtected;

    private String fileName;
    private Long expectedSize;

    private boolean extract;
    private String extractPassword;
    private boolean rename;

    private String videoITag;
    private String audioITag;
    private boolean onlyAudio;

    /** Optional: link this ingestion job to a cinema record (RecordEntity.id). */
    private Long recordId;

    /**
     * TV series season number (1-based).
     * When set alongside recordId pointing to a TvSeriesTmdbEntity,
     * FfmpegProcessingStrategy uses this to rename the file and embed
     * episode metadata from TMDB.
     */
    private Integer season;

    /**
     * TV series episode number within the season (1-based).
     */
    private Integer episode;

    /**
     * Optional FFmpeg track filter applied during TMDB enrichment.
     * All filtering (audio language selection, subtitle removal, etc.)
     * is folded into the same single FFmpeg pass as cover-art embedding
     * and file renaming.  {@code null} = keep all tracks.
     */
    private TrackFilter trackFilter;

}
