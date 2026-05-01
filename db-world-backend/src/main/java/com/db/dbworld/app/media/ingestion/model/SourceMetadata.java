package com.db.dbworld.app.media.ingestion.model;

import lombok.Getter;
import lombok.Setter;

import java.nio.file.Path;
import java.util.Map;

@Getter
@Setter
public class SourceMetadata {
    private String uri;
    private String type;
    private Map<String, Object> attributes;
}
