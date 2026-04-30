package com.db.dbworld.app.cinema.notification.repository;

import com.db.dbworld.app.cinema.notification.entity.UserNotificationEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface UserNotificationRepository extends JpaRepository<UserNotificationEntity, Long> {

    List<UserNotificationEntity> findByRecipientUserIdOrderByCreatedAtDesc(
            Long recipientUserId, Pageable pageable);

    long countByRecipientUserIdAndReadFalse(Long recipientUserId);

    boolean existsByActorUserIdAndRecordId(Long actorUserId, Long recordId);

    @Modifying
    @Query("UPDATE UserNotificationEntity n SET n.read = true " +
           "WHERE n.recipientUserId = :userId AND n.read = false")
    void markAllReadByRecipientUserId(@Param("userId") Long userId);
}
