package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserCinemaDataEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Date;
import java.util.List;
import java.util.Optional;

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

    List<UserCinemaDataEntity> findTop10ByUserEmailOrderByTimeDesc(String email);

    boolean existsByUserEmailAndValueAndEvent(String userId, String fileName, String string);

    @Query(value = """
    SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY user ORDER BY time DESC) AS rn
        FROM db_world.USER_CINEMA_DATA
    ) ranked
    WHERE rn <= 10
    """, nativeQuery = true)
    List<UserCinemaDataEntity> findTop10EventsPerExistingUser();

    Optional<UserCinemaDataEntity> findByDownloadId(String downloadId);

    Optional<UserCinemaDataEntity> findByDownloadIdAndStatus(String downloadId, UserCinemaDataEntity.Status status);

    boolean existsByDownloadIdAndStatus(String downloadId, UserCinemaDataEntity.Status status);

}
