package com.db.dbworld.app.media.ingestion.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class YtFormatsResponse {
    private String title;
    private String thumbnail;
    private Long   duration;          // seconds
    private String uploader;
    private List<YtFormat>        videoFormats;
    private List<YtFormat>        audioFormats;
    /** true when the URL is a playlist or series */
    private Boolean               isPlaylist;
    private List<YtPlaylistEntry> playlistEntries;
}
