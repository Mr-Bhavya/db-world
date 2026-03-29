package com.db.dbworld.app.media.ingestion.persistence.impl;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.persistence.IngestionRepository;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Repository;

/**
 * No-op implementation of IngestionRepository.
 * Logs the completed context but does not persist to the database.
 *
 * Replace this with a real JPA repository when the ingestion_job table is ready.
 */
@Log4j2
@Repository
public class NoOpIngestionRepository implements IngestionRepository {

    @Override
    public void save(IngestionContext context) {
        log.info("[{}] Ingestion job completed — status={}, file={}",
                context.getJobId(),
                context.getStatus(),
                context.getDownload() != null ? context.getDownload().getFileName() : "N/A"
        );
        // TODO: persist to ingestion_jobs table when entity/migration is ready
    }
}
