package com.db.dbworld.dao.dbcinema.user;

import com.db.dbworld.entities.dbcinema.user.UserRecordDataEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRecordDataRepository extends JpaRepository<UserRecordDataEntity, Long> {
    Optional<UserRecordDataEntity> findByUserUserIdAndDbCinemaRecordId(Long userId, Long recordId);

    @Modifying
    @Query(value = "UPDATE USER_RECORD_DATA urd SET urd.isLiked=false WHERE urd.user = :userId AND urd.db_cinema_record = :recordId", nativeQuery = true)
    void setIsLikeAsFalseByUserIdRecordId(@Param("userId") Long userId, @Param("recordId") Long recordId);

    @Query(value = "SELECT urd.isLiked FROM USER_RECORD_DATA urd WHERE urd.user = :userId AND urd.db_cinema_record = :recordId", nativeQuery = true)
    Optional<Boolean> isRecordLikedByUser(@Param("userId") Long userId, @Param("recordId") Long recordId);

    @Modifying
    @Query(value = "UPDATE USER_RECORD_DATA urd SET urd.isWatched=false WHERE urd.user = :userId AND urd.db_cinema_record = :recordId", nativeQuery = true)
    void setIsWatchAsFalseByUserIdRecordId(@Param("userId") Long userId, @Param("recordId") Long recordId);

    @Query(value = "SELECT urd.isWatched FROM USER_RECORD_DATA urd WHERE urd.user = :userId AND urd.db_cinema_record = :recordId", nativeQuery = true)
    Optional<Boolean> isRecordWatchedByUser(@Param("userId") Long userId, @Param("recordId") Long recordId);

    @Modifying
    @Query(value = "UPDATE USER_RECORD_DATA urd SET urd.isWatchListed=false WHERE urd.user = :userId AND urd.db_cinema_record = :recordId", nativeQuery = true)
    void setIsWatchListedAsFalseByUserIdRecordId(@Param("userId") Long userId, @Param("recordId") Long recordId);

    @Query(value = "SELECT urd.isWatchListed FROM USER_RECORD_DATA urd WHERE urd.user = :userId AND urd.db_cinema_record = :recordId", nativeQuery = true)
    Optional<Boolean> isRecordWatchListedByUser(@Param("userId") Long userId, @Param("recordId") Long recordId);

    void deleteByDbCinemaRecordId(Long recordId);
}
