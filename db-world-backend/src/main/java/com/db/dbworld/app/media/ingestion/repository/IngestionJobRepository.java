package com.db.dbworld.app.media.ingestion.repository;

import com.db.dbworld.app.media.ingestion.entity.IngestionJobEntity;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface IngestionJobRepository extends JpaRepository<IngestionJobEntity, String> {

    List<IngestionJobEntity> findByStatus(String status);

    List<IngestionJobEntity> findByRecordId(Long recordId);

    List<IngestionJobEntity> findBySourceType(String sourceType);

    List<IngestionJobEntity> findByFolderName(String folderName);

    List<IngestionJobEntity> findByStatusNotIn(Collection<MirrorStatus> statuses);

    String HISTORY_FILTER = """
             from IngestionJobEntity e
            where (:status is null or e.status = :status)
              and (:q is null
                   or lower(e.uri) like :q escape '!' or lower(e.fileName) like :q escape '!'
                   or lower(e.jobId) like :q escape '!'
                   or e.recordId in (select r.id from RecordEntity r where lower(r.name) like :q escape '!'))
            """;

    /** One page of history. {@code q} must be lower-cased, {@code !}-escaped and wrapped in {@code %…%}. */
    @Query(value = """
            select new com.db.dbworld.app.media.ingestion.repository.IngestionHistoryRow(
                   e.jobId, e.status, e.step, e.sourceType, e.uri, e.fileName, e.totalBytes,
                   e.startedAt, e.completedAt, e.failReason, e.recordId)
            """ + HISTORY_FILTER,
            countQuery = "select count(e) " + HISTORY_FILTER)
    Page<IngestionHistoryRow> searchHistory(@Param("status") MirrorStatus status,
                                            @Param("q") String q,
                                            Pageable pageable);

    /** [status, count] pairs across the whole history, for the summary chips. */
    @Query("select e.status, count(e) from IngestionJobEntity e group by e.status")
    List<Object[]> countGroupedByStatus();
}
