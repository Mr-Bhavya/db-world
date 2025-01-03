package com.db.dbworld.payloads.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.nio.file.Path;
import java.util.List;

@Getter
@Setter
public class MediaFileInfo {

    private String id;

    private String fileName;

    private Long fileSize;

    @JsonProperty("@ref")
    private String filePath;

    @JsonProperty("track")
    private List<TrackInfo> trackInfos;

}
