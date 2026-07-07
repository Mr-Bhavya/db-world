package com.db.dbworld.app.media.ingestion.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One selected item of a playlist "single-card" ingestion job.
 *
 * A playlist job carries a list of these on {@link IngestionRequest#getPlaylistItems()}.
 * The whole list is downloaded and processed under ONE job id (one card), instead of
 * fanning out into N per-item jobs.
 *
 * {@code season}/{@code episode} are resolved up front by the client — from the source's
 * own metadata (yt-dlp exposes season_number/episode_number for extractors like Hotstar)
 * with a fallback to the form's season + playlist position. When {@code episode} is set the
 * download names the file with an {@code SxxExx} tag so the processing stage can identify
 * and enrich each episode; when null the file is processed untagged.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PlaylistItem {
    private String uri;
    private Integer season;
    private Integer episode;
    private String title;
}
