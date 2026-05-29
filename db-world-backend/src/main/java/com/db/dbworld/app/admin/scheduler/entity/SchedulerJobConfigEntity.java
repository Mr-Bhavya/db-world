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

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
