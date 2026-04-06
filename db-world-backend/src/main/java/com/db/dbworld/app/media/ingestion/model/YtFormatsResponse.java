package com.db.dbworld.app.media.ingestion.model;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class YtFormatsResponse {
    private String title;
    private String thumbnail;
    private Long   duration;        // seconds
    private String uploader;
    private List<YtFormat> videoFormats;
    private List<YtFormat> audioFormats;
}
