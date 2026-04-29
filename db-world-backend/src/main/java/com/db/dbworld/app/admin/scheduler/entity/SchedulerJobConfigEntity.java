package com.db.dbworld.app.admin.scheduler.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "scheduler_job_config", schema = "new_db_world")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SchedulerJobConfigEntity {

    @Id
    @Column(name = "job_id", length = 100)
    private String jobId;

    @Column(name = "cron_expression", length = 100, nullable = false)
    private String cronExpression;

    @Column(name = "timezone", length = 50)
    private String timezone;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    void onUpdate() { updatedAt = LocalDateTime.now(); }
}
