package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserCinemaDataEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Date;
import java.util.List;

public interface UserCinemaDataRepository extends JpaRepository<UserCinemaDataEntity, Long> {

    List<UserCinemaDataEntity> findAllByUserUserId(Long userId, Pageable pageable);

    @Query("SELECT COUNT(u) > 0 FROM UserCinemaDataEntity u " +
            "WHERE u.user.email = :email AND u.event = :event AND u.value = :value AND u.time >= :since")
    boolean existsRecentMatch(
            @Param("email") String email,
            @Param("event") String event,
            @Param("value") String value,
            @Param("since") Date since
    );

    // 🔹 Count by event type after a certain time
    @Query("SELECT COUNT(u) FROM UserCinemaDataEntity u WHERE u.event = :type AND u.time >= :after")
    long countByTypeAndTimeAfter(@Param("type") String type, @Param("after") Date after);

    // 🔹 Count all activities after a given time
    @Query("SELECT COUNT(u) FROM UserCinemaDataEntity u WHERE u.time >= :since")
    long countActivitiesSince(@Param("since") Date since);

    // 🔹 Count distinct users active after a given time
    @Query("SELECT COUNT(DISTINCT u.user.email) FROM UserCinemaDataEntity u WHERE u.time >= :since")
    long countUniqueUsersSince(@Param("since") Date since);

    // 🔹 Find recent activity entries (you can limit the number in service layer)
    @Query("SELECT u FROM UserCinemaDataEntity u WHERE u.time >= :cutoff ORDER BY u.time DESC")
    List<UserCinemaDataEntity> findRecentActivities(@Param("cutoff") Date cutoff, org.springframework.data.domain.Pageable pageable);

    default List<UserCinemaDataEntity> findRecentActivities(Date cutoff, int limit) {
        return findRecentActivities(cutoff, org.springframework.data.domain.PageRequest.of(0, limit));
    }
}
