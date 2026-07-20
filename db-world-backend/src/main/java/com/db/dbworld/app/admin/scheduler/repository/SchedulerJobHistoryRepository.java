package com.db.dbworld.app.admin.scheduler.repository;

import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SchedulerJobHistoryRepository extends JpaRepository<SchedulerJobHistoryEntity, Long> {
    List<SchedulerJobHistoryEntity> findAllByOrderByStartedAtDesc(Pageable pageable);

    /** Per-job history feed for the per-card drawer in the admin UI. */
    List<SchedulerJobHistoryEntity> findByJobNameOrderByStartedAtDesc(String jobName, Pageable pageable);
}
