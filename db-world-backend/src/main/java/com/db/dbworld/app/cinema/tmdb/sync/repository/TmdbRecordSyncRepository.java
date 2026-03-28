package com.db.dbworld.app.cinema.tmdb.sync.repository;

import com.db.dbworld.cinema.enums.RecordType;
import com.db.dbworld.cinema.tmdb.people.mapper.PersonMapper;
import com.db.dbworld.cinema.tmdb.sync.entity.TmdbRecordSyncEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TmdbRecordSyncRepository extends JpaRepository<TmdbRecordSyncEntity, Long> {

    Optional<TmdbRecordSyncEntity> findByTmdbIdAndRecordType(Long tmdbId, RecordType type);

    List<TmdbRecordSyncEntity> findByLastCheckedAtBefore(Instant time);

    Optional<TmdbRecordSyncEntity> findTopByRecordTypeOrderByLastCheckedAtDesc(RecordType type);
}