package com.db.dbworld.app.cinema.tmdb.season.repository;

import com.db.dbworld.app.cinema.tmdb.season.entity.EpisodeEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface EpisodeRepository extends JpaRepository<EpisodeEntity, Long> {
    List<EpisodeEntity> findBySeason(SeasonEntity season);

    List<EpisodeEntity> findBySeasonId(Long id);

    @Modifying
    @Transactional
    @Query("""
        delete from EpisodeEntity e
        where e.season.id in (
            select s.id from SeasonEntity s where s.tvShow.id = :tvId
        )
    """)
    void deleteByTvShowId(Long tvId);
}
