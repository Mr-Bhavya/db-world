package com.db.dbworld.app.media.ingestion.repository;

import com.db.dbworld.app.media.ingestion.entity.IngestionJobEntity;
import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
