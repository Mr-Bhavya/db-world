package com.db.dbworld.dao.dbcinema;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DBCinemaRecordsRepository extends JpaRepository<DBCinemaRecordsEntity, Long> {

//    @Query(value = "SELECT * FROM DB_CINEMA_RECORDS DCR INNER JOIN TMDB_DATA TD ON DCR.TMDB = TD.ID WHERE TD.ID = : tmdbId", nativeQuery = true)
    Optional<DBCinemaRecordsEntity> findByTmdbId(long id);

    @Query(nativeQuery = true)
    List<DBCinemaRecordsEntity> findByType(String recordType, Pageable pageable);

    @Query(value = "SELECT DCR.* FROM DB_CINEMA_RECORDS DCR INNER JOIN TMDB_DATA TD ON DCR.TMDB = TD.ID WHERE DCR.type = :recordType AND TD.original_language IN :languages", nativeQuery = true)
    List<DBCinemaRecordsEntity> findByType(@Param("recordType") String recordType, @Param("languages") List<String> languages, Pageable pageable);

    @Query(value = "SELECT DCR.* FROM DB_CINEMA_RECORDS DCR INNER JOIN USER_RECORD_DATA URD ON DCR.ID = URD.DB_CINEMA_RECORD WHERE URD.USER=:userId and URD.isWatchListed=TRUE ORDER BY URD.ID", nativeQuery = true)
    List<DBCinemaRecordsEntity> findUserWatchListCinemaRecords(@Param("userId") Long userId);

    @Query(value = "SELECT count(*) FROM DB_CINEMA_RECORDS dcr WHERE dcr.type = :type", nativeQuery = true)
    Optional<Long> countRecordsByType(@Param("type") String recordType);

    @Query(value = "SELECT count(*) FROM DB_CINEMA_RECORDS dcr JOIN TMDB_DATA td ON td.id = dcr.tmdb WHERE dcr.type = :type AND td.original_language in :languages", nativeQuery = true)
    Optional<Long> countRecordsByTypeAndLanguages(@Param("type") String recordType, @Param("languages") List<String> languages);

    @Query(value = "SELECT dcr.*, uwr.isWatchListed AS isWatchListed, ulr.isLiked AS isLiked from db_cinema_records dcr" +
            " LEFT JOIN user_watchlist_record uwr ON dcr.id = uwr.db_cinema_record AND uwr.user = :userId" +
            " LEFT JOIN User_like_record ulr ON dcr.id = ulr.db_cinema_record AND ulr.user = :userId" +
            " WHERE dcr.type = :type", nativeQuery = true)
    List<DBCinemaRecordsEntity> findRecordsByUserAndType(@Param("userId") Long userId, @Param("type") String recordType, Pageable pageable);


    @Query(value = "SELECT dcr.*, uwr.isWatchListed AS isWatchListed, ulr.isLiked AS isLiked" +
            " FROM db_cinema_records dcr JOIN tmdb_data td ON td.id = dcr.tmdb" +
            " LEFT JOIN user_watchlist_record uwr ON dcr.id = uwr.db_cinema_record AND uwr.user = :userId" +
            " LEFT JOIN User_like_record ulr ON dcr.id = ulr.db_cinema_record AND ulr.user = :userId" +
            " WHERE dcr.type = :type and td.original_language in :languages", nativeQuery = true)
    List<DBCinemaRecordsEntity> findRecordsByUserAndTypeAndLanguages(@Param("userId") Long userId, @Param("type") String recordType, @Param("languages") List<String> languages, Pageable pageable);
}
