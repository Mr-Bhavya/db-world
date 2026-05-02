package com.db.dbworld.app.media.ingestion.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class YtPlaylistEntry {
    private int    index;
    private String id;
    private String title;
    private String url;
    private String thumbnail;
    private Long   duration;   // seconds
    private String uploader;
}
