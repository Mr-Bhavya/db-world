package com.db.dbworld.app.media.info.repository;

import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    /**
     * Lean lookup used by activity tracking — returns just {id, recordId} so we don't
     * drag tracks into a high-volume insert path. Returns array {String id, Long recordId}
     * or empty if no row matches.
     */
    @Query("SELECT m.id, m.record.id FROM MediaFileEntity m WHERE m.filePath = :filePath")
    Optional<Object[]> findIdAndRecordIdByFilePath(@Param("filePath") String filePath);

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

    // ── Paginated admin list (two-query pattern: IDs first, then entities with tracks) ──

    @Query("SELECT m.id FROM MediaFileEntity m WHERE " +
           "(:q IS NULL OR LOWER(m.fileName) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<String> findIdsByQ(@Param("q") String q, Pageable pageable);

    @Query("SELECT m.id FROM MediaFileEntity m WHERE m.record IS NOT NULL AND " +
           "(:q IS NULL OR LOWER(m.fileName) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<String> findLinkedIdsByQ(@Param("q") String q, Pageable pageable);

    @Query("SELECT m.id FROM MediaFileEntity m WHERE m.record IS NULL AND " +
           "(:q IS NULL OR LOWER(m.fileName) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<String> findUnlinkedIdsByQ(@Param("q") String q, Pageable pageable);

    @EntityGraph(attributePaths = "tracks")
    List<MediaFileEntity> findAllByIdIn(List<String> ids);

    // ── Stats queries ─────────────────────────────────────────────────────────

    @Query("SELECT COUNT(m) FROM MediaFileEntity m")
    long countTotal();

    @Query("SELECT COUNT(m) FROM MediaFileEntity m WHERE m.record IS NOT NULL")
    long countLinked();

    @Query("SELECT COALESCE(SUM(m.fileSize), 0) FROM MediaFileEntity m")
    long sumFileSize();

    @Query(value = "SELECT COUNT(DISTINCT media_file_id) FROM media_tracks " +
                   "WHERE track_type = 'Video' AND v_hdr_format IS NOT NULL", nativeQuery = true)
    long countHdr();

    @Query(value = "SELECT COUNT(DISTINCT media_file_id) FROM media_tracks " +
                   "WHERE track_type = 'Video' AND v_height >= 2160", nativeQuery = true)
    long countUhd();
}
