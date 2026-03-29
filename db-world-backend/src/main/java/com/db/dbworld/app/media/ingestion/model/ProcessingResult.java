package com.db.dbworld.app.media.ingestion.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.nio.file.Path;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class ProcessingResult {
    private Path finalFile;
    private Map<String, Object> mediaInfo;
    private boolean success;
    private String errorMessage;
}
