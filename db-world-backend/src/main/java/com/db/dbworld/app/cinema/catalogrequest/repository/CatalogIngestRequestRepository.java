package com.db.dbworld.app.cinema.catalogrequest.repository;

import com.db.dbworld.app.cinema.catalogrequest.dto.MyCatalogIngestRequestEntry;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestEntity;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestStatus;
import com.db.dbworld.app.cinema.enums.RecordType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CatalogIngestRequestRepository extends JpaRepository<CatalogIngestRequestEntity, Long> {

    Optional<CatalogIngestRequestEntity> findByTmdbIdAndMediaType(Long tmdbId, RecordType mediaType);

    @Query("""
           SELECT r FROM CatalogIngestRequestEntity r
           LEFT JOIN FETCH r.voterUserIds
           WHERE r.status = :status
           ORDER BY r.createdAt DESC
           """)
    List<CatalogIngestRequestEntity> findAllByStatusWithVoters(@Param("status") CatalogIngestRequestStatus status);

    @Query("""
           SELECT r FROM CatalogIngestRequestEntity r
           LEFT JOIN FETCH r.voterUserIds
           ORDER BY r.createdAt DESC
           """)
    List<CatalogIngestRequestEntity> findAllWithVoters();

    @Query("""
           SELECT new com.db.dbworld.app.cinema.catalogrequest.dto.MyCatalogIngestRequestEntry(r.tmdbId, r.mediaType)
           FROM CatalogIngestRequestEntity r
           JOIN r.voterUserIds v
           WHERE v = :userId AND r.status = 'PENDING'
           """)
    List<MyCatalogIngestRequestEntry> findPendingRequestsVotedBy(@Param("userId") Long userId);
}
