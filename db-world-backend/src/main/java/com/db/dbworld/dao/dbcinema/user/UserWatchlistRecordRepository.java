package com.db.dbworld.dao.dbcinema.user;

import com.db.dbworld.entities.dbcinema.user.UserWatchlistRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserWatchlistRecordRepository extends JpaRepository<UserWatchlistRecordEntity, Long> {

    Optional<UserWatchlistRecordEntity> findByUserUserIdAndDbCinemaRecordId(Long userId, Long recordId);

    @Modifying
    @Query(value = "UPDATE user_watchlist_record uwr SET uwr.isWatchListed=false where uwr.user = :userId AND uwr.db_cinema_record = :recordId", nativeQuery = true)
    void setIsWatchlistAsFalseByUserIdRecordId(@Param("userId") Long userId, @Param("recordId") Long recordId);

    @Query(value = "SELECT uwr.isWatchListed FROM user_watchlist_record uwr WHERE uwr.user = :userId AND uwr.db_cinema_record = :recordId", nativeQuery = true)
    Optional<Boolean> isRecordWatchListedByUser(@Param("userId") Long userId, @Param("recordId") Long recordId);

    void deleteByDbCinemaRecordId(Long recordId);

}
