package com.db.dbworld.app.media.info.repository;

import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /** All media files with no linked record. */
    @EntityGraph(attributePaths = "tracks")
    @Query("SELECT m FROM MediaFileEntity m WHERE m.record IS NULL ORDER BY m.createdAt DESC")
    List<MediaFileEntity> findUnassigned();

    /** Unassigned files matching a name fragment (case-insensitive). */
    @EntityGraph(attributePaths = "tracks")
    @Query("SELECT m FROM MediaFileEntity m WHERE m.record IS NULL " +
           "AND LOWER(m.fileName) LIKE LOWER(CONCAT('%', :q, '%')) ORDER BY m.createdAt DESC")
    List<MediaFileEntity> findUnassignedByName(@Param("q") String q);
}
