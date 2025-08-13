package com.db.dbworld.dao.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TmdbDataRepository extends JpaRepository<TmdbDataEntity, Long> {

    @Query(value = "SELECT * FROM tmdb_data ORDER BY id DESC LIMIT :limit", nativeQuery = true)
    List<TmdbDataEntity> findRecentRecords(@Param("limit") int limit);

}
