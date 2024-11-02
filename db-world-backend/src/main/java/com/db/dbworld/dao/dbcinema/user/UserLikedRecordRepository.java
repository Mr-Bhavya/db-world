package com.db.dbworld.dao.dbcinema.user;

import com.db.dbworld.entities.dbcinema.user.UserLikeRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserLikedRecordRepository extends JpaRepository<UserLikeRecordEntity, Long> {
    Optional<UserLikeRecordEntity> findByUserUserIdAndDbCinemaRecordId(Long userId, Long recordId);

    @Modifying
    @Query(value = "UPDATE user_like_record ulr SET ulr.isLiked=false WHERE ulr.user = :userId AND ulr.db_cinema_record = :recordId", nativeQuery = true)
    void setIsLikeAsFalseByUserIdRecordId(@Param("userId") Long userId, @Param("recordId") Long recordId);

    @Query(value = "SELECT ulr.isLiked FROM user_like_record ulr WHERE ulr.user = :userId AND ulr.db_cinema_record = :recordId", nativeQuery = true)
    Optional<Boolean> isRecordLikedByUser(@Param("userId") Long userId, @Param("recordId") Long recordId);

    void deleteByDbCinemaRecordId(Long recordId);
}
