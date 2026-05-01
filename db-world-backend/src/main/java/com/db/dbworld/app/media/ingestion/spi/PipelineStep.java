package com.db.dbworld.app.media.ingestion.spi;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;

public interface PipelineStep {
    void execute(IngestionContext context);
}
