package com.db.dbworld.app.media.ingestion.spi;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.ProcessingResult;

public interface ProcessingStrategy {
    boolean supports(IngestionContext context);
    ProcessingResult process(IngestionContext context);
}
