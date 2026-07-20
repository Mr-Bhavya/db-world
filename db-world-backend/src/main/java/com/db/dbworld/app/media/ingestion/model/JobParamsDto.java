package com.db.dbworld.app.media.ingestion.model;

import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Re-editable snapshot of a job's original request, returned by
 * {@code GET /api/ingestion/{jobId}/params} to pre-fill the ingestion form for a
 * "rerun with edit" flow.
 *
 * Source of truth: the in-memory {@link IngestionRequest} while the job is still
 * tracked, otherwise the persisted {@code ingestion_jobs} row.
 *
 * The {@link #record} is resolved server-side (best-effort) so the form's
 * RecordSearch autocomplete can show the linked record without an extra lookup.
 * The archive/URL {@code password} fields are intentionally omitted — secrets are
 * never persisted and are not echoed back; the user re-enters them if needed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobParamsDto {

    private String uri;

    /** Linked cinema record id (kept even if {@link #record} can't be resolved). */
    private Long recordId;

    /** Resolved record for the autocomplete field; null when unresolved. */
    private RecordAutocompleteDto record;

    private Integer season;
    private Integer episode;

    private String videoITag;
    private String audioITag;
    private Boolean onlyAudio;
    private String videoQuality;

    private Boolean extract;
    private Boolean rename;

    /** Custom output filename — only populated when {@link #rename} is true. */
    private String fileName;

    private Boolean urlProtected;
    private String username;
}
