package com.db.dbworld.hls;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface HLSContentRepository extends JpaRepository<HLSContentEntity, String> {

    Optional<HLSContentEntity> findByMediaFileInfoId(String mediaFileInfoId);

    Optional<HLSContentEntity> findByRecordId(Long recordId);

    List<HLSContentEntity> findAllByRecordId(Long recordId);

    List<HLSContentEntity> findByStatus(HLSStatus status);

    Optional<HLSContentEntity> findByRecordIdAndMediaFileInfoId(Long recordId, String id);

    List<HLSContentEntity> findByGeneratedAtBefore(LocalDateTime cutoffDate);
}
