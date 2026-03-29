package com.db.dbworld.app.media.ingestion.pipeline;

import com.db.dbworld.app.media.ingestion.model.IngestionRequest;

public interface IngestionPipeline {
    String start(IngestionRequest request);
}
