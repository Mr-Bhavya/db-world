package com.db.dbworld.app.media.info.repository;

import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MediaFileRepository extends JpaRepository<MediaFileEntity, String> {

    @EntityGraph(attributePaths = "tracks")
    List<MediaFileEntity> findByRecord_Id(Long recordId);

    @EntityGraph(attributePaths = "tracks")
    Optional<MediaFileEntity> findByFilePath(String filePath);

    List<MediaFileEntity> findByIngestionJobId(String ingestionJobId);

    @Query("SELECT m FROM MediaFileEntity m WHERE m.record.id = :recordId")
    List<MediaFileEntity> findAllByRecordId(Long recordId);

    void deleteByFilePath(String filePath);

    void deleteAllByRecord_Id(Long recordId);
}
