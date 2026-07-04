package com.db.dbworld.audit.tracking.repository;

import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.SessionState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public interface ActivitySessionRepository extends JpaRepository<ActivitySessionEntity, String> {
    List<ActivitySessionEntity> findByStateInAndLastEventAtBefore(List<SessionState> states, Instant cutoff);
}
