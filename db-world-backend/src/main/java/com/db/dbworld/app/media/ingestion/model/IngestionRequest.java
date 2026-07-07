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
    private Boolean urlProtected = false;

    private String fileName;
    private Long expectedSize;

    private Boolean extract = false;
    private String extractPassword;
    private Boolean rename = false;

    private String videoITag;
    private String audioITag;
    private Boolean onlyAudio = false;

    /**
     * Selected playlist items for a "single-card" playlist job. When non-empty, the whole
     * list is downloaded and processed under ONE job (one card) instead of fanning out into
     * N per-item jobs. Each item carries its own season/episode (resolved client-side).
     */
    private List<PlaylistItem> playlistItems;

    /**
     * Quality preset for playlists (and single videos without a specific itag): "best", "2160",
     * "1080", "720", "480", or "audio". Playlist items can't share an itag (itags differ per video),
     * so a height-based selector is applied per item. Ignored when a specific videoITag is set.
     */
    private String videoQuality;

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
