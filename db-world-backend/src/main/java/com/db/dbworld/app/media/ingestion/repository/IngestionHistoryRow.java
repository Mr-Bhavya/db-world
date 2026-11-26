package com.db.dbworld.app.media.ingestion.repository;

import com.db.dbworld.app.media.ingestion.enums.SourceType;
import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;

import java.time.Instant;

/**
 * History list row: the columns the history table shows, without the LONGTEXT/JSON columns
 * (html report, media info) that made loading the whole history table slow.
 */
public record IngestionHistoryRow(
        String jobId,
        MirrorStatus status,
        PipelineStepType step,
        SourceType sourceType,
        String uri,
        String fileName,
        Long totalBytes,
        Instant startedAt,
        Instant completedAt,
        String failReason,
        Long recordId
) {}
