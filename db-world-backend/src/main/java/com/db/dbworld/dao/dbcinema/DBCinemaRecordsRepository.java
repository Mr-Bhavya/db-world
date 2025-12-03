package com.db.dbworld.dao.dbcinema;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.helpers.DbWorldRecords;
import org.springframework.data.domain.Page;
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

    @Query(value = "SELECT DCR.* FROM DB_CINEMA_RECORDS DCR INNER JOIN USER_RECORD_DATA URD ON DCR.ID = URD.DB_CINEMA_RECORD WHERE URD.USER=:userId and URD.is_watchListed=TRUE ORDER BY URD.ID DESC", nativeQuery = true)
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
            ORDER BY dcr.creation_date DESC""",
            nativeQuery = true)
    List<Map<String, Object>> findRecords(@Param("keyword") String keyword);

    @Query(value = """
        SELECT r.id, r.name, r.type, r.creation_date, r.last_modified_date,
        r.tmdb, r.show_on_top FROM db_cinema_records r
        WHERE 
        (:search IS NULL OR :search = '' OR 
         LOWER(r.name) LIKE LOWER(CONCAT('%', :search, '%')) OR 
         CAST(r.id AS CHAR) LIKE CONCAT('%', :search, '%') OR
         CAST(r.tmdb AS CHAR) LIKE CONCAT('%', :search, '%'))
        AND
        (:type IS NULL OR :type = '' OR r.type = :type)
        ORDER BY 
        CASE WHEN :sortBy = 'name' AND :sortDirection = 'ASC' THEN r.name END ASC,
        CASE WHEN :sortBy = 'name' AND :sortDirection = 'DESC' THEN r.name END DESC,
        CASE WHEN :sortBy = 'id' AND :sortDirection = 'ASC' THEN r.id END ASC,
        CASE WHEN :sortBy = 'id' AND :sortDirection = 'DESC' THEN r.id END DESC,
        CASE WHEN :sortBy = 'date' AND :sortDirection = 'ASC' THEN r.creation_date END ASC,
        CASE WHEN :sortBy = 'date' AND :sortDirection = 'DESC' THEN r.creation_date END DESC,
        CASE WHEN :sortBy = 'files' AND :sortDirection = 'ASC' THEN (
            SELECT COUNT(*) FROM media_file_info m WHERE m.db_cinema_record_id = r.id
        ) END ASC,
        CASE WHEN :sortBy = 'files' AND :sortDirection = 'DESC' THEN (
            SELECT COUNT(*) FROM media_file_info m WHERE m.db_cinema_record_id = r.id
        ) END DESC,
        r.creation_date DESC
        """,
            countQuery = """
        SELECT COUNT(*) FROM db_cinema_records r
        WHERE 
        (:search IS NULL OR :search = '' OR 
         LOWER(r.name) LIKE LOWER(CONCAT('%', :search, '%')) OR 
         CAST(r.id AS CHAR) LIKE CONCAT('%', :search, '%') OR
         CAST(r.tmdb AS CHAR) LIKE CONCAT('%', :search, '%'))
        AND
        (:type IS NULL OR :type = '' OR r.type = :type)
        """,
            nativeQuery = true)
    Page<Map<String, Object>> findRecordsWithFilters(
            @Param("search") String search,
            @Param("type") String type,
            @Param("sortBy") String sortBy,
            @Param("sortDirection") String sortDirection,
            Pageable pageable);


    public interface CinemaRecordProjection {
        Long getRecordId();
        String getName();
        String getType();
        Long getTmdb();
    }


    @Query(value = "SELECT dcr.* FROM db_cinema_records dcr JOIN tmdb_data td ON td.id = dcr.tmdb WHERE dcr.name LIKE (:keyword) OR td.original_title LIKE (:keyword) ORDER BY dcr.creation_date DESC", nativeQuery = true)
    List<DBCinemaRecordsEntity> findRecords(@Param("keyword") String keyword, Pageable pageable);


}
