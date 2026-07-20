package com.db.dbworld.app.media.ingestion.model;

import lombok.Data;

/**
 * Partial edit applied to a still-running job via {@code PATCH /api/ingestion/{jobId}/params}.
 *
 * Only fields that are consumed at PROCESSING time (after the download finishes) are editable,
 * so a live edit is safe: it takes effect when the pipeline reaches the processing stage.
 * Currently limited to season/episode, which drive TV episode naming + the final season folder
 * (see {@code FfmpegProcessingStrategy.resolveEpisodeRef}). Null fields are left unchanged.
 */
@Data
public class JobEditRequest {
    private Integer season;
    private Integer episode;
}
