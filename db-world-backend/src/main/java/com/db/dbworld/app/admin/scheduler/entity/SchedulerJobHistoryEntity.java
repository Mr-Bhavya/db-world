package com.db.dbworld.app.admin.scheduler.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "scheduler_job_history",
    schema = "new_db_world",
    indexes = @Index(name = "idx_sch_hist_started", columnList = "started_at")
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SchedulerJobHistoryEntity {

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
}
