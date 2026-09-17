package com.db.dbworld.app.admin.scheduler.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "scheduler_job_history",
    schema = "db_world",
    indexes = {
        @Index(name = "idx_sch_hist_started", columnList = "started_at"),          // full history list
        @Index(name = "idx_sch_hist_job_started", columnList = "job_name, started_at"), // per-job history
        @Index(name = "idx_sch_hist_run_id", columnList = "run_id")                // run → logs lookup
    }
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SchedulerJobHistoryEntity {

    /** How a run was started. */
    public enum TriggerSource {
        /** Fired by its cron trigger or fixed-delay tick. */
        SCHEDULED,
        /** Started by an admin clicking "Run now" — see {@link #triggeredByUser}. */
        MANUAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_name", length = 100, nullable = false)
    private String jobName;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    /** SUCCESS or FAILED */
    @Column(name = "status", length = 20, nullable = false)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String message;

    /**
     * Correlation id written into the MDC for the whole run, so every log line the job
     * emitted carries it. The admin UI passes this to
     * {@code GET /api/admin/logs/run/{runId}} to pull that run's log lines back out of the
     * JSON log files. Null on rows written before this column existed.
     */
    @Column(name = "run_id", length = 40)
    private String runId;

    /**
     * {@link com.db.dbworld.app.admin.scheduler.dto.JobRunSummary} as JSON — the counters
     * the job actually produced (records synced, files added, sources polled…). Stored as
     * JSON rather than columns because no two jobs count the same things.
     */
    @Column(name = "summary_json", columnDefinition = "TEXT")
    private String summaryJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "triggered_by", length = 20)
    private TriggerSource triggeredBy;

    /** Email of the admin who pressed "Run now"; null for {@link TriggerSource#SCHEDULED} runs. */
    @Column(name = "triggered_by_user", length = 150)
    private String triggeredByUser;
}
