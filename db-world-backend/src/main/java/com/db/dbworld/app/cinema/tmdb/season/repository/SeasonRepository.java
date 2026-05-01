package com.db.dbworld.app.cinema.tmdb.season.repository;

import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SeasonRepository extends JpaRepository<SeasonEntity, Long> {

    @Modifying
    @Transactional
    @Query("delete from SeasonEntity s where s.tvShow.id = :tvId")
    void deleteByTvShowId(Long tvId);

    /**
     * Initialises the episodes bag for every season of a TV show.
     * Call this after findWithSeasons (within the same transaction) so the
     * L1 cache merges episodes onto the already-loaded SeasonEntity instances.
     */
    @Query("SELECT DISTINCT s FROM SeasonEntity s LEFT JOIN FETCH s.episodes WHERE s.tvShow.id = :tvId")
    List<SeasonEntity> findWithEpisodesByTvShowId(@Param("tvId") Long tvId);
}
