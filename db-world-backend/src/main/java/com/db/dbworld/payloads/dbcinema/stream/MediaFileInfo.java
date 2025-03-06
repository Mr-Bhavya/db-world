package com.db.dbworld.payloads.dbcinema.stream;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
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

    public MediaFileInfo initialize() throws IOException {
        if (this.filePath != null) {
            String[] filePathArray = filePath.replace("\\","/").split("/");
            this.fileName = filePathArray[filePathArray.length - 1];
            this.fileSize = Files.size(Paths.get(filePath));
            this.id = String.valueOf(this.fileSize);
        }
        return this;
    }

}
