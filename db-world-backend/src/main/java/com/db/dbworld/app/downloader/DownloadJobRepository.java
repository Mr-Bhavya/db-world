package com.db.dbworld.app.downloader;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DownloadJobRepository extends JpaRepository<DownloadJob, String> {
    List<DownloadJob> findByOwnerOrderByCreatedAtDesc(String owner);
    List<DownloadJob> findAllByOrderByCreatedAtDesc();
    List<DownloadJob> findByStatusInOrderByCreatedAtAsc(List<String> states);
    List<DownloadJob> findByExpiresAtBeforeAndStatus(Instant now, String status);
}