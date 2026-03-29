package com.db.dbworld.app.media.ingestion.persistence;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;

public interface IngestionRepository {
    void save(IngestionContext context);
}
