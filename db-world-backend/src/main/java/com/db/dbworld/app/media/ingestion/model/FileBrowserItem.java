package com.db.dbworld.app.media.ingestion.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FileBrowserItem {
    private final String  name;
    private final String  path;          // absolute server path
    private final String  relativePath;  // relative to root
    private final boolean directory;
    private final Long    size;          // null for directories
    private final Long    lastModified;  // epoch millis
    private final String  extension;

    public FileBrowserItem(String name, String path, String relativePath, boolean directory,
                           Long size, Long lastModified, String extension) {
        this.name = name;
        this.path = path;
        this.relativePath = relativePath;
        this.directory = directory;
        this.size = size;
        this.lastModified = lastModified;
        this.extension = extension;
    }
}
