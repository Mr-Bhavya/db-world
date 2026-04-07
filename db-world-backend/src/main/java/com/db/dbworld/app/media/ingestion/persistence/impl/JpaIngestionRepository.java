package com.db.dbworld.app.media.ingestion.persistence.impl;

import com.db.dbworld.app.media.ingestion.entity.IngestionJobEntity;
import com.db.dbworld.app.media.ingestion.enums.SourceType;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.persistence.IngestionRepository;
import com.db.dbworld.app.media.ingestion.repository.IngestionJobRepository;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

import java.time.Instant;

/**
 * JPA-backed implementation of IngestionRepository.
 * Annotated @Primary so it overrides NoOpIngestionRepository.
 *
 * Persists a complete snapshot of the job at completion (success / fail / cancel).
 * The GID is read from DownloadResult so it's available for audit even after the job
 * is removed from the in-memory IngestionJobStore.
 */
@Log4j2
@Primary
@Repository
@RequiredArgsConstructor
public class JpaIngestionRepository implements IngestionRepository {

    private final IngestionJobRepository jobRepository;

    @Override
    public void save(IngestionContext context) {
        try {
            IngestionJobEntity entity = new IngestionJobEntity();
            entity.setJobId(context.getJobId());
            entity.setStatus(context.getStatus() != null ? context.getStatus() : MirrorStatus.FAILED);
            entity.setStep(context.getCurrentStep());
            entity.setSourceType(parseSourceType(context.getSource() != null ? context.getSource().getType() : null));
            entity.setRecordId(context.getRecordId());
            entity.setCompletedAt(Instant.now());

            if (context.getRequest() != null) {
                entity.setUri(context.getRequest().getUri());
                entity.setFolderName(context.getRequest().getFolderName());
                entity.setSeasonNumber(context.getRequest().getSeason());
                entity.setEpisodeNumber(context.getRequest().getEpisode());
            }

            if (context.getProcessing() != null && context.getProcessing().getFinalFile() != null) {
                entity.setFileName(context.getProcessing().getFinalFile().getFileName().toString());
                if (entity.getFolderName() == null && context.getProcessing().getFinalFile().getParent() != null) {
                    entity.setFolderName(context.getProcessing().getFinalFile().getParent().getFileName().toString());
                }
            } else if (context.getDownload() != null) {
                entity.setFileName(context.getDownload().getFileName());
            }

            if (context.getDownload() != null) {
                entity.setGid(context.getDownload().getGid());
                entity.setDownloadedBytes(context.getDownload().getSize());
                entity.setTotalBytes(context.getDownload().getSize());
            }

            if (context.getProcessing() != null
                    && context.getProcessing().getMediaInfo() != null) {
                Object json = context.getProcessing().getMediaInfo().get("mediaInfoJson");
                if (json != null) entity.setMediaInfoJson(json.toString());
            }

            // failReason is stored in context.message for failed jobs
            if (context.getMessage() != null) {
                entity.setFailReason(context.getMessage());
            }

            // Persist the HTML progress report so history can show it without in-memory tracking
            if (context.getHtmlReport() != null) {
                entity.setHtmlReport(context.getHtmlReport());
            }

            jobRepository.save(entity);
            log.info("[{}] Job persisted — status={}", context.getJobId(), entity.getStatus());

        } catch (Exception e) {
            log.error("[{}] Failed to persist job to DB", context.getJobId(), e);
        }
    }

    private SourceType parseSourceType(String type) {
        if (type == null) return null;
        try {
            return SourceType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return SourceType.UNKNOWN;
        }
    }
}
