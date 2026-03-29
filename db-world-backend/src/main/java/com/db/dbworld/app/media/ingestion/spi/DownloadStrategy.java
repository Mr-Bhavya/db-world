package com.db.dbworld.app.media.ingestion.spi;

import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.SourceMetadata;

public interface DownloadStrategy {
    boolean supports(SourceMetadata metadata);
    DownloadResult download(IngestionContext context);
    void cancel(String jobId);
}
