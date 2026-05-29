package com.db.dbworld.app.admin.scheduler.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "scheduler_job_config", schema = "new_db_world")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SchedulerJobConfigEntity {

    /** CRON: scheduled via Spring TaskScheduler using {@link #cronExpression}.
     *  FIXED_DELAY: the job runs itself via {@code @Scheduled(fixedDelay...)};
     *               admin only controls enable/manual trigger and visibility. */
    public enum JobType { CRON, FIXED_DELAY }

    @Id
    @Column(name = "job_id", length = 100)
    private String jobId;

    /** Required for CRON jobs; ignored for FIXED_DELAY. */
    @Column(name = "cron_expression", length = 100)
    private String cronExpression;

    @Column(name = "timezone", length = 50)
    private String timezone;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

    /** CRON (default for backward compat) or FIXED_DELAY. */
    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", length = 20, nullable = false)
    @Builder.Default
    private JobType jobType = JobType.CRON;

    /** Required for FIXED_DELAY; ignored for CRON. */
    @Column(name = "interval_seconds")
    private Integer intervalSeconds;

    /**
     * Job-specific stability window (currently used by MediaSync — number of
     * seconds since mtime that a file is considered "still being written" and
     * skipped). Null falls back to a code-side default. Stored on this entity
     * rather than a per-job parameters table because we have exactly one
     * consumer; promote to a JSON parameters column if a second consumer ever
     * needs its own knob.
     */
    @Column(name = "stability_window_seconds")
    private Integer stabilityWindowSeconds;

    /**
     * Admin-supplied display label override. When null, the service falls
     * back to the hardcoded {@code displayName(jobId)} switch. Lets the admin
     * rename "TmdbMovieSync" to "🎬 Movies Sync" without touching code.
     */
    @Column(name = "display_name", length = 200)
    private String displayName;

    /**
     * Admin's own notes — free-text annotation surfaced beneath the
     * code-generated description in the UI. Kept separate from the
     * description so PersonSync's dynamic "(N pending)" suffix stays
     * intact.
     */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
