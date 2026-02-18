package com.db.dbworld.dao.dbcinema.stream;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface MediaFileInfoRepository extends JpaRepository<MediaFileInfoEntity, String> {
    List<MediaFileInfoEntity> findAllByDbCinemaRecordId(Long recordId);

    @Query(nativeQuery = true, value = "SELECT file_path FROM MEDIA_FILE_INFO WHERE ID=:id")
    Optional<String> getFileInfoById(@Param("id") String id);

    @Query(nativeQuery = true, value = "SELECT id, file_path, file_size FROM MEDIA_FILE_INFO")
    List<Map<String, Object>> getAllFilePath();

    @Query(nativeQuery = true, value = "SELECT INFO.* FROM MEDIA_FILE_INFO INFO " +
            "INNER JOIN (SELECT MIN(id) AS id FROM MEDIA_FILE_INFO GROUP BY db_cinema_record) AS grouped " +
            "ON INFO.id = grouped.id " +
            "INNER JOIN db_cinema_records CINEMA ON INFO.db_cinema_record = CINEMA.id " +
            "WHERE (:recordTypes IS NULL OR CINEMA.type IN (:recordTypes)) " +
            "ORDER BY RAND()")
    List<MediaFileInfoEntity> getRandom(@Param("recordTypes") String[] recordTypes, Pageable pageable);

    List<MediaFileInfoEntity> findAllByFilePath(String filePath);

    Optional<MediaFileInfoEntity> findOneByFilePath(String filePath);

    List<MediaFileInfoEntity> findAllByDbCinemaRecordIdIn(List<Long> recordIds);

    void deleteAllByFilePath(String filePath);

    @EntityGraph(attributePaths = "trackInfos")
    List<MediaFileInfoEntity> findAll();

}
