package com.db.dbworld.app.media.ingestion.entity;

import com.db.dbworld.app.media.ingestion.enums.SourceType;
import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

/**
 * Persistent record for every ingestion job.
 *
 * Table: ingestion_jobs (new_db_world schema)
 * Primary key: job UUID — same UUID used in-memory during execution.
 *
 * ── Enum columns ─────────────────────────────────────────────────────────
 *  status     → MirrorStatus   stored as VARCHAR via @Enumerated(STRING)
 *  step       → PipelineStepType  stored as VARCHAR
 *  sourceType → SourceType     stored as VARCHAR
 *
 * ── JSON column ──────────────────────────────────────────────────────────
 *  mediaInfoJson → MySQL JSON type (validated, indexable via JSON_EXTRACT)
 *
 * ── GID field ─────────────────────────────────────────────────────────────
 *  gid: Aria2 download GID. NULL for yt-dlp jobs.
 *  Required for post-completion audit (e.g. rerun from DB when GID is lost
 *  from in-memory store after a restart).
 */
@Entity
@Table(name = "ingestion_jobs", schema = "new_db_world")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class IngestionJobEntity {

    @Id
    @Column(name = "job_id", length = 36, nullable = false)
    private String jobId;

    /**
     * Terminal states: SUCCESS, FAILED, CANCELLED.
     * Active states:   QUEUED, STARTED, DOWNLOADING, PROCESSING, PAUSED.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MirrorStatus status;

    /**
     * Last completed pipeline step.
     * Useful for debugging and rerun: tells you where the job stopped.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PipelineStepType step;

    /**
     * Download strategy used: YOUTUBE, HTTP, TORRENT, UNKNOWN.
     * Determines which operations are available for rerun.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", length = 20)
    private SourceType sourceType;

    @Column(length = 2000)
    private String uri;

    @Column(name = "folder_name", length = 500)
    private String folderName;

    @Column(name = "file_name", length = 500)
    private String fileName;

    /**
     * Aria2 GID. NULL for yt-dlp jobs.
     * Stored here for audit/logging; the live GID for active jobs is in IngestionJobStore.
     */
    @Column(length = 50)
    private String gid;

    @Column(name = "downloaded_bytes")
    private Long downloadedBytes;

    @Column(name = "total_bytes")
    private Long totalBytes;

    @Lob
    @Column(name = "fail_reason", columnDefinition = "LONGTEXT")
    private String failReason;

    /**
     * Summary of media metadata after processing.
     * Stored as MySQL JSON type for schema-less extensibility.
     * Full MediaInfo is in the media_files / media_tracks tables.
     */
    @Column(name = "media_info_json", columnDefinition = "JSON")
    private String mediaInfoJson;

    /**
     * Optional link to a cinema record (RecordEntity.id).
     * Used to look up TMDB metadata for cover art embedding and series naming.
     */
    @Column(name = "record_id")
    private Long recordId;

    /** Season number — set for TV series ingestion. */
    @Column(name = "season_number")
    private Integer seasonNumber;

    /** Episode number — set for TV series ingestion. */
    @Column(name = "episode_number")
    private Integer episodeNumber;

    @Column(name = "started_at", updatable = false)
    private Instant startedAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    /**
     * Full HTML progress report captured at job completion.
     * Stored as LONGTEXT so it can be retrieved from history without the
     * in-memory TrackingService (which evicts jobs after completion).
     */
    @Column(name = "html_report", columnDefinition = "LONGTEXT")
    private String htmlReport;
}
