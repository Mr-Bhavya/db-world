package com.db.dbworld.app.media.ingestion.spi;

import com.db.dbworld.app.media.ingestion.model.SourceMetadata;

public interface SourceHandler {
    boolean supports(String uri);
    SourceMetadata resolve(String uri);
}
