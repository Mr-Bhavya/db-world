package com.db.dbworld.dao.dbcinema.stream;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface MediaFileInfoRepository extends JpaRepository<MediaFileInfoEntity, String> {
    List<MediaFileInfoEntity> findAllByDbCinemaRecordId(Long recordId);

    @Query(nativeQuery = true, value = "SELECT filePath FROM MEDIA_FILE_INFO WHERE ID=:id")
    Optional<String> getFileInfoById(@Param("id") String id);

    @Query(nativeQuery = true, value = "SELECT id, filePath, fileSize FROM MEDIA_FILE_INFO")
    List<Map<String, String>> getAllFilePath();

    @Query(nativeQuery = true, value = "SELECT INFO.* FROM MEDIA_FILE_INFO INFO " +
            "INNER JOIN ( SELECT MIN(id) AS id  FROM MEDIA_FILE_INFO GROUP BY db_cinema_record ) AS grouped ON INFO.id = grouped.id " +
            "ORDER BY RAND()")
    List<MediaFileInfoEntity> getRandom(Pageable pageable);

    List<MediaFileInfoEntity> findAllByFilePath(String filePath);

    void deleteAllByFilePath(String filePath);
}
