package com.db.dbworld.app.admin.scheduler.repository;

import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface SchedulerJobHistoryRepository extends JpaRepository<SchedulerJobHistoryEntity, Long> {
    List<SchedulerJobHistoryEntity> findAllByOrderByStartedAtDesc(Pageable pageable);

    /** Per-job history feed for the per-card drawer in the admin UI. */
    List<SchedulerJobHistoryEntity> findByJobNameOrderByStartedAtDesc(String jobName, Pageable pageable);

    /** Job names present in history — including retired jobs with no config row left. */
    @Query("SELECT DISTINCT h.jobName FROM SchedulerJobHistoryEntity h")
    List<String> findDistinctJobNames();

    /**
     * One page of ids eligible for pruning.
     *
     * <p>Returns ids rather than deleting in place so the caller can delete in bounded
     * batches: the first prune after this feature ships has years of backlog to clear, and a
     * single unbounded {@code DELETE} would hold a long table lock on the Pi's MySQL. Also
     * avoids a delete-with-self-subquery, which MySQL rejects outright (error 1093).
     */
    @Query("SELECT h.id FROM SchedulerJobHistoryEntity h "
         + "WHERE h.jobName = :jobName AND h.startedAt < :cutoff ORDER BY h.id")
    List<Long> findIdsToPrune(@Param("jobName") String jobName,
                              @Param("cutoff") LocalDateTime cutoff,
                              Pageable pageable);
}
