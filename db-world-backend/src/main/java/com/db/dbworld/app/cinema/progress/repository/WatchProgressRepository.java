package com.db.dbworld.app.cinema.progress.repository;

import com.db.dbworld.app.cinema.progress.entity.WatchProgressEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface WatchProgressRepository extends JpaRepository<WatchProgressEntity, Long> {
    Optional<WatchProgressEntity> findByUserIdAndFileId(Long userId, String fileId);
    List<WatchProgressEntity> findByUserIdAndUpdatedAtAfterOrderByUpdatedAtDesc(Long userId, Instant after);
}
