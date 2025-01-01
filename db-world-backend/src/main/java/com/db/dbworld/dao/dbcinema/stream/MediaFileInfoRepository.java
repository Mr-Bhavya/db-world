package com.db.dbworld.dao.dbcinema.stream;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MediaFileInfoRepository extends JpaRepository<MediaFileInfoEntity, String> {
    List<MediaFileInfoEntity> findAllByDbCinemaRecordId(Long recordId);
    @Query(nativeQuery = true, value = "SELECT filePath FROM MEDIA_FILE_INFO WHERE ID=:id")
    Optional<String> getFileInfoById(@Param("id") String id);
}
