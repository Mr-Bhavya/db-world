package com.db.dbworld.app.filemanager.upload;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface UploadSessionRepository extends JpaRepository<UploadSessionEntity, String> {
    List<UploadSessionEntity> findByStatusAndUpdatedAtBefore(String status, Instant t);
}
