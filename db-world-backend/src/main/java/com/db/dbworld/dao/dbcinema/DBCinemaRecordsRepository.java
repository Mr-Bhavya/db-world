package com.db.dbworld.dao.dbcinema;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.helpers.DbWorldRecords;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface DBCinemaRecordsRepository extends JpaRepository<DBCinemaRecordsEntity, Long>, JpaSpecificationExecutor<DBCinemaRecordsEntity> {

    Optional<DBCinemaRecordsEntity> findByTmdbId(long id);


    @Query(value = "SELECT DCR.* FROM DB_CINEMA_RECORDS DCR ORDER BY DCR.ID DESC", nativeQuery = true)
    List<Map<String, Object>> findRecords();

    @Query(value = "SELECT DCR.* FROM DB_CINEMA_RECORDS DCR INNER JOIN TMDB_DATA TD ON DCR.TMDB = TD.ID WHERE DCR.type = :recordType AND TD.original_language IN :languages", nativeQuery = true)
    List<DBCinemaRecordsEntity> findByType(@Param("recordType") String recordType, @Param("languages") List<String> languages, Pageable pageable);

    @Query(value = "SELECT DCR.* FROM DB_CINEMA_RECORDS DCR INNER JOIN USER_RECORD_DATA URD ON DCR.ID = URD.DB_CINEMA_RECORD WHERE URD.USER=:userId and URD.isWatchListed=TRUE ORDER BY URD.ID DESC", nativeQuery = true)
    List<DBCinemaRecordsEntity> findUserWatchListCinemaRecords(@Param("userId") Long userId, Pageable pageable);

    @Query(value = "SELECT count(*) FROM db_cinema_records dcr JOIN tmdb_data td ON td.id = dcr.tmdb WHERE dcr.name LIKE (:keyword) OR td.original_title LIKE (:keyword)", nativeQuery = true)
    Optional<Long> countRecordsByKeyword(@Param("keyword") String keyword);

    @Query(value = """
            SELECT
                dcr.id as recordId,
                dcr.name,
                dcr.type,
                dcr.tmdb as tmdb
            FROM db_cinema_records dcr
            JOIN tmdb_data td ON td.id = dcr.tmdb
            WHERE dcr.name LIKE %:keyword% OR td.original_title LIKE %:keyword%
            ORDER BY dcr.creationDate DESC""",
            nativeQuery = true)
    List<Map<String, Object>> findRecords(@Param("keyword") String keyword);

//    @Query(value = """
//    SELECT
//        dcr.id as recordId,
//        dcr.name as name,
//        dcr.type as type,
//        dcr.tmdb as tmdb
//    FROM db_cinema_records dcr
//    JOIN tmdb_data td ON td.id = dcr.tmdb
//    WHERE dcr.name LIKE %:keyword% OR td.original_title LIKE %:keyword%
//    ORDER BY dcr.creationDate DESC""",
//            nativeQuery = true)
//    List<DbWorldRecords.CinemaRecordDto> findRecords(@Param("keyword") String keyword);

    public interface CinemaRecordProjection {
        Long getRecordId();
        String getName();
        String getType();
        Long getTmdb();
    }


    @Query(value = "SELECT dcr.* FROM db_cinema_records dcr JOIN tmdb_data td ON td.id = dcr.tmdb WHERE dcr.name LIKE (:keyword) OR td.original_title LIKE (:keyword) ORDER BY dcr.creationDate DESC", nativeQuery = true)
    List<DBCinemaRecordsEntity> findRecords(@Param("keyword") String keyword, Pageable pageable);


}
