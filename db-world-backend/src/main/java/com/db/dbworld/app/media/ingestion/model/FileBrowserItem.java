package com.db.dbworld.app.media.ingestion.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FileBrowserItem {
    private String  name;
    private String  path;          // absolute server path
    private String  relativePath;  // relative to root
    private boolean directory;
    private Long    size;          // null for directories
    private Long    lastModified;  // epoch millis
    private String  extension;
}
