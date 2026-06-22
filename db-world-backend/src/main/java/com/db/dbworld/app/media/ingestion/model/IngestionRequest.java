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
    private Boolean urlProtected;

    private String fileName;
    private Long expectedSize;

    private Boolean extract;
    private String extractPassword;
    private Boolean rename;

    private String videoITag;
    private String audioITag;
    private Boolean onlyAudio;

    /**
     * Base64-encoded .torrent file content.
     * When set, aria2c's addTorrent RPC is used instead of addUri.
     */
    private String torrentBase64;

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
     * Absolute server path to an already-downloaded file.
     * When set the DOWNLOAD step is skipped; the pipeline starts directly at PROCESSING.
     * Used by the "link existing file" flow.
     */
    private String localFilePath;

    /**
     * Optional FFmpeg track filter applied during TMDB enrichment.
     * All filtering (audio language selection, subtitle removal, etc.)
     * is folded into the same single FFmpeg pass as cover-art embedding
     * and file renaming.  {@code null} = keep all tracks.
     */
    private TrackFilter trackFilter;

}
