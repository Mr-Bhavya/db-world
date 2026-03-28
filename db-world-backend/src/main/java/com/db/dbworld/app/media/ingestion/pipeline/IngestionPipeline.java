package com.db.dbworld.app.media.ingestion.processing;

import com.db.dbworld.app.media.ingestion.model.IngestionRequest;

public interface IngestionPipeline {
    void start(IngestionRequest request);
}
